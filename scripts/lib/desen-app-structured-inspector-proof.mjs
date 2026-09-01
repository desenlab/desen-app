import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, types as utilTypes } from "node:util";

import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  authenticateDesenAppEvergreenProductCompositionSuccessor,
  materializeDesenAppHistoricalReaderFileOverrides,
  readDesenAppHistoricalReaderProjection,
} from "./desen-app-evergreen-product-composition-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const M10_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-empty-project-browser-e2e.json";
const M10_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN = Object.freeze({
  bytes: 10_259,
  sha256: "959dde63ef28bc7fd25967a9193e39e082c9178bc12f40b83036c5dd6042df77",
});
const M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-browser-e2e-workspace-compatibility.json";
const M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN = Object.freeze({
  bytes: 16_025,
  sha256: "e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d",
});
const M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json";
const M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PIN = Object.freeze({
  bytes: 20_173,
  sha256: "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
});
const M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-visual-behavior-authoring.json";
const M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PIN = Object.freeze({
  bytes: 10_962,
  sha256: "cd7366014a0cb6f056fa78392f81ef7cb4b5be2f523b95e5984c704be3caf0e8",
});
const M10_VISUAL_BEHAVIOR_AUTHORING_HOSTED_BROWSER_COMPATIBILITY_RECEIPT = Object.freeze({
  path: "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
  bytes: 15_143,
  sha256: "5fcdc7f312bb2ef45e747499e50bf31f2dfae8e1c1b82963176d99eb8bb8395b",
});
const M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS = Object.freeze([
  ".github/workflows/ci.yml",
  "apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts",
  "apps/desen-app-browser-e2e/package.json",
  "apps/desen-app/package.json",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/authoring-behavior-projection.ts",
  "apps/desen-app/src/authoring-conditions.ts",
  "apps/desen-app/src/authoring-connections.ts",
  "apps/desen-app/src/authoring-event-actions.ts",
  "apps/desen-app/src/authoring-fixtures.ts",
  "apps/desen-app/src/behavior-controls.tsx",
  "apps/desen-app/src/event-action-panel.tsx",
  "apps/desen-app/src/inspector-panel.tsx",
  "apps/desen-app/src/preview-controls.tsx",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/authoring-behavior-projection.test.ts",
  "apps/desen-app/test/authoring-conditions.test.ts",
  "apps/desen-app/test/authoring-connections.test.ts",
  "apps/desen-app/test/authoring-event-actions.test.ts",
  "apps/desen-app/test/authoring-fixtures.test.ts",
  "apps/desen-app/test/behavior-controls.test.tsx",
  "apps/desen-app/test/event-action-panel.test.tsx",
  "apps/desen-app/test/persistence-application.test.tsx",
  "apps/desen-app/test/preview-controls.test.tsx",
  "apps/desen-app/test/publication-application.test.tsx",
  M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
  "packages/reference-catalog-web/catalog.json",
  "scripts/generate-desen-app-visual-behavior-authoring-proof.mjs",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/verify-desen-app-visual-behavior-authoring.mjs",
]);
const M10_USER_CREATED_BLANK_PROJECT_TRACKED_PATHS = Object.freeze([
  ".github/workflows/ci.yml",
  ".gitignore",
  "apps/desen-app-browser-e2e/package.json",
  "apps/desen-app-browser-e2e/playwright.config.ts",
  "apps/desen-app-browser-e2e/product-playwright.config.ts",
  "apps/desen-app-browser-e2e/product-proof-server.mjs",
  "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
  "apps/desen-app/dev/local-dev-host.mjs",
  "apps/desen-app/dev/local-dev-host.test.mjs",
  "apps/desen-app/dev/local-dev.mjs",
  "apps/desen-app/package.json",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/local-runtime-persistence.ts",
  "apps/desen-app/src/main.tsx",
  "apps/desen-app/src/product-bootstrap.tsx",
  "apps/desen-app/src/project-data.ts",
  "apps/desen-app/src/reference-empty-project.ts",
  "apps/desen-app/src/styles.css",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/local-runtime-persistence.test.ts",
  "apps/desen-app/test/main-lifecycle.test.tsx",
  "apps/desen-app/test/product-bootstrap.test.tsx",
  "apps/desen-app/tsconfig.local-dev.json",
  "dependency-cruiser.config.cjs",
  "docs/proof/artifacts/desen-app-0.1.0-browser-e2e-workspace-compatibility.json",
  "package.json",
  "pnpm-lock.yaml",
  "scripts/generate-desen-app-user-created-blank-project-proof.mjs",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-user-created-blank-project-proof.mjs",
  "scripts/verify-boundary-fixtures.mjs",
  "scripts/verify-desen-app-user-created-blank-project.mjs",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-product-server-control-plane-root/apps/control-plane-api/dist/index.js",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-product-server-control-plane-root/apps/desen-app-browser-e2e/product-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-non-product-server-imports-control-plane/apps/control-plane-api/dist/index.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-non-product-server-imports-control-plane/apps/desen-app-browser-e2e/proof-application.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-control-plane-private/apps/control-plane-api/dist/runtime-activation-sqlite-internal.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-control-plane-private/apps/desen-app-browser-e2e/product-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-other-app/apps/desen-app-browser-e2e/product-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-other-app/apps/desen-app/src/application.js",
  "tests/boundaries/README.md",
  "tests/desen-app-user-created-blank-project.test.mjs",
]);
const M10_USER_CREATED_BLANK_PROJECT_SECURE_SCROLL_RECEIPTS = Object.freeze([
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
const M10_USER_CREATED_BLANK_PROJECT_OVERRIDDEN_HISTORICAL_PATHS = Object.freeze([
  "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
  "apps/desen-app/src/application.module.css",
]);
const M10_USER_CREATED_BLANK_PROJECT_ADDITIVE_PATHS = Object.freeze([
  "apps/desen-app/src/inspector-panel.tsx",
  "apps/desen-app/test/inspector-panel.test.tsx",
]);
const M10_USER_CREATED_BLANK_PROJECT_CHECKPOINT_RESEALED_PATHS = Object.freeze([
  "scripts/lib/desen-app-user-created-blank-project-proof.mjs",
  "tests/desen-app-user-created-blank-project.test.mjs",
]);
const M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS = Object.freeze([
  ...M10_USER_CREATED_BLANK_PROJECT_TRACKED_PATHS,
  ...M10_USER_CREATED_BLANK_PROJECT_ADDITIVE_PATHS,
]);
const M10_USER_CREATED_BLANK_PROJECT_CLAIM = Object.freeze({
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
});
const M10_EMPTY_PROJECT_SUCCESSOR_RECEIPTS = Object.freeze({
  "pnpm-lock.yaml": Object.freeze({
    path: "pnpm-lock.yaml",
    bytes: 131_780,
    sha256: "da2883dc9d1e7ff90ddc64df26c9a1a517432199adae3d32f46ecf875fee9bf6",
  }),
  "apps/desen-app/src/application.tsx": Object.freeze({
    path: "apps/desen-app/src/application.tsx",
    bytes: 126_618,
    sha256: "622fdf26123d54de5a0e17015e6525f73bb7569facef36e5d4583340d8fd5090",
  }),
  "apps/desen-app/test/application.test.tsx": Object.freeze({
    path: "apps/desen-app/test/application.test.tsx",
    bytes: 107_788,
    sha256: "931f3097888c3f3e8c1636acd01d92975bdcbf06b37a6a55bb767dad1d905c7b",
  }),
  "dependency-cruiser.config.cjs": Object.freeze({
    path: "dependency-cruiser.config.cjs",
    bytes: 9_155,
    sha256: "b338a41d5e12ce6e8d849f356d4f7358747993f7802fd3b69c163073cfee3b35",
  }),
});
const M10_UNCHANGED_MANIFEST_RECEIPTS = Object.freeze({
  "package.json": Object.freeze({
    path: "package.json",
    bytes: 97_170,
    sha256: "5baf41a8ada5bec8ce025da441cf3b9980a2d4594c0342f6c161afad6591c351",
  }),
  "apps/desen-app/package.json": Object.freeze({
    path: "apps/desen-app/package.json",
    bytes: 3_845,
    sha256: "d6b076c782bd3dd11718d99ed0e93b3938d849bacfff2f10e34fc4e0da16186e",
  }),
});
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-STRUCTURED-INSPECTOR.md";
const NAMED_SLOT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json";
const STATE_BINDING_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json";
const FIXTURES_SCENARIOS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PARENT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const SOURCE_FIXTURE_PATH = "examples/sign-in/official-derived.source.desen.json";
const BUNDLE_FIXTURE_PATH = "examples/sign-in/official-derived.bundle.desen.json";
const AUTHORING_DATA_PATH = "apps/desen-app/src/authoring-data.ts";
const INSPECTOR_SOURCE_PATH = "apps/desen-app/src/authoring-inspector.ts";
const STRUCTURED_JSON_SOURCE_PATH = "apps/desen-app/src/structured-json.ts";
const AUTHORING_SLOT_SOURCE_PATH = "apps/desen-app/src/authoring-slots.ts";
const EVENT_ACTION_SOURCE_PATH = "apps/desen-app/src/authoring-event-actions.ts";
const EVENT_ACTION_PANEL_PATH = "apps/desen-app/src/event-action-panel.tsx";
const PREVIEW_SOURCE_PATH = "apps/desen-app/src/authoring-preview.ts";
const SELECTION_SOURCE_PATH = "apps/desen-app/src/authoring-selection.ts";
const PANEL_SOURCE_PATH = "apps/desen-app/src/inspector-panel.tsx";
const ADAPTER_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const APPLICATION_CSS_PATH = "apps/desen-app/src/application.module.css";
const GLOBAL_CSS_PATH = "apps/desen-app/src/styles.css";
const STRUCTURED_JSON_TEST_PATH = "apps/desen-app/test/structured-json.test.ts";
const INSPECTOR_TEST_PATH = "apps/desen-app/test/authoring-inspector.test.ts";
const PANEL_TEST_PATH = "apps/desen-app/test/inspector-panel.test.tsx";
const PREVIEW_TEST_PATH = "apps/desen-app/test/authoring-preview.test.ts";
const ADAPTER_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
const AUTHORING_DATA_TEST_PATH = "apps/desen-app/test/authoring-data.test.ts";
const AUTHORING_SLOT_TEST_PATH = "apps/desen-app/test/authoring-slots.test.ts";
const EVENT_ACTION_TEST_PATH = "apps/desen-app/test/authoring-event-actions.test.ts";
const EVENT_ACTION_PANEL_TEST_PATH = "apps/desen-app/test/event-action-panel.test.tsx";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

/** Exact reviewed live receipts for the additive post-M09 workplane and Catalog successor. */
const M09_EDITOR_WORKPLANE_SUCCESSOR_RECEIPTS = Object.freeze({
  "apps/desen-app/README.md": Object.freeze({
    path: "apps/desen-app/README.md",
    bytes: 40_471,
    sha256: "3d9e7e5eafe23454e0150338fe4abe0e677b994e11b0aac2990275786e6b27da",
  }),
  "apps/desen-app/src/adapter-canvas.tsx": Object.freeze({
    path: "apps/desen-app/src/adapter-canvas.tsx",
    bytes: 16_788,
    sha256: "9b481584bd681fa83843188784a994e6bba9b22e075a2f3febdc2c3aca6d6302",
  }),
  "apps/desen-app/src/application.module.css": Object.freeze({
    path: "apps/desen-app/src/application.module.css",
    bytes: 106_903,
    sha256: "a5d0770257ca999e0d53a690261062d2d3961618eee693589cfd612159b8240f",
  }),
  "apps/desen-app/src/application.tsx": Object.freeze({
    path: "apps/desen-app/src/application.tsx",
    bytes: 125_768,
    sha256: "c245622c2bc220b584c945a872fba6c2729fb8717e8d56f5d36c9730ed0d31dd",
  }),
  "apps/desen-app/src/authoring-data.ts": Object.freeze({
    path: "apps/desen-app/src/authoring-data.ts",
    bytes: 25_614,
    sha256: "1af917263d0c5ca88146712074fa17ea89e04366bd7976a554b6678f506f6d10",
  }),
  "apps/desen-app/src/authoring-preview.ts": Object.freeze({
    path: "apps/desen-app/src/authoring-preview.ts",
    bytes: 3_704,
    sha256: "ca180fc31115b7c560b1538d2f86bcfd51cb34dba97f15b83ae915a597ad0ba8",
  }),
  "apps/desen-app/src/inspector-panel.tsx": Object.freeze({
    path: "apps/desen-app/src/inspector-panel.tsx",
    bytes: 32_375,
    sha256: "685054c715d4de4024180d283ff1901773f527adcec9c9cb5680c9100fe99620",
  }),
  "apps/desen-app/test/adapter-canvas.test.tsx": Object.freeze({
    path: "apps/desen-app/test/adapter-canvas.test.tsx",
    bytes: 17_367,
    sha256: "1861845d666e473d4925627156c53411923f5947cbd1005c5dd3361751949725",
  }),
  "apps/desen-app/test/application.test.tsx": Object.freeze({
    path: "apps/desen-app/test/application.test.tsx",
    bytes: 105_648,
    sha256: "da856ec052aa2e2e46f268bd132035756d04019c5d9e817b4f5064b8aa9f70f6",
  }),
  "apps/desen-app/test/authoring-data.test.ts": Object.freeze({
    path: "apps/desen-app/test/authoring-data.test.ts",
    bytes: 12_664,
    sha256: "4063b1df705641c7e7c196680ca6a3a9d19fdb4dfc6bff5906b291c9a7b11a74",
  }),
  "apps/desen-app/test/authoring-preview.test.ts": Object.freeze({
    path: "apps/desen-app/test/authoring-preview.test.ts",
    bytes: 4_001,
    sha256: "842b2869b7de0126ec84fd1d27ce8163fdaca214d9bb5005a79daddc8847359b",
  }),
  "apps/desen-app/test/inspector-panel.test.tsx": Object.freeze({
    path: "apps/desen-app/test/inspector-panel.test.tsx",
    bytes: 25_478,
    sha256: "753b1dee2aa0728dc77971b41f37290a8e008eaa4ee1ac0cdcb153668484fbfe",
  }),
  "examples/sign-in/official-derived.bundle.desen.json": Object.freeze({
    path: "examples/sign-in/official-derived.bundle.desen.json",
    bytes: 4_899,
    sha256: "f8068e54e0880a3ea8dc18a568c9b6e9ccbcead942da5708f88a1b650c9932ef",
  }),
  "packages/reference-catalog-web/catalog.json": Object.freeze({
    path: "packages/reference-catalog-web/catalog.json",
    bytes: 8_439,
    sha256: "5d30b58b2ecb630fcefc70a2e5a5b1dc0b228d028ba768194c5b06429949727a",
  }),
});

function reviewedSuccessorReceiptMap(receipts) {
  const receiptMap = new Map(receipts.map((candidate) => [candidate?.path, candidate]));
  for (const receipt of Object.values(M09_EDITOR_WORKPLANE_SUCCESSOR_RECEIPTS)) {
    receiptMap.set(receipt.path, receipt);
  }
  for (const receipt of Object.values(M10_EMPTY_PROJECT_SUCCESSOR_RECEIPTS)) {
    receiptMap.set(receipt.path, receipt);
  }
  return receiptMap;
}

function authenticateM10EmptyProjectBrowserE2eSuccessor(files) {
  const artifactBytes = files.get(M10_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH);
  const pin = M10_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN;
  if (
    artifactBytes?.byteLength !== pin.bytes ||
    sha256(artifactBytes ?? Buffer.alloc(0)) !== pin.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact immutable M10-T01 empty-project browser artifact drifted.",
    );
  }
  const artifact = parseJson(
    artifactBytes,
    M10_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH,
    "SUCCESSOR_POLICY_VIOLATION",
  );
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.task !== "M10-T01" ||
    artifact?.gate !== null ||
    artifact?.proofId !== "desen-app-empty-project-browser-e2e" ||
    artifact?.profile !== "desen.app.empty-project-browser-e2e-proof.v1" ||
    artifact?.result !== "PASS" ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.p08Status !== "PROVEN" ||
    artifact?.claim?.beginsFromExplicitlyEmptySource !== true ||
    artifact?.claim?.exactCatalogResolved !== true ||
    artifact?.claim?.visualAuthoringCovered !== true ||
    artifact?.claim?.nativeComponentDragCovered !== true ||
    artifact?.claim?.nativeLayerDragCovered !== true ||
    artifact?.claim?.forgedDataTransferRejected !== true ||
    artifact?.claim?.authoredDeletionCovered !== true ||
    artifact?.claim?.exactSourceSavedAndReadBack !== true ||
    artifact?.claim?.savedSourceStructurallyAdmitted !== true ||
    artifact?.claim?.designRunStaticParityCovered !== true ||
    artifact?.claim?.runtimeInputAndPendingCovered !== false ||
    artifact?.claim?.invalidCredentialsAndPublicFailureCovered !== false ||
    artifact?.claim?.successNavigationAndHostOperationCovered !== false ||
    artifact?.claim?.remoteDeploymentCovered !== false ||
    artifact?.claim?.g10Closed !== false ||
    artifact?.authority?.source?.nativeDragCalls !== 2 ||
    artifact?.authority?.source?.runtimeConsoleErrorsAllowed !== 0 ||
    artifact?.authority?.package?.playwrightVersion !== "1.62.1" ||
    artifact?.tests?.browserTestDeclarations !== 1 ||
    artifact?.tests?.browserExecutedByVerifier !== false ||
    artifact?.boundary?.trackedFiles !== 18
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The immutable M10-T01 artifact identity or bounded claim drifted.",
    );
  }

  const compatibilityBytes = files.get(M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH);
  const compatibilityPin = M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN;
  if (
    compatibilityBytes?.byteLength !== compatibilityPin.bytes ||
    sha256(compatibilityBytes ?? Buffer.alloc(0)) !== compatibilityPin.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact append-only M10-T01 workspace compatibility artifact drifted.",
    );
  }
  const compatibility = parseJson(
    compatibilityBytes,
    M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH,
    "SUCCESSOR_POLICY_VIOLATION",
  );
  const compatibilityParent = compatibility?.prerequisites?.[0];
  if (
    compatibility?.schemaVersion !== 1 ||
    compatibility?.task !== "M10-T01" ||
    compatibility?.compatibilityReceipt !== "M10-T01-COMPAT" ||
    compatibility?.gate !== null ||
    compatibility?.proofId !== "desen-app-browser-e2e-workspace-compatibility" ||
    compatibility?.profile !== "desen.app.browser-e2e-workspace-compatibility-proof.v1" ||
    compatibility?.result !== "PASS" ||
    compatibility?.claim?.taskStatus !== "DONE" ||
    compatibility?.claim?.correctiveReceiptOnly !== true ||
    compatibility?.claim?.dedicatedBoundaryPolicyCovered !== true ||
    compatibility?.claim?.p08Status !== "PROVEN" ||
    compatibility?.claim?.runtimeInputAndPendingCovered !== false ||
    compatibility?.claim?.invalidCredentialsAndPublicFailureCovered !== false ||
    compatibility?.claim?.successNavigationAndHostOperationCovered !== false ||
    compatibility?.claim?.remoteDeploymentCovered !== false ||
    compatibility?.claim?.g10Closed !== false ||
    compatibility?.authority?.source?.nativeDragCalls !== 2 ||
    compatibility?.authority?.source?.runtimeConsoleErrorsAllowed !== 0 ||
    compatibility?.authority?.package?.rootOwnsBrowserE2e !== false ||
    compatibility?.authority?.package?.appOwnsBrowserE2e !== false ||
    compatibility?.authority?.package?.dedicatedWorkspaceOwnership !== true ||
    compatibility?.authority?.package?.playwrightVersion !== "1.62.1" ||
    compatibility?.authority?.boundary?.dedicatedInternalPackageAllowlist?.length !== 1 ||
    compatibility?.authority?.boundary?.dedicatedInternalPackageAllowlist?.[0] !== "editor-core" ||
    compatibility?.authority?.boundary?.reviewedAppSourceEntries?.length !== 3 ||
    compatibility?.authority?.boundary?.negativeFixtures?.length !== 2 ||
    compatibility?.tests?.browserTestDeclarations !== 1 ||
    compatibility?.tests?.browserExecutedByVerifier !== false ||
    compatibility?.boundary?.trackedFiles !== 32 ||
    compatibilityParent?.path !== M10_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH ||
    compatibilityParent?.bytes !== pin.bytes ||
    compatibilityParent?.sha256 !== pin.sha256 ||
    compatibilityParent?.immutable !== true
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The append-only M10-T01 compatibility identity or corrective claim drifted.",
    );
  }
  const compatibilityReceiptMap = new Map(
    compatibility.boundary.trackedReceipts.map((candidate) => [candidate?.path, candidate]),
  );

  for (const expected of [
    ...Object.values(M10_EMPTY_PROJECT_SUCCESSOR_RECEIPTS),
    ...Object.values(M10_UNCHANGED_MANIFEST_RECEIPTS),
  ]) {
    const bytes = files.get(expected.path);
    const compatibilityReceipt = compatibilityReceiptMap.get(expected.path);
    if (
      !isDeepStrictEqual(compatibilityReceipt, expected) ||
      (!M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS.includes(expected.path) &&
        !M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.includes(expected.path) &&
        (bytes?.byteLength !== expected.bytes ||
          sha256(bytes ?? Buffer.alloc(0)) !== expected.sha256))
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `The exact current M10-T01 compatibility receipt drifted: ${expected.path}.`,
      );
    }
  }

  return deepFreeze({
    task: "M10-T01",
    artifact: Object.freeze({
      path: M10_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH,
      bytes: pin.bytes,
      sha256: pin.sha256,
      immutable: true,
    }),
    compatibilityArtifact: Object.freeze({
      path: M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH,
      bytes: compatibilityPin.bytes,
      sha256: compatibilityPin.sha256,
      compatibilityReceipt: compatibility.compatibilityReceipt,
      correctiveReceiptOnly: compatibility.claim.correctiveReceiptOnly,
    }),
    currentProjection: Object.freeze({
      relationship: "IMMUTABLE_M10_T01_COMPATIBILITY_RECEIPTS",
      changedHistoricalPaths: Object.freeze(Object.values(M10_EMPTY_PROJECT_SUCCESSOR_RECEIPTS)),
      unchangedOriginMainManifests: Object.freeze(Object.values(M10_UNCHANGED_MANIFEST_RECEIPTS)),
    }),
    p08Status: artifact.claim.p08Status,
    runtimeInputAndPendingCovered: artifact.claim.runtimeInputAndPendingCovered,
    invalidCredentialsAndPublicFailureCovered:
      artifact.claim.invalidCredentialsAndPublicFailureCovered,
    successNavigationAndHostOperationCovered:
      artifact.claim.successNavigationAndHostOperationCovered,
    g10Closed: artifact.claim.g10Closed,
  });
}

function authenticateM10UserCreatedBlankProjectSuccessor(
  files,
  evergreenProductCompositionSuccessor,
) {
  void evergreenProductCompositionSuccessor;
  const bytes = files.get(M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH);
  const pin = M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PIN;
  if (bytes?.byteLength !== pin.bytes || sha256(bytes ?? Buffer.alloc(0)) !== pin.sha256) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact immutable M10-T01A user-created blank-project artifact drifted.",
    );
  }
  const artifact = parseJson(
    bytes,
    M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
    "SUCCESSOR_POLICY_VIOLATION",
  );
  const predecessor = artifact?.prerequisites?.[0];
  const source = artifact?.authority?.source;
  const packageAuthority = artifact?.authority?.package;
  const tests = artifact?.tests;
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.task !== "M10-T01A" ||
    artifact?.gate !== null ||
    artifact?.proofId !== "desen-app-user-created-blank-project" ||
    artifact?.profile !== "desen.app.user-created-blank-project-proof.v1" ||
    artifact?.result !== "PASS" ||
    !isDeepStrictEqual(artifact?.claim, M10_USER_CREATED_BLANK_PROJECT_CLAIM) ||
    source?.normalProductEntry !== true ||
    source?.productEntryInjectsDocument !== false ||
    source?.visibleNewProjectControl !== true ||
    source?.visibleBlankTemplate !== true ||
    source?.exactProjectId !== "account-app" ||
    source?.exactSurfaceId !== "sign-in" ||
    source?.exactCatalogIdentity !== "run.desen.reference.sign-in@0.1.0#web-react" ||
    !isDeepStrictEqual(source?.frame, { preset: "portrait", width: 420, height: 720 }) ||
    source?.localRuntimeProfile !== "desen.app.local-runtime.v1" ||
    source?.fixedLoopbackOnly !== true ||
    source?.freshBearerSecret !== true ||
    source?.durableControlPlaneStore !== true ||
    source?.productionBundlePreview !== true ||
    source?.browserTestDeclarations !== 1 ||
    source?.nativeDragCalls !== 2 ||
    source?.forgedDataTransferRejected !== true ||
    source?.initialProjectCount !== 0 ||
    source?.creationGeneration !== 1 ||
    source?.authoredGeneration !== 2 ||
    source?.hardReloadCovered !== true ||
    source?.visibleProjectReopenCovered !== true ||
    source?.browserRuntimeErrorsAllowed !== 0 ||
    source?.browserExecutionPerformedByReader !== false ||
    packageAuthority?.appPackageName !== "@desen/app-web" ||
    packageAuthority?.browserPackageName !== "@desen/app-browser-e2e" ||
    packageAuthority?.appDevCommand !== "node dev/local-dev.mjs" ||
    packageAuthority?.appLocalRuntimeTestCommand !==
      "vitest run test/local-runtime-persistence.test.ts dev/local-dev-host.test.mjs" ||
    packageAuthority?.appProductBootstrapTestCommand !==
      "vitest run test/product-bootstrap.test.tsx test/main-lifecycle.test.tsx" ||
    packageAuthority?.browserCommand !==
      "pnpm --filter @desen/app-web... build && pnpm run typecheck && pnpm run build && playwright test --config playwright.config.ts && playwright test --config product-playwright.config.ts" ||
    packageAuthority?.browserProject !== "product-chromium" ||
    packageAuthority?.playwrightVersion !== "1.62.1" ||
    packageAuthority?.appOwnsPlaywright !== false ||
    packageAuthority?.dedicatedBrowserWorkspace !== true ||
    packageAuthority?.exactHeadBrowserExecution !== true ||
    !isDeepStrictEqual(packageAuthority?.workflowEvidenceOrder, [
      "node scripts/verify-desen-app-browser-e2e-workspace-compatibility.mjs",
      "node --test tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
      "node scripts/verify-desen-app-user-created-blank-project.mjs",
      "node --test tests/desen-app-user-created-blank-project.test.mjs",
    ]) ||
    tests?.browserCommand !== "pnpm --filter @desen/app-browser-e2e test:e2e" ||
    tests?.browserSpec !== "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts" ||
    tests?.browserTestDeclarations !== 1 ||
    !isDeepStrictEqual(tests?.configuredProjects, ["product-chromium"]) ||
    tests?.workers !== 1 ||
    tests?.retries !== 0 ||
    tests?.productBootstrapCommand !== "pnpm --filter @desen/app-web test:product-bootstrap" ||
    tests?.localRuntimeCommand !== "pnpm --filter @desen/app-web test:local-runtime" ||
    tests?.boundaryCommand !== "pnpm boundaries" ||
    tests?.boundaryFixtureVerifier !== "node scripts/verify-boundary-fixtures.mjs" ||
    tests?.proofReaderCommand !==
      "node --test tests/desen-app-user-created-blank-project.test.mjs" ||
    tests?.verifierCommand !== "node scripts/verify-desen-app-user-created-blank-project.mjs" ||
    tests?.browserExecutedByVerifier !== false ||
    tests?.boundaryExecutedByVerifier !== false ||
    artifact?.boundary?.trackedFiles !== 43 ||
    artifact?.boundary?.boundaryAuthorityFiles !== 13 ||
    artifact?.boundary?.parentArtifacts !== 1 ||
    artifact?.boundary?.immutableInputs !== true ||
    artifact?.boundary?.sourceSymlinksRejected !== true ||
    artifact?.boundary?.browserExecutionSeparateFromStaticReader !== true ||
    !isDeepStrictEqual(artifact?.boundary?.proofReaderPaths, [
      "scripts/lib/atomic-proof-artifact.mjs",
      "scripts/lib/desen-app-user-created-blank-project-proof.mjs",
      "scripts/generate-desen-app-user-created-blank-project-proof.mjs",
      "scripts/verify-desen-app-user-created-blank-project.mjs",
      "tests/desen-app-user-created-blank-project.test.mjs",
    ]) ||
    !isDeepStrictEqual(predecessor, {
      task: "M10-T01-COMPAT",
      gate: null,
      proofId: "desen-app-browser-e2e-workspace-compatibility",
      path: M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH,
      bytes: M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.bytes,
      sha256: M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.sha256,
      profile: "desen.app.browser-e2e-workspace-compatibility-proof.v1",
      result: "PASS",
      immutable: true,
    }) ||
    !Array.isArray(trackedReceipts) ||
    trackedReceipts.length !== M10_USER_CREATED_BLANK_PROJECT_TRACKED_PATHS.length ||
    !isDeepStrictEqual(
      trackedReceipts.map((receipt) => receipt?.path),
      M10_USER_CREATED_BLANK_PROJECT_TRACKED_PATHS,
    )
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The immutable M10-T01A identity, claims, authority, or receipt manifest drifted.",
    );
  }
  for (const receipt of trackedReceipts) {
    const live = files.get(receipt.path);
    const historicalReceiptOverridden =
      M10_USER_CREATED_BLANK_PROJECT_OVERRIDDEN_HISTORICAL_PATHS.includes(receipt.path);
    const checkpointResealed = M10_USER_CREATED_BLANK_PROJECT_CHECKPOINT_RESEALED_PATHS.includes(
      receipt.path,
    );
    const ownedByM10B = M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.includes(receipt.path);
    if (
      !Number.isSafeInteger(receipt.bytes) ||
      receipt.bytes < 0 ||
      typeof receipt.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(receipt.sha256) ||
      (!historicalReceiptOverridden &&
        !checkpointResealed &&
        !ownedByM10B &&
        (live?.byteLength !== receipt.bytes || sha256(live ?? Buffer.alloc(0)) !== receipt.sha256))
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `The exact current M10-T01A tracked receipt drifted: ${receipt.path}.`,
      );
    }
  }
  for (const receipt of M10_USER_CREATED_BLANK_PROJECT_SECURE_SCROLL_RECEIPTS) {
    if (
      M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.includes(receipt.path) ||
      receipt.path === M10_VISUAL_BEHAVIOR_AUTHORING_HOSTED_BROWSER_COMPATIBILITY_RECEIPT.path
    ) {
      continue;
    }
    const live = files.get(receipt.path);
    if (live?.byteLength !== receipt.bytes || sha256(live ?? Buffer.alloc(0)) !== receipt.sha256) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `The exact M10-T01A Secure-scroll compatibility receipt drifted: ${receipt.path}.`,
      );
    }
  }
  return deepFreeze({
    task: "M10-T01A",
    artifact: Object.freeze({
      path: M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
      bytes: pin.bytes,
      sha256: pin.sha256,
      immutable: true,
    }),
    predecessor: Object.freeze({ ...predecessor }),
    trackedReceipts: Object.freeze(trackedReceipts.map((receipt) => Object.freeze({ ...receipt }))),
    currentProjection: Object.freeze({
      compatibilityReceipt: "M10-T01A-SECURE-SCROLL-COMPAT",
      correctiveReceiptOnly: true,
      overriddenHistoricalPaths: M10_USER_CREATED_BLANK_PROJECT_OVERRIDDEN_HISTORICAL_PATHS,
      additivePaths: M10_USER_CREATED_BLANK_PROJECT_ADDITIVE_PATHS,
      checkpointResealedPaths: M10_USER_CREATED_BLANK_PROJECT_CHECKPOINT_RESEALED_PATHS,
      trackedReceipts: M10_USER_CREATED_BLANK_PROJECT_SECURE_SCROLL_RECEIPTS,
    }),
    p08Status: artifact.claim.p08Status,
    runtimeInputAndPendingCovered: artifact.claim.runtimeInputAndPendingCovered,
    invalidCredentialsAndPublicFailureCovered:
      artifact.claim.invalidCredentialsAndPublicFailureCovered,
    successNavigationAndHostOperationCovered:
      artifact.claim.successNavigationAndHostOperationCovered,
    g10Closed: artifact.claim.g10Closed,
  });
}

function matchesReviewedEditorWorkplaneSuccessor(relativePath, bytes) {
  const receipt = M09_EDITOR_WORKPLANE_SUCCESSOR_RECEIPTS[relativePath];
  return (
    receipt !== undefined &&
    bytes !== undefined &&
    receipt.bytes === bytes.byteLength &&
    receipt.sha256 === sha256(bytes)
  );
}

const FALLBACK_REASONS = Object.freeze([
  "array",
  "open-object",
  "multi-type",
  "reference",
  "combinator",
  "conditional",
  "pattern",
  "unsupported-schema",
  "derivation-limit",
]);

const FALLBACK_REASON_LABEL_MARKERS = Object.freeze([
  'array: "Array schema"',
  '"open-object": "Open object schema"',
  '"multi-type": "Multiple JSON types"',
  'reference: "Referenced schema"',
  'combinator: "Combined schema"',
  'conditional: "Conditional schema"',
  'pattern: "Pattern properties"',
  '"unsupported-schema": "Unsupported schema shape"',
  '"derivation-limit": "Inspector derivation limit"',
]);

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-structured-inspector-proof.mjs",
  "scripts/generate-desen-app-structured-inspector-proof.mjs",
  "scripts/verify-desen-app-structured-inspector.mjs",
  "tests/desen-app-structured-inspector.test.mjs",
]);

const SOURCE_PATHS = Object.freeze([
  AUTHORING_DATA_PATH,
  INSPECTOR_SOURCE_PATH,
  STRUCTURED_JSON_SOURCE_PATH,
  PREVIEW_SOURCE_PATH,
  SELECTION_SOURCE_PATH,
  PANEL_SOURCE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  GLOBAL_CSS_PATH,
]);

const APP_TEST_PATHS = Object.freeze([
  STRUCTURED_JSON_TEST_PATH,
  INSPECTOR_TEST_PATH,
  PANEL_TEST_PATH,
  PREVIEW_TEST_PATH,
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
  PARENT_ARTIFACT_PATH,
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
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  LOCKFILE_PATH,
  AUTHORING_DATA_PATH,
  INSPECTOR_SOURCE_PATH,
  STRUCTURED_JSON_SOURCE_PATH,
  PANEL_SOURCE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  INSPECTOR_TEST_PATH,
  STRUCTURED_JSON_TEST_PATH,
  PANEL_TEST_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
  "scripts/lib/desen-app-structured-inspector-proof.mjs",
  "tests/desen-app-structured-inspector.test.mjs",
]);

const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  M10_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH,
  M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH,
  M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
  M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH,
  "dependency-cruiser.config.cjs",
  ...new Set([
    ...TRACKED_PATHS,
    ...M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS,
    ...M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS,
    AUTHORING_SLOT_SOURCE_PATH,
    EVENT_ACTION_SOURCE_PATH,
    EVENT_ACTION_PANEL_PATH,
    AUTHORING_DATA_TEST_PATH,
    AUTHORING_SLOT_TEST_PATH,
    EVENT_ACTION_TEST_PATH,
    EVENT_ACTION_PANEL_TEST_PATH,
    NAMED_SLOT_ARTIFACT_PATH,
    STATE_BINDING_ARTIFACT_PATH,
    FIXTURES_SCENARIOS_ARTIFACT_PATH,
    SOURCE_PERSISTENCE_ARTIFACT_PATH,
    NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
    PUBLISH_ACTIVATION_ARTIFACT_PATH,
    ...T12_SUCCESSOR_RECEIPT_PATHS,
    ...T13_SUCCESSOR_RECEIPT_PATHS,
    ...T14_SUCCESSOR_RECEIPT_PATHS,
  ]),
]);

const RETAINED_HISTORICAL_PATHS = Object.freeze(
  TRACKED_PATHS.filter(
    (relativePath) =>
      !SUCCESSOR_COMPATIBILITY_PATHS.includes(relativePath) &&
      !M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS.includes(relativePath),
  ),
);

const SELF_RESEALED_PATHS = Object.freeze([
  "scripts/lib/desen-app-structured-inspector-proof.mjs",
  "tests/desen-app-structured-inspector.test.mjs",
]);

const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 26_133,
  sha256: "6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec",
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

const STATE_BINDING_ARTIFACT_PIN = Object.freeze({
  task: "M09-T08",
  proofId: "desen-app-state-binding-editor",
  profile: "desen.app.state-binding-editor-proof.v1",
  result: "PASS",
  path: STATE_BINDING_ARTIFACT_PATH,
  bytes: 28_766,
  sha256: "b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a",
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
  LOCKFILE_PATH,
  PANEL_SOURCE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
]);

const EXPECTED_STRUCTURED_JSON_TEST_NAMES = Object.freeze([
  "returns a detached recursively frozen JSON value without prototype-name interpretation",
  "rejects malformed JSON and non-finite JSON numbers without exposing partial data",
  "rejects duplicate decoded member names at every object level",
  "rejects raw and escaped unpaired Unicode while accepting scalar pairs",
  "keeps every decoded protocol-reserved object member behind M09-T08",
  "enforces Publisher depth, value-count, and number-token boundaries exactly",
  "enforces Publisher decoded-string and raw UTF-8 byte boundaries exactly",
  "formats objects canonically and arrays semantically before exact round trip",
  "keeps a deeply indented admitted value editable through compact fallback",
]);

const EXPECTED_INSPECTOR_T06_TEST_NAMES = Object.freeze([
  "captures exact own-data edit fields before authorization and rejects accessor drift",
  "rejects selection accessors unread and captures a data-descriptor Proxy exactly once",
  "mutates the validator-admitted Source snapshot when a hostile document Proxy drifts",
  "derives nested closed-object groups and edits RFC 6901-escaped child pointers",
  "disambiguates repeated schema titles and names an empty property accessibly",
  "creates an absent optional group with one atomic whole-group set",
  "edits a structured-JSON property while rejecting dynamic marker injection",
  "replaces all props through an honest root structured-JSON fallback",
  "replaces disjoint near-limit root props without exceeding the private transition budget",
  "shrinks an existing near-limit root prop before adding lexically earlier growth",
  "counts only changed root props against the synchronous transition budget",
  "rejects a wide root replacement before public per-prop commands can block the UI",
  "locks only the dynamic child while preserving edits to its literal group sibling",
  "locks whole-group replacement and deletion around an optional dynamic child",
  "treats __proto__ and constructor as exact JSON property names without pollution",
]);

const EXPECTED_PANEL_TEST_NAMES = Object.freeze([
  "exposes recursive groups and leaf controls through qualified accessible names",
  "canonicalizes a successful decimal draft and keeps validation errors inline",
  "shows an honest fallback reason and commits structured JSON only through explicit Apply",
  "rejects %s structured JSON before invoking the edit boundary",
  "hides optional group Unset when the current subtree contains a dynamic value",
  "stages an absent group as complete JSON and dispatches its exact group pointer",
  "offers Unset for an optional structured property but never for the root pointer",
]);

const RETAINED_APPLICATION_TEST_NAMES = Object.freeze([
  "edits schema-derived string and enum props and refreshes the exact adapter preview",
  "preserves the prior Source and preview when Publisher rejects an oversized valid prop",
  "keeps bound props locked while boolean and numeric edits fail or apply atomically",
  "resets local drafts across Source identities and qualifies repeated edit actions",
]);

const RETAINED_PREVIEW_TEST_NAMES = Object.freeze([
  "admits the official-derived Source as the frozen direct reference editor document",
  "reproduces the exact session-local baseline Bundle and official revision",
  "publishes a valid primitive prop edit as a fresh exact Bundle revision",
  "rejects a runtime-cast non-Source without throwing or exposing a partial Bundle",
  "rejects a structurally valid but Catalog-invalid prop edit without a partial Bundle",
]);

/** Exact immutable M09-T05 predecessor receipt for M09-T06. */
export const DESEN_APP_STRUCTURED_INSPECTOR_PARENT_PIN = Object.freeze({
  task: "M09-T05",
  proofId: "desen-app-schema-inspector",
  path: PARENT_ARTIFACT_PATH,
  bytes: 22_998,
  sha256: "473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b",
  profile: "desen.app.schema-inspector-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Reviewed independent root-test names retained by the M09-T06 artifact. */
export const DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact frozen M09-T05 schema-inspector parent",
  "[schema] proves recursive groups, canonical pointers, and the complete fallback matrix",
  "[structured-json] proves strict bounded parsing and deterministic formatting",
  "[mutation] proves nested public Editor Core edits and complete Source revalidation",
  "[safety] locks dynamic values and rejects stale or forged pointer authority",
  "[preview] proves atomic Source and Publisher-backed session replacement",
  "[ownership] keeps structured Inspector chrome outside managed capability subtrees",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects weakened group, fallback, JSON, mutation, and ownership sources",
  "[verification] rejects parent, artifact, report, and filesystem authority drift",
]);

/** Default destination for deterministic M09-T06 evidence. */
export const DEFAULT_DESEN_APP_STRUCTURED_INSPECTOR_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T06 evidence reader. */
export class DesenAppStructuredInspectorProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppStructuredInspectorProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppStructuredInspectorProofError(code, message, details);
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

function canonicalArtifactBytes(artifact) {
  return Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
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
  const options = exactOwnDataOptions(
    value,
    ["fileOverrides", "parentArtifactBytes", "workspaceRoot"],
    "build options",
  );
  return Object.freeze({
    workspaceRoot: capturePath(options.workspaceRoot, "workspaceRoot", WORKSPACE_ROOT),
    fileOverrides: captureOverrides(options.fileOverrides),
    parentArtifactBytes:
      options.parentArtifactBytes === undefined
        ? undefined
        : captureBytes(options.parentArtifactBytes, "parentArtifactBytes"),
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
    if (error instanceof DesenAppStructuredInspectorProofError) throw error;
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
    const override = overrides.get(relativePath);
    if (
      override !== undefined &&
      SELF_RESEALED_PATHS.includes(relativePath) &&
      !isDeepStrictEqual(override, live)
    ) {
      fail("BOUNDARY_DRIFT", `${relativePath} cannot be substituted by a caller.`);
    }
    output.set(relativePath, override ?? live);
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
    fail("JSON_INVALID", `${label} must contain valid JSON.`, { cause: String(error) });
  }
}

function parseTypeScript(rawSource, relativePath) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    rawSource,
    ts.ScriptTarget.ESNext,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${relativePath} has TypeScript parse diagnostics.`);
  }
  return sourceFile;
}

function collectDescendants(node, predicate) {
  const output = [];
  function visit(current) {
    if (predicate(current)) output.push(current);
    ts.forEachChild(current, visit);
  }
  visit(node);
  return output;
}

function functionName(node) {
  if (ts.isFunctionDeclaration(node) && node.name !== undefined) return node.name.text;
  if (ts.isVariableStatement(node)) {
    const declaration = node.declarationList.declarations[0];
    if (declaration !== undefined && ts.isIdentifier(declaration.name)) {
      return declaration.name.text;
    }
  }
  return undefined;
}

function exactFunction(sourceFile, name) {
  const matches = sourceFile.statements.filter((statement) => functionName(statement) === name);
  if (matches.length !== 1) {
    fail("SOURCE_POLICY_VIOLATION", `Expected exactly one ${name} function.`);
  }
  return matches[0];
}

function callNames(sourceFile) {
  return collectDescendants(sourceFile, ts.isCallExpression).map((call) => {
    if (ts.isIdentifier(call.expression)) return call.expression.text;
    if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
    return call.expression.getText(sourceFile);
  });
}

function importModules(sourceFile) {
  return sourceFile.statements.filter(ts.isImportDeclaration).map((declaration) => {
    if (!ts.isStringLiteral(declaration.moduleSpecifier)) {
      fail("SOURCE_POLICY_VIOLATION", "All imports must use literal module specifiers.");
    }
    return Object.freeze({
      module: declaration.moduleSpecifier.text,
      typeOnly: declaration.importClause?.isTypeOnly === true,
    });
  });
}

function assertPublicImports(sourceFile, relativePath, allowedPackages) {
  const imports = importModules(sourceFile);
  const packageImports = imports.filter(({ module }) => module.startsWith("@desen/"));
  const forbidden = packageImports.filter(
    ({ module }) =>
      !allowedPackages.includes(module) || /\/(?:dist|src|test|internal)(?:\/|$)/u.test(module),
  );
  if (forbidden.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${relativePath} imports an unreviewed package surface.`, {
      forbidden,
    });
  }
  return deepFreeze({
    packageImports: packageImports.map(({ module }) => module),
    privatePackageImports: 0,
  });
}

function assertCalls(sourceFile, names, label) {
  const calls = callNames(sourceFile);
  const missing = names.filter((name) => !calls.includes(name));
  if (missing.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} lost required calls.`, { missing });
  }
  return names;
}

function assertIncludes(rawSource, markers, label) {
  const missing = markers.filter((marker) => !rawSource.includes(marker));
  if (missing.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} lost required semantic markers.`, { missing });
  }
}

function assertNoPrivateDomAuthority(rawSource, label, allowLayerDropGeometry = false) {
  const forbidden = ["querySelector(", "elementsFromPoint(", "__react", "ReactDOM.findDOMNode"];
  const rowDropGeometryCalls = rawSource.split("getBoundingClientRect(").length - 1;
  const layerDropRehitCalls = rawSource.split("elementFromPoint(").length - 1;
  if (
    (!allowLayerDropGeometry && rowDropGeometryCalls !== 0) ||
    (allowLayerDropGeometry &&
      (rowDropGeometryCalls !== 5 ||
        !rawSource.includes("function projectNearestDrop(") ||
        !rawSource.includes("rows[hoveredRowIndex]?.getBoundingClientRect()") ||
        !rawSource.includes("row.getBoundingClientRect()") ||
        !rawSource.includes("scrollSurface.getBoundingClientRect()") ||
        !rawSource.includes("const currentBounds = slotSurface.getBoundingClientRect()") ||
        rawSource.split("slotSurface.getBoundingClientRect()").length - 1 !== 1 ||
        rawSource.split("event.currentTarget.getBoundingClientRect()").length - 1 !== 1))
  ) {
    forbidden.push("getBoundingClientRect(");
  }
  if (
    (!allowLayerDropGeometry && layerDropRehitCalls !== 0) ||
    (allowLayerDropGeometry &&
      (layerDropRehitCalls !== 1 ||
        !rawSource.includes("document.elementFromPoint(pending.clientX, pending.clientY)") ||
        !rawSource.includes("hitSlotSurface !== pending.slotSurface")))
  ) {
    forbidden.push("elementFromPoint(");
  }
  if (
    allowLayerDropGeometry &&
    (rawSource.split("slotSurface.closest").length - 1 !== 1 ||
      rawSource.split("slotSurface.closest<HTMLElement>('[data-authoring-pane-scroll=\"layers\"]')")
        .length -
        1 !==
        1)
  ) {
    forbidden.push("slotSurface.closest");
  }
  const found = forbidden.filter((marker) => rawSource.includes(marker));
  if (found.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} acquired private DOM or React authority.`, { found });
  }
}

function inspectAuthoringData(rawSource) {
  const sourceFile = parseTypeScript(rawSource, AUTHORING_DATA_PATH);
  const imports = assertPublicImports(sourceFile, AUTHORING_DATA_PATH, [
    "@desen/catalog-sdk",
    "@desen/editor-core",
    "@desen/reference-catalog-web/catalog.json",
    "@desen/validator",
  ]);
  assertCalls(
    sourceFile,
    ["deriveComponentInspectorControls", "registerComponent"],
    "Authoring data",
  );
  assertIncludes(
    rawSource,
    [
      "readonly inspector: ComponentInspectorControlPlan",
      "readonly validationCatalogs: readonly unknown[]",
      "readonly validationDocument: DesenEditorDocument",
      "const inspector = deriveComponentInspectorControls(",
      "inspector,",
      "validationCatalogs: catalogSet.value",
      "validationDocument: sourceResult.value",
    ],
    "Authoring data",
  );
  return deepFreeze({
    imports,
    publicCatalogSdkDerivation: true,
    exactValidatedCatalogAndSourceProjection: true,
    recursiveControlPlanRetained: true,
    validationCatalogSetRetained: true,
    validationDocumentSnapshotRetained: true,
  });
}

function inspectInspectorSource(rawSource) {
  const sourceFile = parseTypeScript(rawSource, INSPECTOR_SOURCE_PATH);
  const imports = assertPublicImports(sourceFile, INSPECTOR_SOURCE_PATH, [
    "@desen/catalog-sdk",
    "@desen/editor-core",
    "@desen/protocol",
  ]);
  let humanizePropertySource;
  let prepareInspectorFieldsSource;
  let rootTransitionSource;
  let applyInspectorEditSource;
  for (const name of [
    "captureExactOwnData",
    "captureInspectorRoute",
    "captureInspectorSelection",
    "captureInspectorEdit",
    "captureJsonValue",
    "directDynamicValue",
    "nestedDynamicValue",
    "humanizeProperty",
    "prepareInspectorFields",
    "prepareInspectorField",
    "findInspectorField",
    "replaceRootProps",
    "changeNestedProp",
    "prepareAuthoringInspectorModel",
    "applyAuthoringInspectorEdit",
  ]) {
    const declaration = exactFunction(sourceFile, name);
    if (name === "humanizeProperty") humanizePropertySource = declaration.getText(sourceFile);
    if (name === "prepareInspectorFields") {
      prepareInspectorFieldsSource = declaration.getText(sourceFile);
    }
    if (name === "replaceRootProps") rootTransitionSource = declaration.getText(sourceFile);
    if (name === "applyAuthoringInspectorEdit") {
      applyInspectorEditSource = declaration.getText(sourceFile);
    }
  }
  const editorCoreCalls = assertCalls(
    sourceFile,
    [
      "setDesenEditorOwnerProp",
      "deleteDesenEditorOwnerProp",
      "createDesenEditorContinuousValidator",
      "canonicalizeJson",
      "canonicalizeJsonBytes",
      "parseJsonPointer",
    ],
    "Structured inspector",
  );
  assertIncludes(
    humanizePropertySource,
    [".trim()", '? "Unnamed property"'],
    "Inspector empty-property naming",
  );
  assertIncludes(
    prepareInspectorFieldsSource,
    [
      "const labelCounts = new Map<string, number>()",
      '? `${label} (${control.valuePointer || "/"})` : label',
    ],
    "Inspector repeated-label disambiguation",
  );
  assertIncludes(
    applyInspectorEditSource,
    [
      "parseJsonPointer(capturedEdit.valuePointer)",
      "prepared.model.validationDocument",
      "createDesenEditorContinuousValidator(prepared.model.validationCatalogs)",
      "validator.validator.validate(changed)",
      "return Object.freeze({ ok: true, document: changed })",
    ],
    "Historical structured Inspector edit boundary",
  );
  assertIncludes(
    rawSource,
    [
      'control.kind === "group"',
      'control.kind === "structured-json"',
      "prepareInspectorFields(control.children, groupValue, schema",
      "control.valuePointer === valuePointer",
      'captureExactOwnData(route, ["projectId", "surfaceId"])',
      "const fields = captureExactOwnData(selection, [",
      "Reflect.ownKeys(input)",
      "Object.getOwnPropertyDescriptor(input, key)",
      'descriptor?.enumerable !== true || !("value" in descriptor)',
      "parseJsonPointer(capturedEdit.valuePointer)",
      "const MAX_ROOT_PROP_TRANSITIONS = 256",
      "const MAX_ROOT_TRANSITION_WORK_BYTES = 32 * 1024 * 1024",
      "const deletions = Object.keys(currentProps)",
      ".filter((property) => !Object.hasOwn(nextValue, property))",
      "const reducingSets: string[] = []",
      "const growingSets: string[] = []",
      "for (const property of Object.keys(nextValue))",
      "growingSets.push(property)",
      "canonicalizeJson(currentValue) === canonicalizeJson(nextPropertyValue)",
      "canonicalizeJsonBytes(nextPropertyValue).byteLength <=",
      "? reducingSets",
      ": growingSets",
      "const sets = [...reducingSets.sort(), ...growingSets.sort()]",
      "const transitionCount = deletions.length + sets.length",
      "if (transitionCount === 0) return document",
      "if (transitionCount > MAX_ROOT_PROP_TRANSITIONS) return undefined",
      "canonicalizeJsonBytes(document).byteLength + canonicalizeJsonBytes(nextValue).byteLength",
      "snapshotBytes > Math.floor(MAX_ROOT_TRANSITION_WORK_BYTES / transitionCount)",
      'field.value.kind === "dynamic"',
      'field.control.kind === "group" && field.containsDynamicValue',
      "nestedDynamicValue(capturedEdit.value)",
      "prepared.model.validationDocument",
      "createDesenEditorContinuousValidator(prepared.model.validationCatalogs)",
      "validator.validator.validate(changed)",
      '? "Unnamed property"',
      "const labelCounts = new Map<string, number>()",
      '? `${label} (${control.valuePointer || "/"})` : label',
      "return Object.freeze({ ok: true, document: changed })",
    ],
    "Structured inspector",
  );
  const deletionsPlan = rootTransitionSource.indexOf("const deletions = Object.keys(currentProps)");
  const reducingPlan = rootTransitionSource.indexOf("const reducingSets: string[] = []");
  const growingPlan = rootTransitionSource.indexOf("const growingSets: string[] = []");
  const diffLoop = rootTransitionSource.indexOf("for (const property of Object.keys(nextValue))");
  const unchangedComparison = rootTransitionSource.indexOf(
    "canonicalizeJson(currentValue) === canonicalizeJson(nextPropertyValue)",
  );
  const setsPlan = rootTransitionSource.indexOf(
    "const sets = [...reducingSets.sort(), ...growingSets.sort()]",
  );
  const transitionCount = rootTransitionSource.indexOf(
    "const transitionCount = deletions.length + sets.length",
  );
  const noOpReturn = rootTransitionSource.indexOf("if (transitionCount === 0) return document");
  const countBudget = rootTransitionSource.indexOf(
    "if (transitionCount > MAX_ROOT_PROP_TRANSITIONS) return undefined",
  );
  const snapshotBytes = rootTransitionSource.indexOf("const snapshotBytes =");
  const workBudget = rootTransitionSource.indexOf(
    "snapshotBytes > Math.floor(MAX_ROOT_TRANSITION_WORK_BYTES / transitionCount)",
  );
  const candidate = rootTransitionSource.indexOf("let candidate = document");
  const deleteLoop = rootTransitionSource.indexOf("for (const property of deletions)");
  const deleteCall = rootTransitionSource.indexOf(
    "deleteOwnerProp(candidate, selection, property)",
  );
  const setLoop = rootTransitionSource.indexOf("for (const property of sets)");
  const setCall = rootTransitionSource.indexOf("setOwnerProp(candidate, selection, property");
  if (
    deletionsPlan < 0 ||
    reducingPlan <= deletionsPlan ||
    growingPlan <= reducingPlan ||
    diffLoop <= growingPlan ||
    unchangedComparison <= diffLoop ||
    setsPlan <= unchangedComparison ||
    transitionCount <= setsPlan ||
    noOpReturn <= transitionCount ||
    countBudget <= noOpReturn ||
    snapshotBytes <= countBudget ||
    workBudget <= snapshotBytes ||
    candidate <= workBudget ||
    deleteLoop <= candidate ||
    deleteCall <= deleteLoop ||
    setLoop <= deleteCall ||
    setCall <= setLoop
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Root props replacement must budget its diff before deleting then setting changed props.",
    );
  }
  assertNoPrivateDomAuthority(rawSource, "Structured inspector");
  if (rawSource.includes("control.hint") || rawSource.includes("control.hintPointer")) {
    fail("SOURCE_POLICY_VIOLATION", "Opaque Catalog control hints became mutation authority.");
  }
  return deepFreeze({
    imports,
    editorCoreCalls,
    schemaDescriptorAuthority: true,
    recursiveGroupProjection: true,
    canonicalValuePointerReadmission: true,
    nestedTopOwnerRebuild: true,
    deterministicWholePropsTransition: true,
    exactOwnDataEditCapture: true,
    detachedJsonCapture: true,
    dynamicLockBeforeMutation: true,
    dynamicAncestorLockBeforeMutation: true,
    exactOwnDataRouteAndSelectionCapture: true,
    routeSelectionAndControlReadmission: true,
    validatedSourceSnapshotMutation: true,
    rootDeleteBeforeSetTransition: true,
    rootReducingSetsBeforeGrowth: true,
    unchangedRootPropsSkipped: true,
    rootTransitionCountLimit: 256,
    rootTransitionWorkByteLimit: 32 * 1024 * 1024,
    rootTransitionBudgetBeforeEditorCoreLoop: true,
    semanticRootNoOpReturnsValidatedDocument: true,
    accessibleQualifiedNameDisambiguation: true,
    publicEditorCoreOnly: true,
    completeSourceRevalidation: true,
    noPartialDocumentOnFailure: true,
  });
}

function inspectStructuredJsonSource(rawSource) {
  const sourceFile = parseTypeScript(rawSource, STRUCTURED_JSON_SOURCE_PATH);
  const imports = assertPublicImports(sourceFile, STRUCTURED_JSON_SOURCE_PATH, [
    "@desen/catalog-sdk",
    "@desen/publisher",
    "@desen/protocol",
  ]);
  let appendPrettyChunksSource;
  let formatStructuredJsonSource;
  for (const name of [
    "hasUnicodeScalarSequence",
    "measureUtf8Bytes",
    "scanString",
    "scanNumber",
    "scanArray",
    "scanObject",
    "scanValue",
    "scanStructuredJson",
    "parseStructuredJsonText",
    "appendPrettyChunks",
    "appendPrettyJson",
    "formatStructuredJson",
  ]) {
    const declaration = exactFunction(sourceFile, name);
    if (name === "appendPrettyChunks") {
      appendPrettyChunksSource = declaration.getText(sourceFile);
    }
    if (name === "formatStructuredJson") {
      formatStructuredJsonSource = declaration.getText(sourceFile);
    }
  }
  assertCalls(
    sourceFile,
    ["parse", "isFinite", "startsWith", "deepFreezeJson", "canonicalizeJson"],
    "Structured JSON parser",
  );
  const codeUnitIncrement = appendPrettyChunksSource.indexOf("state.codeUnits += chunk.length");
  const codeUnitGuard = appendPrettyChunksSource.indexOf(
    "state.codeUnits > PUBLISH_SOURCE_JSON_LIMITS.maxSourceUtf8Bytes",
  );
  const limitFlag = appendPrettyChunksSource.indexOf("state.limitExceeded = true");
  const chunkClear = appendPrettyChunksSource.indexOf("state.chunks.length = 0");
  const chunkPush = appendPrettyChunksSource.indexOf("state.chunks.push(chunk)");
  const stateCreate = formatStructuredJsonSource.indexOf("const state: PrettyJsonState");
  const prettyAppend = formatStructuredJsonSource.indexOf("appendPrettyJson(value, 0, state)");
  const earlyFallback = formatStructuredJsonSource.indexOf(
    "if (state.limitExceeded) return canonicalizeJson(value)",
  );
  const chunkJoin = formatStructuredJsonSource.indexOf('state.chunks.join("")');
  const exactByteCheck = formatStructuredJsonSource.indexOf("measureUtf8Bytes(formatted)");
  if (
    codeUnitIncrement < 0 ||
    codeUnitGuard <= codeUnitIncrement ||
    limitFlag <= codeUnitGuard ||
    chunkClear <= limitFlag ||
    chunkPush <= chunkClear ||
    stateCreate < 0 ||
    prettyAppend <= stateCreate ||
    earlyFallback <= prettyAppend ||
    chunkJoin <= earlyFallback ||
    exactByteCheck <= chunkJoin
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Pretty formatting must stop and compact-fallback before joining an oversized draft.",
    );
  }
  assertIncludes(
    rawSource,
    [
      "PUBLISH_SOURCE_JSON_LIMITS.maxSourceUtf8Bytes",
      "PUBLISH_SOURCE_JSON_LIMITS.maxDecodedStringCodeUnits",
      "PUBLISH_SOURCE_JSON_LIMITS.maxNumberTokenCodeUnits",
      "PUBLISH_SOURCE_JSON_LIMITS.maxJsonDepth",
      "PUBLISH_SOURCE_JSON_LIMITS.maxJsonValueOccurrences",
      'return "duplicate-member"',
      'key.value.startsWith("$")',
      'return state.dynamicValue ? "dynamic-value" : undefined',
      "interface PrettyJsonState",
      "state.codeUnits += chunk.length",
      "state.codeUnits > PUBLISH_SOURCE_JSON_LIMITS.maxSourceUtf8Bytes",
      "state.limitExceeded = true",
      "state.chunks.length = 0",
      "if (state.limitExceeded) return",
      "Object.keys(object).sort()",
      "const state: PrettyJsonState = { chunks: [], codeUnits: 0, limitExceeded: false }",
      "if (state.limitExceeded) return canonicalizeJson(value)",
      'measureUtf8Bytes(formatted) === "limit-exceeded" ? canonicalizeJson(value) : formatted',
      "Object.freeze({ ok: true, value: deepFreezeJson(parsed as JsonValue) })",
    ],
    "Structured JSON parser",
  );
  assertNoPrivateDomAuthority(rawSource, "Structured JSON parser");
  return deepFreeze({
    imports,
    parserProfile: "strict-bounded-json",
    malformedAndNonFiniteRejected: true,
    duplicateDecodedMembersRejected: true,
    invalidUnicodeRejected: true,
    publisherLimitsEnforced: [
      "maxSourceUtf8Bytes",
      "maxDecodedStringCodeUnits",
      "maxNumberTokenCodeUnits",
      "maxJsonDepth",
      "maxJsonValueOccurrences",
    ],
    dynamicMemberNamesRejected: true,
    detachedRecursivelyFrozenResult: true,
    deterministicPrettyFormatting: true,
    canonicalCompactFallbackForPrettyLimit: true,
    boundedPrettyFormattingConstruction: true,
  });
}

function inspectPanelSource(rawSource) {
  const sourceFile = parseTypeScript(rawSource, PANEL_SOURCE_PATH);
  const imports = assertPublicImports(sourceFile, PANEL_SOURCE_PATH, ["@desen/catalog-sdk"]);
  let textOrNumberFieldSource;
  let structuredJsonFieldSource;
  let inspectorFieldSource;
  const focusManagedFieldSources = [];
  for (const name of [
    "ClearPropertyButton",
    "DynamicField",
    "EnumField",
    "BooleanField",
    "TextOrNumberField",
    "StructuredJsonField",
    "GroupField",
    "InspectorField",
    "InspectorPanel",
  ]) {
    const declaration = exactFunction(sourceFile, name);
    if (
      [
        "DynamicField",
        "EnumField",
        "BooleanField",
        "TextOrNumberField",
        "StructuredJsonField",
        "GroupField",
      ].includes(name)
    ) {
      focusManagedFieldSources.push(declaration.getText(sourceFile));
    }
    if (name === "TextOrNumberField") textOrNumberFieldSource = declaration.getText(sourceFile);
    if (name === "StructuredJsonField") structuredJsonFieldSource = declaration.getText(sourceFile);
    if (name === "InspectorField") inspectorFieldSource = declaration.getText(sourceFile);
  }
  assertCalls(
    sourceFile,
    [
      "parseStructuredJsonText",
      "formatStructuredJson",
      "useMemo",
      "useRef",
      "useCallback",
      "useLayoutEffect",
      "focus",
    ],
    "Inspector panel",
  );
  assertIncludes(
    rawSource,
    [
      "FALLBACK_REASON_LABELS",
      ...FALLBACK_REASON_LABEL_MARKERS,
      "<textarea",
      "aria-invalid={error.length > 0}",
      "Apply JSON",
      "Reset",
      "const current = useMemo(",
      "setDraft(String(value))",
      "field.containsDynamicValue ||",
      "field.children.map((child)",
      "const focusTarget = useRef<HTMLElement | null>(null)",
      "const previousValueKind = useRef(field.value.kind)",
      "const focusTargetRef = useCallback<RefCallback<HTMLElement>>",
      "previousValueKind.current !== field.value.kind",
      "focusTarget.current?.focus({ preventScroll: true })",
      "previousValueKind.current = field.value.kind",
      "const controlledProps = { ...props, focusTargetRef }",
      "key={`${inspector.selection.sourceNodeId}:${field.control.valuePointer}`}",
      "<fieldset",
      "<legend className={styles.visuallyHidden}>{field.qualifiedLabel} group</legend>",
      "tabIndex={-1}",
      'data-control-kind="group"',
      'data-authoring-inspector="true"',
      "This runtime or advanced binding is preserved as read-only.",
    ],
    "Inspector panel",
  );
  if (
    focusManagedFieldSources.length !== 6 ||
    focusManagedFieldSources.some((source) => !source.includes("ref={focusTargetRef}")) ||
    !inspectorFieldSource.includes("useLayoutEffect(() => {") ||
    !inspectorFieldSource.includes("}, [field.value.kind])")
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Stable Inspector fields must hand focus to every replacement control after value-kind changes.",
    );
  }
  const inlineAlertCount = (source) => source.split('role="alert"').length - 1;
  const independentDescriptionMarker =
    ") : null}\n      {field.description === undefined ? null : (";
  if (
    inlineAlertCount(textOrNumberFieldSource) !== 1 ||
    inlineAlertCount(structuredJsonFieldSource) !== 1 ||
    !textOrNumberFieldSource.includes(independentDescriptionMarker) ||
    !structuredJsonFieldSource.includes(independentDescriptionMarker)
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Each draft must expose one inline alert without removing its described help target.",
    );
  }
  assertNoPrivateDomAuthority(rawSource, "Inspector panel");
  if (rawSource.includes("data-managed-capability-subtree")) {
    fail("SOURCE_POLICY_VIOLATION", "Inspector panel entered the managed capability subtree.");
  }
  if (rawSource.includes("control.hint") || rawSource.includes("control.hintPointer")) {
    fail("SOURCE_POLICY_VIOLATION", "Inspector panel treated opaque hints as widget authority.");
  }
  return deepFreeze({
    imports,
    owner: "Desen App",
    semanticContainer: "aside",
    recursiveGroupPresentation: true,
    structuredJsonTextarea: true,
    fallbackReasons: FALLBACK_REASONS,
    parseBeforeEditDispatch: true,
    accessibleErrorAndStatusFeedback: true,
    semanticNestedGroupFieldsets: true,
    memoizedStructuredFormatting: true,
    canonicalNumericDraftAfterCommit: true,
    singleInlineValidationAlertPerDraft: true,
    helpDescriptionRetainedWithInlineError: true,
    dynamicAncestorUnsetHidden: true,
    stableInspectorFieldIdentity: true,
    valueKindFocusHandoff: true,
    semanticReplacementFocusTargets: true,
    dynamicInteractiveControls: 0,
    managedAdapterImports: 0,
  });
}

function inspectPreviewSource(rawSource) {
  const sourceFile = parseTypeScript(rawSource, PREVIEW_SOURCE_PATH);
  const imports = assertPublicImports(sourceFile, PREVIEW_SOURCE_PATH, [
    "@desen/editor-core",
    "@desen/publisher",
    "@desen/reference-catalog-web/catalog.json",
  ]);
  assertCalls(sourceFile, ["publishDesenSource"], "Authoring preview");
  assertIncludes(
    rawSource,
    [
      "createDesenEditorDocument(document)",
      "publishDesenSource(rawSource, REFERENCE_CATALOG_PACKAGES)",
      "bundle: published.bundle",
      "revision: published.bundle.revision",
    ],
    "Authoring preview",
  );
  return deepFreeze({
    imports,
    sourceReadmittedBeforePublication: true,
    publicPublisherOnly: true,
    immutableBundleAndRevisionReturned: true,
    persistenceAuthority: false,
    activationAuthority: false,
  });
}

function inspectSelectionSource(rawSource) {
  const sourceFile = parseTypeScript(rawSource, SELECTION_SOURCE_PATH);
  const imports = assertPublicImports(sourceFile, SELECTION_SOURCE_PATH, ["@desen/runtime-react"]);
  exactFunction(sourceFile, "projectAuthoringSelection");
  return deepFreeze({
    imports,
    validatedModelMembershipRequired: true,
    routeIdentityRequired: true,
    runtimeAuthority: "callback-free diagnostic identity only",
  });
}

function inspectAdapterSource(rawSource) {
  const sourceFile = parseTypeScript(rawSource, ADAPTER_SOURCE_PATH);
  const imports = assertPublicImports(sourceFile, ADAPTER_SOURCE_PATH, [
    "@desen/editor-core",
    "@desen/reference-catalog-web/catalog.json",
    "@desen/reference-catalog-web/react-adapters",
    "@desen/reference-catalog-web/tokens",
    "@desen/runtime-core",
    "@desen/runtime-react",
  ]);
  assertCalls(
    sourceFile,
    ["disposeRuntimeHeadlessSession", "mountRuntimeHeadlessSession", "projectAuthoringSelection"],
    "Adapter canvas",
  );
  assertIncludes(
    rawSource,
    [
      "state.previewRevision !== previewRevision",
      "<SelectionOverlay projection={projection} />",
      'data-managed-capability-subtree="true"',
    ],
    "Adapter canvas",
  );
  if (rawSource.includes("InspectorPanel") || rawSource.includes("StructuredJsonField")) {
    fail("SOURCE_POLICY_VIOLATION", "Managed adapter canvas imported App Inspector chrome.");
  }
  return deepFreeze({
    imports,
    publisherBundleAcceptedAsOpaqueInput: true,
    revisionReplacementDisposesPreviousSession: true,
    selectionOverlayRemainsAppOwnedSibling: true,
    inspectorImports: 0,
  });
}

function inspectApplicationSource(rawSource) {
  const sourceFile = parseTypeScript(rawSource, APPLICATION_SOURCE_PATH);
  const imports = assertPublicImports(sourceFile, APPLICATION_SOURCE_PATH, [
    "@desen/editor-core",
    "@desen/protocol",
    "@desen/reference-catalog-web/catalog.json",
    "@desen/runtime-core",
  ]);
  const editorCoreImports = importModules(sourceFile).filter(
    ({ module }) => module === "@desen/editor-core",
  );
  const editorCoreValueBindings = sourceFile.statements
    .filter(ts.isImportDeclaration)
    .filter(
      (declaration) =>
        ts.isStringLiteral(declaration.moduleSpecifier) &&
        declaration.moduleSpecifier.text === "@desen/editor-core" &&
        declaration.importClause?.isTypeOnly !== true,
    )
    .flatMap((declaration) => {
      const bindings = declaration.importClause?.namedBindings;
      return bindings !== undefined && ts.isNamedImports(bindings)
        ? bindings.elements.map((element) => element.name.text)
        : [];
    });
  if (
    editorCoreImports.length !== 2 ||
    editorCoreImports.filter(({ typeOnly }) => typeOnly).length !== 1 ||
    editorCoreImports.filter(({ typeOnly }) => !typeOnly).length !== 1 ||
    editorCoreValueBindings.length !== 1 ||
    editorCoreValueBindings[0] !== "createDesenEditorContinuousValidator"
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Application may use only the public Editor Core validator and type-only persistence edge.",
    );
  }
  assertCalls(
    sourceFile,
    [
      "applyAuthoringInspectorEdit",
      "prepareAuthoringInspectorModel",
      "prepareAuthoringPreviewBundle",
      "setAuthoringSession",
    ],
    "Application",
  );
  assertIncludes(
    rawSource,
    [
      "const nextPreview = prepareAuthoringPreviewBundle(result.document)",
      "if (!nextPreview.ok)",
      "commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))",
      "<DesenAdapterCanvas",
      "<InspectorPanel",
      "onBindingEdit={editSelectedBinding}",
      "onEdit={editSelectedProperty}",
      "event.currentTarget.getBoundingClientRect()",
    ],
    "Application",
  );
  if (rawSource.indexOf("<InspectorPanel") <= rawSource.indexOf("<DesenAdapterCanvas")) {
    fail("SOURCE_POLICY_VIOLATION", "Inspector composition entered the managed adapter subtree.");
  }
  assertNoPrivateDomAuthority(rawSource, "Application", true);
  return deepFreeze({
    imports,
    documentOwner: "route-keyed SurfaceEditor session state",
    modelAndPreviewDerivedFromSameDocument: true,
    sourceAndPreviewCommitAtomically: true,
    publisherFailurePreservesPriorSession: true,
    inspectorAndCanvasComposedByApp: true,
    inspectorInsideManagedSubtree: false,
    saveAuthority: false,
  });
}

function inspectCssSource(applicationCss, globalCss) {
  for (const selector of [
    ".inspectorPanel",
    ".inspectorGroup",
    ".inspectorGroupChildren",
    ".structuredTextarea",
    ".structuredActions",
    ".structuredMeta",
    ".boundValue",
  ]) {
    if (!applicationCss.includes(selector)) {
      fail("SOURCE_POLICY_VIOLATION", `Inspector presentation lost ${selector}.`);
    }
  }
  if (
    applicationCss.includes("[data-managed-capability-subtree]") ||
    applicationCss.includes("[data-managed-capability-frame]") ||
    globalCss.includes("data-managed-capability")
  ) {
    fail("SOURCE_POLICY_VIOLATION", "App Inspector CSS attempted to target managed descendants.");
  }
  return deepFreeze({
    appOwnedInspectorSelectors: true,
    structuredEditorSelectors: true,
    managedDescendantSelectors: 0,
    responsiveThreePanelWorkspace: applicationCss.includes("grid-template-columns"),
  });
}

/** Applies the exact M09-T06 production source and ownership policy. */
export function verifyDesenAppStructuredInspectorSourcePolicy(rawInput) {
  const keys = [
    "adapterSource",
    "applicationSource",
    "applicationCss",
    "authoringDataSource",
    "globalCss",
    "inspectorSource",
    "panelSource",
    "previewSource",
    "selectionSource",
    "structuredJsonSource",
  ];
  const input = exactOwnDataOptions(rawInput, keys, "source policy input");
  for (const key of keys) {
    if (typeof input[key] !== "string" || input[key].includes("\0")) {
      fail("SOURCE_POLICY_VIOLATION", `${key} must be exact source text.`);
    }
  }
  return deepFreeze({
    authoringData: inspectAuthoringData(input.authoringDataSource),
    inspector: inspectInspectorSource(input.inspectorSource),
    structuredJson: inspectStructuredJsonSource(input.structuredJsonSource),
    preview: inspectPreviewSource(input.previewSource),
    selection: inspectSelectionSource(input.selectionSource),
    panel: inspectPanelSource(input.panelSource),
    adapter: inspectAdapterSource(input.adapterSource),
    application: inspectApplicationSource(input.applicationSource),
    css: inspectCssSource(input.applicationCss, input.globalCss),
  });
}

function collectTestNames(rawSource, relativePath) {
  const sourceFile = parseTypeScript(rawSource, relativePath);
  return collectDescendants(sourceFile, ts.isCallExpression)
    .filter((call) => {
      const direct =
        ts.isIdentifier(call.expression) && ["it", "test"].includes(call.expression.text);
      const parameterized =
        ts.isCallExpression(call.expression) &&
        ts.isPropertyAccessExpression(call.expression.expression) &&
        ts.isIdentifier(call.expression.expression.expression) &&
        ["it", "test"].includes(call.expression.expression.expression.text) &&
        call.expression.expression.name.text === "each";
      return (
        (direct || parameterized) &&
        call.arguments.length > 0 &&
        ts.isStringLiteral(call.arguments[0])
      );
    })
    .map((call) => call.arguments[0].text);
}

function requireTestNames(actual, expected, relativePath) {
  const missing = expected.filter((name) => !actual.includes(name));
  if (missing.length !== 0) {
    fail("TEST_POLICY_VIOLATION", `${relativePath} lost required tests.`, { missing });
  }
}

function inspectTests(files) {
  const sources = new Map(
    APP_TEST_PATHS.map((relativePath) => [
      relativePath,
      decodeUtf8(files.get(relativePath), relativePath),
    ]),
  );
  const names = Object.fromEntries(
    [...sources].map(([relativePath, rawSource]) => [
      relativePath,
      collectTestNames(rawSource, relativePath),
    ]),
  );
  requireTestNames(
    names[STRUCTURED_JSON_TEST_PATH],
    EXPECTED_STRUCTURED_JSON_TEST_NAMES,
    STRUCTURED_JSON_TEST_PATH,
  );
  requireTestNames(
    names[INSPECTOR_TEST_PATH],
    EXPECTED_INSPECTOR_T06_TEST_NAMES,
    INSPECTOR_TEST_PATH,
  );
  requireTestNames(names[PANEL_TEST_PATH], EXPECTED_PANEL_TEST_NAMES, PANEL_TEST_PATH);
  requireTestNames(names[PREVIEW_TEST_PATH], RETAINED_PREVIEW_TEST_NAMES, PREVIEW_TEST_PATH);
  requireTestNames(
    names[APPLICATION_TEST_PATH],
    RETAINED_APPLICATION_TEST_NAMES,
    APPLICATION_TEST_PATH,
  );

  const inspectorTest = sources.get(INSPECTOR_TEST_PATH);
  const panelTest = sources.get(PANEL_TEST_PATH);
  const structuredJsonTest = sources.get(STRUCTURED_JSON_TEST_PATH);
  assertIncludes(
    inspectorTest,
    [
      "valuePointer",
      "additionalProperties: false",
      'kind: "group"',
      '"structured-json"',
      "applyAuthoringInspectorEdit(",
      "const normalizedNoOp = requireEditSuccess(",
      'value: { label: "Before", keep: true }',
      "$ref",
    ],
    "Inspector tests",
  );
  assertIncludes(
    panelTest,
    [
      "ComponentInspectorFallbackReason",
      "Apply Options JSON",
      "aria-invalid",
      "createJsonPointer",
      "expect(document.activeElement).toBe(group)",
      'expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Settings JSON" }))',
      'expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Options JSON" }))',
    ],
    "Inspector panel tests",
  );
  assertIncludes(
    structuredJsonTest,
    [
      "duplicate-member",
      "invalid-unicode",
      "limit-exceeded",
      "dynamic-value",
      "PUBLISH_SOURCE_JSON_LIMITS.maxJsonDepth",
      "PUBLISH_SOURCE_JSON_LIMITS.maxSourceUtf8Bytes",
    ],
    "Structured JSON tests",
  );

  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:structured-inspector && node --test tests/desen-app-structured-inspector.test.mjs",
    appTestNames: names,
    rootTestNames: DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES,
    semanticCoverage: [
      "RECURSIVE_GROUPS",
      "RFC6901_POINTERS",
      "COMPLETE_FALLBACK_MATRIX",
      "STRICT_JSON_CAPTURE",
      "EXACT_ROUTE_SELECTION_CAPTURE",
      "VALIDATED_SOURCE_SNAPSHOT_MUTATION",
      "ROOT_DELETE_BEFORE_SET",
      "ROOT_TRANSITION_DIFF_AND_WORK_BUDGET",
      "SEMANTIC_ROOT_NOOP_NORMALIZATION",
      "DYNAMIC_VALUE_LOCK",
      "DYNAMIC_ANCESTOR_LOCK",
      "CONTINUOUS_REVALIDATION",
      "ACCESSIBLE_QUALIFIED_NAMES",
      "SEMANTIC_GROUP_FIELDSETS",
      "INLINE_DRAFT_VALIDATION",
      "BOUNDED_PRETTY_FORMATTING",
      "VALUE_KIND_FOCUS_HANDOFF",
      "ATOMIC_PUBLISHER_PREVIEW",
      "APP_OWNED_INSPECTOR",
    ],
  });
}

function inspectPackages(files) {
  const root = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const appCommand =
    "vitest run test/structured-json.test.ts test/authoring-inspector.test.ts test/inspector-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  if (app.scripts?.["test:structured-inspector"] !== appCommand) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact App structured-inspector test command drifted.");
  }
  const prefix =
    "node scripts/verify-desen-app-schema-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:structured-inspector && ";
  const expectedRootCommands = {
    "generate:desen-app-structured-inspector": `${prefix}node scripts/generate-desen-app-structured-inspector-proof.mjs`,
    "verify:desen-app-structured-inspector": `${prefix}node scripts/verify-desen-app-structured-inspector.mjs`,
    "test:desen-app-structured-inspector": `${prefix}node --test tests/desen-app-structured-inspector.test.mjs`,
  };
  for (const [name, command] of Object.entries(expectedRootCommands)) {
    if (root.scripts?.[name] !== command) {
      fail("PACKAGE_POLICY_VIOLATION", `The exact ${name} command drifted.`);
    }
  }
  if (app.dependencies?.["@desen/protocol"] !== "workspace:*") {
    fail("PACKAGE_POLICY_VIOLATION", "The App lost its public protocol dependency.");
  }
  return deepFreeze({
    appName: app.name,
    appTestCommand: appCommand,
    rootCommands: expectedRootCommands,
    directParentVerifiers: ["node scripts/verify-desen-app-schema-inspector.mjs"],
    publicProtocolDependency: true,
  });
}

function authenticateParent(bytes) {
  const pin = DESEN_APP_STRUCTURED_INSPECTOR_PARENT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", "The exact frozen M09-T05 parent artifact changed.");
  }
  const artifact = parseJson(bytes, "frozen M09-T05 parent artifact");
  if (
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.schemaDerivedPrimitiveAndEnumControls !== true ||
    artifact.claim?.publicEditorCoreAtomicMutation !== true ||
    artifact.claim?.continuousSchemaRevalidation !== true ||
    artifact.claim?.dynamicValuesLocked !== true ||
    artifact.claim?.structuredValuesLocked !== true ||
    artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact.claim?.inspectorOutsideManagedCapabilitySubtree !== true
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T05 identity or retained claims drifted.");
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

const CURRENT_SUCCESSOR_SHA256 = Object.freeze({
  [ROOT_PACKAGE_PATH]: "ba0affa5c1be20d04b41d55b10170a066090e709afbb5445f9d40565d961282d",
  [APP_PACKAGE_PATH]: "bf39a240b872fb4ef422fa93a4f124907cbcac61359bf8139ea3f684b4420f22",
  [AUTHORING_DATA_PATH]: "ae18d9ea0fe37ee553e758a73a9ca2e54e97c7fbcf048c21cd3bd131aadc1b25",
  [INSPECTOR_SOURCE_PATH]: "76c1bebae33c41b175558bd8c4e1d392a28f86e97e0895863b13df1320d421b2",
  [STRUCTURED_JSON_SOURCE_PATH]: "74c56059e2cdca1ae018424f27e1c28c54785bbbc89c75d25dfa1858b76c4759",
  [PANEL_SOURCE_PATH]: "9ff88328b2b9a29cb67844aa525953f321e757225ff2026e5feb90d1efe148fb",
  [AUTHORING_SLOT_SOURCE_PATH]: "7e41cc2c4e8f9da91a7737160619836a8f61dc9445f3b2c118fd0793a6dc405b",
  [EVENT_ACTION_SOURCE_PATH]: "052933b73bc240ca8f856831eace2fed04dd4ece4ecf272fb108c71303c59897",
  [EVENT_ACTION_PANEL_PATH]: "f5adef07f00504dc55282c3bf5b8c9421b8078e061cba66a7bea9c7e4e482888",
  [APPLICATION_SOURCE_PATH]: "02805bba2932467d15d96b58860ac80069fdea9a1fad82b2b5997334be8d4037",
  [APPLICATION_CSS_PATH]: "74808172a6fdb2b81ca3a7f994692db0e541fa870cac6afd5e4c33311ca93309",
  [AUTHORING_DATA_TEST_PATH]: "ac69505e2391db6ad61ad18f82ac9b6f699b2aebb2b0367f2c497335f6a08bcd",
  [INSPECTOR_TEST_PATH]: "3037926ac89677c412a25e455407becfe67475aa9cb3ec6b5f511cfe50f212fc",
  [STRUCTURED_JSON_TEST_PATH]: "254f2f2e6c0a5f1fce72e7881c1b94d7d501fb8be08be693c66e1256e28ba827",
  [AUTHORING_SLOT_TEST_PATH]: "93c6b850c235ab09308fb36b9f99d6a5715d28514374c5c709a3c1eacb729ab2",
  [PANEL_TEST_PATH]: "0c891415e34a29bf74baa4e211f82a46243c5dd8091b702d2ad558b24e1590f6",
  [EVENT_ACTION_TEST_PATH]: "933fb29e7227eb7d3b6f2a3d3050b47ac5cc41361fd81441ace7aa424d2e1e80",
  [EVENT_ACTION_PANEL_TEST_PATH]:
    "a5c59eda21ed571fa1531630ac9160046d24587f5045466c21a4dd5e69af0bb9",
  [APPLICATION_TEST_PATH]: "203eca1931f586e81785aaf191e5588b0c8e1e188648d7c2ca5317da1257757f",
  [NAMED_SLOT_ARTIFACT_PATH]: "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f",
  [STATE_BINDING_ARTIFACT_PATH]: "b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a",
});

async function authenticateFrozenArtifact(workspaceRoot) {
  const artifactBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_PATH),
    "frozen M09-T06 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T06 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T06 proof artifact");
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-structured-inspector" ||
    artifact?.profile !== "desen.app.structured-inspector-proof.v1" ||
    artifact?.task !== "M09-T06" ||
    artifact?.result !== "PASS" ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.recursiveClosedObjectControls !== true ||
    artifact?.claim?.strictBoundedStructuredJsonCapture !== true ||
    artifact?.claim?.publicEditorCoreNestedMutation !== true ||
    artifact?.claim?.dynamicValuesLocked !== true ||
    artifact?.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact?.claim?.inspectorOutsideManagedCapabilitySubtree !== true ||
    artifact?.claim?.p08Status !== "NOT_PROVEN" ||
    artifact?.boundary?.trackedFiles !== TRACKED_PATHS.length ||
    !Array.isArray(trackedReceipts) ||
    trackedReceipts.length !== TRACKED_PATHS.length ||
    !isDeepStrictEqual(
      trackedReceipts.map((candidate) => candidate?.path),
      [...TRACKED_PATHS].sort((left, right) => left.localeCompare(right, "en-US")),
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
      DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES,
    )
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T06 artifact identity or retained claims drifted.");
  }
  return deepFreeze({
    artifact,
    artifactBytes: Buffer.from(artifactBytes),
    artifactSha256: FROZEN_ARTIFACT_PIN.sha256,
  });
}

function assertRetainedHistoricalReceipts(frozenArtifact, files) {
  const taskTimeReceipts = reviewedSuccessorReceiptMap(frozenArtifact.boundary.trackedReceipts);
  for (const relativePath of RETAINED_HISTORICAL_PATHS) {
    if (M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.includes(relativePath)) continue;
    const authority = taskTimeReceipts.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      authority === undefined ||
      bytes === undefined ||
      authority.bytes !== bytes.byteLength ||
      authority.sha256 !== sha256(bytes)
    ) {
      fail("BOUNDARY_DRIFT", `A retained M09-T06 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

function authenticateStateBindingSuccessorArtifact(files) {
  const artifactBytes = files.get(STATE_BINDING_ARTIFACT_PATH);
  if (
    artifactBytes.byteLength !== STATE_BINDING_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== STATE_BINDING_ARTIFACT_PIN.sha256
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact frozen M09-T08 artifact bytes drifted.");
  }
  const artifact = parseJson(artifactBytes, STATE_BINDING_ARTIFACT_PATH);
  const namedSlotParent = Array.isArray(artifact.prerequisites)
    ? artifact.prerequisites.find(({ proofId }) => proofId === NAMED_SLOT_ARTIFACT_PIN.proofId)
    : undefined;
  const requiredNonclaims = [
    "Repeat and resource-binding UI are not implemented or claimed by M09-T08.",
    "M09-T09 is NOT_PROVEN: event and closed-action editing are not implemented.",
    "M09-T10 is NOT_PROVEN: no Design/Run mode is claimed.",
    "M09-T12 is NOT_PROVEN: no save/open or durable persistence UI is claimed.",
    "M09-T14 is NOT_PROVEN: session preview is not control-plane publication or activation.",
    "G09 and browser E2E remain NOT_PROVEN.",
  ];
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== STATE_BINDING_ARTIFACT_PIN.task ||
    artifact.proofId !== STATE_BINDING_ARTIFACT_PIN.proofId ||
    artifact.profile !== STATE_BINDING_ARTIFACT_PIN.profile ||
    artifact.result !== STATE_BINDING_ARTIFACT_PIN.result ||
    namedSlotParent?.bytes !== NAMED_SLOT_ARTIFACT_PIN.bytes ||
    namedSlotParent?.sha256 !== NAMED_SLOT_ARTIFACT_PIN.sha256 ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.surfaceLocalPrimitiveStateList !== true ||
    artifact.claim?.primitiveStateAddUpdateDelete !== true ||
    !isDeepStrictEqual(artifact.claim?.primitiveStateTypes, [
      "boolean",
      "integer",
      "number",
      "string",
    ]) ||
    artifact.claim?.boundedConservativeUsageCount !== true ||
    artifact.claim?.usedStateDeleteRejected !== true ||
    artifact.claim?.directCompatibleLocalStatePropBinding !== true ||
    artifact.claim?.exactDirectBindingChange !== true ||
    artifact.claim?.exactDirectBindingDetachToInitial !== true ||
    artifact.claim?.runtimeAndAdvancedBindingReadOnly !== true ||
    artifact.claim?.advancedStateSchemaReadOnly !== true ||
    artifact.claim?.exactOwnDataStateAndBindingCapture !== true ||
    artifact.claim?.publicEditorCoreStateAndPropMutation !== true ||
    artifact.claim?.continuousCompleteSourceRevalidation !== true ||
    artifact.claim?.failedEditPreservesCurrentDocument !== true ||
    artifact.claim?.publisherSessionPreview !== true ||
    artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact.claim?.stateAndBindingChromeOutsideManagedCapabilitySubtree !== true ||
    artifact.claim?.retainedNamedSlotAuthoringUxCompatibility !== true ||
    artifact.claim?.persistenceClaimed !== false ||
    artifact.claim?.eventActionEditingClaimed !== false ||
    artifact.claim?.designRunClaimed !== false ||
    artifact.claim?.activationClaimed !== false ||
    artifact.claim?.browserE2eClaimed !== false ||
    artifact.claim?.p08Status !== "NOT_PROVEN" ||
    !Array.isArray(artifact.nonclaims) ||
    requiredNonclaims.some((nonclaim) => !artifact.nonclaims.includes(nonclaim))
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T08 identity or claims drifted.");
  }
  return deepFreeze({
    task: STATE_BINDING_ARTIFACT_PIN.task,
    artifact: STATE_BINDING_ARTIFACT_PIN,
    predecessorArtifact: NAMED_SLOT_ARTIFACT_PIN,
    surfaceLocalPrimitiveStateEditing: true,
    boundedUsageCounts: true,
    usedStateDeleteRejected: true,
    exactCompatibleDirectLocalStateBindingChangeAndDetach: true,
    runtimeAndAdvancedBindingsReadOnly: true,
    atomicPublisherBackedPreview: true,
    retainedNamedSlotAuthoringUxCompatibility: true,
    eventActionEditingImplemented: false,
    designRunImplemented: false,
    persistenceImplemented: false,
    activationImplemented: false,
    browserE2eImplemented: false,
  });
}

function inspectStateBindingSuccessor(files) {
  for (const [relativePath, expectedSha256] of Object.entries(CURRENT_SUCCESSOR_SHA256)) {
    if (
      M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS.includes(relativePath) ||
      M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.includes(relativePath) ||
      T11_LIVE_RECEIPT_PATHS.includes(relativePath) ||
      T12_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) ||
      T13_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) ||
      T14_SUCCESSOR_RECEIPT_PATHS.includes(relativePath)
    ) {
      continue;
    }
    const bytes = files.get(relativePath);
    if (matchesReviewedEditorWorkplaneSuccessor(relativePath, bytes)) continue;
    if (bytes === undefined || sha256(bytes) !== expectedSha256) {
      fail("SUCCESSOR_POLICY_VIOLATION", `${relativePath} exact reviewed T08 bytes drifted.`);
    }
  }
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const root = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const namedSlotTestCommand =
    "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  const rootPrefix =
    "node scripts/verify-desen-app-structured-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:named-slots && ";
  const rootCommands = {
    "generate:desen-app-named-slot-authoring": `${rootPrefix}node scripts/generate-desen-app-named-slot-authoring-proof.mjs`,
    "verify:desen-app-named-slot-authoring": `${rootPrefix}node scripts/verify-desen-app-named-slot-authoring.mjs`,
    "test:desen-app-named-slot-authoring": `${rootPrefix}node --test tests/desen-app-named-slot-authoring.test.mjs`,
  };
  const stateBindingTestCommand =
    "vitest run test/structured-json.test.ts test/authoring-state.test.ts test/authoring-inspector.test.ts test/state-panel.test.tsx test/inspector-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  const stateBindingPrefix =
    "node scripts/verify-desen-app-schema-inspector.mjs && node scripts/verify-editor-core-state-binding-edits.mjs && node scripts/verify-desen-app-named-slot-authoring.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:state-bindings && ";
  const stateBindingRootCommands = {
    "generate:desen-app-state-binding-editor": `${stateBindingPrefix}node scripts/generate-desen-app-state-binding-editor-proof.mjs`,
    "verify:desen-app-state-binding-editor": `${stateBindingPrefix}node scripts/verify-desen-app-state-binding-editor.mjs`,
    "test:desen-app-state-binding-editor": `${stateBindingPrefix}node --test tests/desen-app-state-binding-editor.test.mjs`,
  };
  const eventActionCommand =
    "vitest run test/structured-json.test.ts test/authoring-data.test.ts test/authoring-selection.test.ts test/authoring-event-actions.test.ts test/event-action-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  const eventActionPrefix =
    "node scripts/verify-desen-app-state-binding-editor.mjs && node scripts/verify-editor-core-event-action-edits.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:event-actions && ";
  const eventActionRootCommands = {
    "generate:desen-app-event-action-editor": `${eventActionPrefix}node scripts/generate-desen-app-event-action-editor-proof.mjs`,
    "verify:desen-app-event-action-editor": `${eventActionPrefix}node scripts/verify-desen-app-event-action-editor.mjs`,
    "test:desen-app-event-action-editor": `${eventActionPrefix}node --test tests/desen-app-event-action-editor.test.mjs`,
  };
  if (
    app.scripts?.["test:named-slots"] !== namedSlotTestCommand ||
    app.scripts?.["test:state-bindings"] !== stateBindingTestCommand ||
    app.scripts?.["test:event-actions"] !== eventActionCommand ||
    Object.entries(rootCommands).some(([name, command]) => root.scripts?.[name] !== command) ||
    Object.entries(stateBindingRootCommands).some(
      ([name, command]) => root.scripts?.[name] !== command,
    ) ||
    Object.entries(eventActionRootCommands).some(
      ([name, command]) => root.scripts?.[name] !== command,
    )
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact retained or additive successor package command drifted.",
    );
  }
  const markers = new Map([
    [
      AUTHORING_DATA_PATH,
      [
        "export interface AuthoringSlotContract",
        "projectSlotContracts",
        "readonly defaultProps",
        'Object.hasOwn(slot, "minItems")',
      ],
    ],
    [
      AUTHORING_SLOT_SOURCE_PATH,
      [
        "createAuthoringSlotSelection",
        "projectAuthoringSlotSelection",
        "evaluateAuthoringSlotInsertion",
        "evaluateAuthoringSlotPlacement",
        "evaluateAuthoringNodeDeletion",
        "applyAuthoringSlotEdit",
        "applyAuthoringNodeDelete",
        "createDesenEditorContinuousValidator",
        "deleteDesenEditorNode",
        "insertDesenEditorNode",
        "moveDesenEditorNode",
        "reorderDesenEditorNode",
        "setDesenEditorOwnerProp",
        "maxDefaultPropTransitions: 256",
        "maxAggregateSnapshotWorkBytes: 33_554_432",
      ],
    ],
    [
      EVENT_ACTION_SOURCE_PATH,
      [
        'readonly ownerKind: "component"',
        'fields.ownerKind !== "component"',
        "createDesenEditorContinuousValidator",
        "deleteDesenEditorAction",
        "deleteDesenEditorEventHandler",
        "insertDesenEditorAction",
        "insertDesenEditorEventHandler",
        "reorderDesenEditorAction",
        "replaceDesenEditorAction",
        "escapeJsonPointerToken",
        "prepareCatalogAuthoringModel(catalogValue, document)",
      ],
    ],
    [
      EVENT_ACTION_PANEL_PATH,
      [
        "parseInertJsonText",
        "formatStructuredJson",
        "export function EventActionPanel(",
        'aria-label="Selected event component"',
        "Select a component to inspect its Catalog-declared events.",
      ],
    ],
    [
      INSPECTOR_SOURCE_PATH,
      [
        "applyAuthoringInspectorBindingEdit",
        "captureInspectorBindingEdit",
        "isAuthoringInspectorStateCompatible",
        'field.value.kind === "dynamic" && currentStateName === undefined',
      ],
    ],
    [
      PANEL_SOURCE_PATH,
      [
        "ValueSourceControl",
        "isAuthoringInspectorStateCompatible",
        "This runtime or advanced binding is preserved as read-only.",
      ],
    ],
    [
      STRUCTURED_JSON_SOURCE_PATH,
      ["PUBLISH_SOURCE_JSON_LIMITS", "parseInertJsonText", "deepFreezeJson"],
    ],
    [
      APPLICATION_SOURCE_PATH,
      [
        "applyAuthoringInspectorBindingEdit",
        "applyAuthoringStateEdit",
        "prepareAuthoringStateModel",
        "stateControls={",
        "createAuthoringSlotSelection",
        "evaluateAuthoringSlotInsertion",
        "evaluateAuthoringSlotPlacement",
        "evaluateAuthoringNodeDeletion",
        "applyAuthoringSlotEdit",
        "applyAuthoringNodeDelete",
        "type AuthoringDropAdmission =",
        "function evaluateDragIntent(",
        "interface AuthoringDragSession {",
        "function createAuthoringDragSession(epoch = 0): AuthoringDragSession",
        "const dragSession = useRef<AuthoringDragSession>(createAuthoringDragSession())",
        "dragSession.current = createAuthoringDragSession(current.epoch + 1)",
        "function projectNearestDrop(",
        "Math.abs(clientY - midpoint) <= LAYER_DROP_MIDPOINT_HYSTERESIS_PX",
        "const [activeDropProjection, setActiveDropProjection] = useState<AuthoringDropProjection | null>",
        "const projectDrop = useCallback((next: AuthoringDropProjection | null) =>",
        "onProjectDrop={projectDrop}",
        "const sessionOwnerKey = JSON.stringify([target.ownerKind, target.ownerId, target.slot])",
        "pending.sessionEpoch !== currentSession.epoch",
        "pending.ownerKey !== currentSession.ownerKey",
        "const scrollSurface = slotSurface.closest<HTMLElement>('[data-authoring-pane-scroll=\"layers\"]')",
        "const currentBounds = slotSurface.getBoundingClientRect()",
        "event.stopPropagation();\n    const admission = projectNearestDrop(list, event.clientY, event.target);",
        'interaction.dragSession.current.admission === "accepted"',
        "interaction.dragSession.current.lastAcceptedProjection",
        'releaseAdmission.status === "rejected"',
        'admission.status === "noop"\n        ? "none"',
        'data-drop-noop-hovered={dragAdmission?.status === "noop" && dropHovered}',
        '"Current position"',
        "function clearUnclaimedDrop(): void {",
        "className={styles.componentsView}",
        "panelDragEnterDepth.current += 1",
        'if (!componentDropReady) return;\n    event.stopPropagation();\n    event.preventDefault();\n    event.dataTransfer.dropEffect = "copy";',
        "className={styles.componentSlotTarget}",
        "onDragEnter={enterComponentDrop}",
        "onDragLeave={leaveComponentDrop}",
        "onDragOver={admitComponentDrop}",
        "onDrop={receiveComponentDrop}",
        "onDragEnter={onBoundaryDragEnter}",
        "onDragOver={onBoundaryDragOver}",
        "onDrop={onBoundaryDrop}",
        'data-slot-boundary-hit-area="true"',
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
        'if (result.operation === "insert" && edit.kind === "insert" && preparedModel.ok)',
        "sourceNodeId: result.nodeId",
        "data-active-slot={active}",
        'event.dataTransfer.setData("text/plain", "DESEN App authoring item")',
        "applyAuthoringEventActionEdit",
        "prepareAuthoringEventActionModel",
        "function editSelectedEventAction(",
        "const nextPreview = prepareAuthoringPreviewBundle(result.document)",
        "commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))",
        "<EventActionPanel",
      ],
    ],
    [
      APPLICATION_CSS_PATH,
      [
        ".valueSourceControl",
        ".statePanel",
        ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 1.25rem;\n  align-items: center;\n  padding: 0 0.125rem;",
        ".slotBoundaryHitArea {\n  position: absolute;\n  inset: 0;\n  z-index: 5;\n  pointer-events: none;",
        '.slotBoundary[data-drop-ready="true"] .slotBoundaryHitArea,\n.slotBoundary[data-drop-noop="true"] .slotBoundaryHitArea {\n  pointer-events: auto;',
        '.slotBoundary[data-drop-hovered="true"]::before',
        '.slotBoundary[data-drop-noop-hovered="true"]::before',
        ".layerDragGuide {",
        ".componentSlotTarget {\n  position: sticky;\n  top: 0.25rem;\n  z-index: 4;\n  display: flex;\n  min-height: 4rem;",
        ".componentItem {",
        ".componentDragHandle {\n  position: relative;\n  width: 2rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.1875rem -0.25rem;",
        ".layerDragHandle {\n  position: relative;\n  width: 1.75rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.25rem;",
        ".layerDragHandle::before",
        '.componentsView[data-component-drag-active="true"]',
        ".componentAddAction {",
        ".inspectorTabs {",
        ".eventActionPanel {",
      ],
    ],
    [
      APPLICATION_TEST_PATH,
      [
        "snaps a native layer drag to the before or after half of a visible layer row",
        "uses the release position when it crosses a row midpoint after the last dragover",
        "keeps the admitted gap stable while the pointer jitters around a row midpoint",
        "keeps edge scrolling through a no-op gap, re-hit-tests, and fences a stale frame",
        "uses only the App-owned drag intent and ignores forged native transfer authority",
        "Stack sign-in.layout default slot insertion boundary at position 1",
        "updates surface-local state and changes a compatible binding in the live preview",
        "Bound Value to state.password.",
        'name: "Delete Alert layer · node.alert"',
        "commits sign-in event handlers and complete actions through the live authoring session",
        "keeps the prior event projection and canvas when action preview preflight fails",
        'vi.spyOn(authoringPreview, "prepareAuthoringPreviewBundle")',
      ],
    ],
    [
      AUTHORING_SLOT_TEST_PATH,
      [
        "inserts reference components with exact defaults and deterministic collision IDs",
        "projects a declared-but-absent slot with effective min/max semantics",
        "moves across component and behavior owners without changing the node",
        "rejects one insert or move into an absent optional minItems:2 slot",
        "finishes a cross-owner move across 1,024 sibling nodes",
        "never invokes accessors on hostile selection or edit objects",
        "removes a newly inserted nested subtree and preserves the owning slot plus prior siblings",
        "deletes from a behavior-owned slot and retains its own empty slot key",
        "disables root deletion and deletion across the owning slot minimum",
        "deletes the final node from a 1,024-sibling slot within the bounded profile",
        "captures deletion selections as exact own data and rejects cross-route authority",
      ],
    ],
    [
      EVENT_ACTION_TEST_PATH,
      [
        "creates exact component owner references and rejects forged behavior values",
        "maps all six App edits one-to-one to immutable Editor Core transitions",
        "projects every member of the seven-action union including nested settlements",
      ],
    ],
    [
      EVENT_ACTION_PANEL_TEST_PATH,
      [
        "shows the selected component and Catalog events, then adds and deletes an exact handler",
        "offers all seven complete-action starters and preserves a $ref on insert",
        "reports local JSON and edit failures accessibly without losing the draft",
      ],
    ],
  ]);
  for (const [relativePath, requiredMarkers] of markers) {
    const source = decodeUtf8(files.get(relativePath), relativePath);
    for (const marker of requiredMarkers) {
      if (!source.includes(marker)) {
        fail("SUCCESSOR_POLICY_VIOLATION", `${relativePath} lost the T07 marker ${marker}.`);
      }
    }
  }
  const applicationSource = decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH);
  for (const handler of [
    "onDragEnter={enterComponentDrop}",
    "onDragLeave={leaveComponentDrop}",
    "onDragOver={admitComponentDrop}",
    "onDrop={receiveComponentDrop}",
  ]) {
    if (applicationSource.split(handler).length - 1 !== 2) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `Both the Components panel fallback and sticky target must own ${handler}.`,
      );
    }
  }
  for (const handler of [
    "onDragEnter={onBoundaryDragEnter}",
    "onDragOver={onBoundaryDragOver}",
    "onDrop={onBoundaryDrop}",
  ]) {
    if (applicationSource.split(handler).length - 1 !== 1) {
      fail("SUCCESSOR_POLICY_VIOLATION", `Each slot boundary must directly own ${handler}.`);
    }
  }
  for (const retiredMarker of [
    "function acceptsDragIntent(",
    "flushSync",
    "draggable={enabled}",
    "draggable={movable}",
    'title="Drag anywhere in this panel to add"',
  ]) {
    if (applicationSource.includes(retiredMarker)) {
      fail("SUCCESSOR_POLICY_VIOLATION", `The retired drag marker returned: ${retiredMarker}.`);
    }
  }
  const applicationCss = decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH);
  if (
    applicationCss.includes("margin-block: -1.125rem") ||
    applicationCss.includes("transition: min-height") ||
    applicationCss.includes("margin-block: -0.875rem")
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The live slot boundaries overlap or animate geometry.");
  }
  const artifactBytes = files.get(NAMED_SLOT_ARTIFACT_PATH);
  const artifact = parseJson(artifactBytes, NAMED_SLOT_ARTIFACT_PATH);
  if (
    artifactBytes.byteLength !== NAMED_SLOT_ARTIFACT_PIN.bytes ||
    artifact.task !== NAMED_SLOT_ARTIFACT_PIN.task ||
    artifact.proofId !== NAMED_SLOT_ARTIFACT_PIN.proofId ||
    artifact.profile !== NAMED_SLOT_ARTIFACT_PIN.profile ||
    artifact.result !== NAMED_SLOT_ARTIFACT_PIN.result ||
    artifact.claim?.completeCatalogDeclaredSlotProjection !== true ||
    artifact.claim?.absentAndEmptySlotsRemainDistinct !== true ||
    artifact.claim?.sourceMinimumEnforced !== true ||
    artifact.claim?.destinationMaximumEnforced !== true ||
    artifact.claim?.absentDestinationMinimumEnforced !== true ||
    artifact.claim?.publicStableIdInsert !== true ||
    artifact.claim?.publicCrossSlotMove !== true ||
    artifact.claim?.publicSameSlotReorder !== true ||
    artifact.claim?.nodeDeletionPreflight !== true ||
    artifact.claim?.deletionPreflightRunsPublicMutationAndValidation !== true ||
    artifact.claim?.publicNestedSubtreeDelete !== true ||
    artifact.claim?.rootDeletionDisabled !== true ||
    artifact.claim?.sourceMinimumDeletionDisabled !== true ||
    artifact.claim?.behaviorOwnedDeletePreservesEmptySlot !== true ||
    artifact.claim?.exactOwnDataRouteSelectionAndEditCapture !== true ||
    artifact.claim?.exactOwnDataDeletionSelectionCapture !== true ||
    artifact.claim?.continuousCompleteSourceRevalidation !== true ||
    artifact.claim?.failedDeletionPreservesCurrentDocument !== true ||
    artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact.claim?.deletionSourceAndPreviewCommitAtomically !== true ||
    artifact.claim?.deletionFocusManaged !== true ||
    artifact.claim?.browserDataTransferReadsZero !== true ||
    artifact.claim?.expandedDropReadyBoundaries !== true ||
    artifact.claim?.stableNestedDragHover !== true ||
    artifact.claim?.explicitComponentDropTargetGuide !== true ||
    artifact.claim?.keyboardPlacementControl !== true ||
    artifact.claim?.insertionAdmissionCachedPerModelAndExactTarget !== true ||
    artifact.claim?.placementAdmissionCachedPerModelAndExactTarget !== true ||
    artifact.claim?.cachedPlacementBaseMaterializesBoundaryFinalIndex !== true ||
    artifact.claim?.componentPaletteRenderLimit !== 24 ||
    artifact.claim?.activeTabOnlyAuthoringWork !== true ||
    artifact.claim?.slotChromeOutsideManagedCapabilitySubtree !== true
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T07 artifact identity or claims drifted.");
  }
  const stateBinding = authenticateStateBindingSuccessorArtifact(files);
  return deepFreeze({
    ...stateBinding,
    completeCatalogDeclaredSlotProjection: true,
    absentAndEmptySlotsRemainDistinct: true,
    catalogAdmissionAndCardinalityPreflight: true,
    publicStableIdInsertMoveAndReorder: true,
    publicValidatedNodeDeletion: true,
    deletionPreflightRunsPublicMutationAndValidation: true,
    rootAndSourceMinimumDeletionDisabled: true,
    behaviorOwnedDeletePreservesEmptySlot: true,
    exactOwnDataDeletionSelectionCapture: true,
    continuousCompleteSourceRevalidation: true,
    failedDeletionPreservesCurrentDocument: true,
    deletionSourceAndPreviewCommitAtomically: true,
    deletionFocusManaged: true,
    browserDataTransferReadsZero: true,
    expandedDropReadyBoundaries: true,
    stableNestedDragHover: true,
    explicitComponentDropTargetGuide: true,
    keyboardPlacementControl: true,
    insertionAdmissionCachedPerModelAndExactTarget: true,
    placementAdmissionCachedPerModelAndExactTarget: true,
    cachedPlacementBaseMaterializesBoundaryFinalIndex: true,
    componentPaletteRenderLimit: 24,
    splitAuthoringPanesAlwaysRendered: true,
    nodeAndBehaviorOwnersSupported: true,
    exactOwnDataRouteSelectionAndEditCapture: true,
    atomicPublisherBackedSlotEdits: true,
    slotChromeOutsideManagedCapabilitySubtree: true,
    dynamicValuesRemainLocked: true,
    nonOverlappingStableSlotBoundaries: true,
    rowHalfDropTargets: true,
    stickyComponentTargetSummary: true,
    stableGlobalLayerDragSession: true,
    globalLayerOwnerAndEpochFencing: true,
    stableCompactLayerGaps: true,
    guardedLastAcceptedProjection: true,
    releaseDriftRetainsLastAcceptedProjection: true,
    nestedSlotSurfaceOwnsDropEvents: true,
    explicitNoOpPlacementFeedback: true,
    componentDragAuthorityLimitedToDedicatedHandle: true,
    dedicatedLayerDragHandle: true,
    componentPanelWideDropSurface: true,
    stickyComponentTargetSummaryOnly: false,
    stickyComponentTargetOwnsDropHandlers: true,
    separateNonDraggableComponentAddAction: true,
    successfulInsertionSelectsNewLayer: true,
    package: {
      appName: app.name,
      namedSlotTestCommand,
      rootCommands,
      stateBindingTestCommand,
      stateBindingRootCommands,
      eventActionTestCommand: eventActionCommand,
      eventActionRootCommands,
    },
  });
}

/** Builds detached deterministic M09-T06 structured-inspector evidence. */
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
  const appPackage = parseJson(
    files.get("apps/desen-app/package.json"),
    "apps/desen-app/package.json",
  );
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
  const receiptMap = reviewedSuccessorReceiptMap(trackedReceipts);
  for (const relativePath of T12_SUCCESSOR_RECEIPT_PATHS) {
    if (
      M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS.includes(relativePath) ||
      M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.includes(relativePath) ||
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

function authenticateFixturesScenariosSuccessor(files) {
  const artifactBytes = files.get(FIXTURES_SCENARIOS_ARTIFACT_PATH);
  if (
    artifactBytes.byteLength !== FIXTURES_SCENARIOS_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FIXTURES_SCENARIOS_ARTIFACT_PIN.sha256
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T11 artifact bytes drifted.");
  }
  const artifact = parseJson(artifactBytes, FIXTURES_SCENARIOS_ARTIFACT_PATH);
  const parent = artifact.prerequisites?.[0];
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  if (
    artifact.task !== FIXTURES_SCENARIOS_ARTIFACT_PIN.task ||
    artifact.proofId !== FIXTURES_SCENARIOS_ARTIFACT_PIN.proofId ||
    artifact.profile !== FIXTURES_SCENARIOS_ARTIFACT_PIN.profile ||
    artifact.result !== FIXTURES_SCENARIOS_ARTIFACT_PIN.result ||
    parent?.task !== "M09-T10" ||
    parent?.bytes !== 17_900 ||
    parent?.sha256 !== "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334" ||
    artifact.claim?.scenarioSourceAndBundleEphemeral !== true ||
    artifact.claim?.pendingRuntimeLifecycleExercised !== true ||
    artifact.claim?.exactOperationAndPreviewContextAuthorization !== true ||
    artifact.claim?.operationInputOrPasswordRetained !== false ||
    artifact.claim?.stableAppOwnedOperationPort !== true ||
    artifact.claim?.s001Status !== "TESTED" ||
    artifact.claim?.pf028Status !== "CLOSED" ||
    artifact.tests?.focusedTestCases !== 86 ||
    !Array.isArray(trackedReceipts)
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T11 artifact identity or claims drifted.");
  }
  const receiptMap = reviewedSuccessorReceiptMap(trackedReceipts);
  for (const relativePath of T11_LIVE_RECEIPT_PATHS) {
    if (
      M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS.includes(relativePath) ||
      M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.includes(relativePath) ||
      T12_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) ||
      T13_SUCCESSOR_RECEIPT_PATHS.includes(relativePath)
    ) {
      continue;
    }
    const authority = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      authority === undefined ||
      bytes === undefined ||
      authority.bytes !== bytes.byteLength ||
      authority.sha256 !== sha256(bytes)
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", `The live M09-T11 receipt drifted: ${relativePath}.`);
    }
  }
  return deepFreeze({
    task: FIXTURES_SCENARIOS_ARTIFACT_PIN.task,
    artifact: FIXTURES_SCENARIOS_ARTIFACT_PIN,
    exactDesignRunParent: true,
    scenariosEphemeral: true,
    pendingRuntimeLifecycleExercised: true,
    exactOperationAndPreviewContextAuthorization: true,
    operationInputOrPasswordRetained: false,
    stableAppOwnedOperationPort: true,
    focusedTestCases: 86,
    s001Status: "TESTED",
    pf028Status: "CLOSED",
  });
}

async function _buildFreshDesenAppStructuredInspectorEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  const parent = authenticateParent(options.parentArtifactBytes ?? files.get(PARENT_ARTIFACT_PATH));
  const source = verifyDesenAppStructuredInspectorSourcePolicy({
    authoringDataSource: decodeUtf8(files.get(AUTHORING_DATA_PATH), AUTHORING_DATA_PATH),
    inspectorSource: decodeUtf8(files.get(INSPECTOR_SOURCE_PATH), INSPECTOR_SOURCE_PATH),
    structuredJsonSource: decodeUtf8(
      files.get(STRUCTURED_JSON_SOURCE_PATH),
      STRUCTURED_JSON_SOURCE_PATH,
    ),
    previewSource: decodeUtf8(files.get(PREVIEW_SOURCE_PATH), PREVIEW_SOURCE_PATH),
    selectionSource: decodeUtf8(files.get(SELECTION_SOURCE_PATH), SELECTION_SOURCE_PATH),
    panelSource: decodeUtf8(files.get(PANEL_SOURCE_PATH), PANEL_SOURCE_PATH),
    adapterSource: decodeUtf8(files.get(ADAPTER_SOURCE_PATH), ADAPTER_SOURCE_PATH),
    applicationSource: decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    applicationCss: decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH),
    globalCss: decodeUtf8(files.get(GLOBAL_CSS_PATH), GLOBAL_CSS_PATH),
  });
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const trackedReceipts = receipts(files);
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-structured-inspector",
    profile: "desen.app.structured-inspector-proof.v1",
    task: "M09-T06",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: [parent],
    claim: {
      taskStatus: "DONE",
      recursiveClosedObjectControls: true,
      canonicalRfc6901Pointers: true,
      completeFallbackReasonMatrix: true,
      structuredJsonFallbackVisibleAndEditable: true,
      strictBoundedStructuredJsonCapture: true,
      duplicateMembersAndInvalidUnicodeRejected: true,
      publisherJsonLimitsEnforced: true,
      admittedStructuredJsonRemainsEditableAtPrettyLimit: true,
      boundedPrettyFormattingConstruction: true,
      publicEditorCoreNestedMutation: true,
      exactOwnDataEditCommandCapture: true,
      exactOwnDataRouteAndSelectionCapture: true,
      validatedSourceSnapshotMutation: true,
      completeTopLevelOwnerRebuild: true,
      rootPropsTransitionDeterministic: true,
      rootPropsDeleteBeforeSet: true,
      rootPropsShrinkBeforeGrowth: true,
      unchangedRootPropsSkipped: true,
      boundedSynchronousRootTransitions: true,
      semanticRootNoOpSucceedsWithValidatedDocument: true,
      continuousSchemaRevalidation: true,
      failedEditPreservesCurrentDocument: true,
      dynamicValuesLocked: true,
      dynamicAncestorGroupsLocked: true,
      controlHintsRemainOpaque: true,
      staleRouteSelectionAndPointerRejected: true,
      accessibleDuplicateAndEmptyPropertyNames: true,
      semanticNestedGroupFieldsets: true,
      memoizedStructuredFormatting: true,
      canonicalNumericDraftWithInlineErrors: true,
      describedHelpRetainedWithInlineErrors: true,
      valueKindReplacementFocusHandoff: true,
      stableInspectorFieldIdentity: true,
      publisherSessionPreview: true,
      exactPreviewRevisionReplacement: true,
      sourceAndPreviewCommitAtomically: true,
      publisherFailurePreservesPriorSession: true,
      inspectorOutsideManagedCapabilitySubtree: true,
      selectionOverlayBoundaryRetained: true,
      persistenceClaimed: false,
      activationClaimed: false,
      browserE2eClaimed: false,
      p08Status: "NOT_PROVEN",
    },
    authority: {
      fallback: {
        reasons: FALLBACK_REASONS,
        schemaAuthority: "component.propsSchema",
        hintsAuthority: "opaque top-level sidecar only",
        referenceCatalogHasNestedFallbackFixture: false,
        syntheticAppTestsRequired: true,
      },
      source,
    },
    application: {
      package: packageContract,
      mutationFlow: [
        "validated Catalog/Source projection",
        "route-valid Source selection",
        "recursive schema control and pointer readmission",
        "strict structured JSON capture when required",
        "public Editor Core top-level owner transition",
        "continuous complete-Source validation",
        "Publisher session-local Bundle",
        "atomic Source and exact adapter session replacement",
      ],
      ownership: {
        inspector: "Desen App sibling chrome",
        selectionOverlay: "Desen App sibling chrome retained from M09-T04",
        managedCapabilitySubtree: "Runtime React adapters only",
      },
    },
    tests,
    boundary: {
      trackedFiles: TRACKED_PATHS.length,
      trackedReceipts,
      proofReaderPaths: PROOF_READER_PATHS,
      parentArtifacts: 1,
      immutableInputs: true,
      sourceSymlinksRejected: true,
    },
    result: "PASS",
    nonclaims: [
      "M09-T08 is NOT_PROVEN: dynamic state and binding values remain locked.",
      "M09-T10 is NOT_PROVEN: no Design/Run mode is claimed.",
      "M09-T12 is NOT_PROVEN: no save/open or durable persistence UI is claimed.",
      "M09-T14 is NOT_PROVEN: session preview is not control-plane publication or activation.",
      "P-08 remains NOT_PROVEN until the complete visual authoring scope and browser E2E owner pass.",
      "No private DOM, component geometry, hit testing, canvas picking, or managed-tree inspection is claimed.",
      "No required-gate or hosted-CI pass is inferred from local evidence.",
    ],
  });
  const artifactBytes = canonicalArtifactBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
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
  const receiptMap = reviewedSuccessorReceiptMap(trackedReceipts);
  for (const relativePath of T13_SUCCESSOR_RECEIPT_PATHS) {
    if (
      M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS.includes(relativePath) ||
      M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.includes(relativePath) ||
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
  const receiptMap = reviewedSuccessorReceiptMap(trackedReceipts);
  for (const relativePath of T14_SUCCESSOR_RECEIPT_PATHS) {
    if (
      M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS.includes(relativePath) ||
      M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.includes(relativePath)
    ) {
      continue;
    }
    const receipt = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (relativePath === T14_PUBLICATION_APPLICATION_TEST_PATH) {
      const liveSource = bytes?.toString("utf8") ?? "";
      const timeoutSuffix = "}, 10_000);";
      const frozenBytes = Buffer.from(liveSource.replace(timeoutSuffix, "});"));
      if (
        receipt?.bytes !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
        receipt.sha256 !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256 ||
        bytes?.byteLength !== T14_LIVE_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
        sha256(bytes) !== T14_LIVE_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256 ||
        liveSource.split(timeoutSuffix).length - 1 !== 1 ||
        frozenBytes.byteLength !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
        sha256(frozenBytes) !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256
      ) {
        fail("SUCCESSOR_POLICY_VIOLATION", `The live M09-T14 receipt drifted: ${relativePath}.`);
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

/** Authenticates frozen M09-T06 evidence and checks its live additive M09-T08 successor. */
function authenticateM10VisualBehaviorAuthoringSuccessor(
  files,
  evergreenProductCompositionSuccessor,
) {
  const artifactBytes = files.get(M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH);
  const pin = M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PIN;
  if (
    artifactBytes?.byteLength !== pin.bytes ||
    sha256(artifactBytes ?? Buffer.alloc(0)) !== pin.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact immutable M10-T01B visual-behavior artifact drifted.",
    );
  }
  const artifact = parseJson(
    artifactBytes,
    M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH,
    "SUCCESSOR_POLICY_VIOLATION",
  );
  const predecessor = artifact?.prerequisites?.[0];
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-visual-behavior-authoring" ||
    artifact?.profile !== "desen.app.visual-behavior-authoring-proof.v1" ||
    artifact?.task !== "M10-T01B" ||
    artifact?.gate !== null ||
    artifact?.result !== "PASS" ||
    !isDeepStrictEqual(artifact?.claim, {
      taskStatus: "DONE",
      p08Status: "PROVEN",
      p09Status: "PARTIAL",
      visualInputConnectionCovered: true,
      visualOperationActionCovered: true,
      visualConditionalPresenceCovered: true,
      catalogDerivedRunControlsCovered: true,
      advancedJsonRetained: true,
      authoredBrowserSmokeCovered: true,
      m10T02Closed: false,
      m10T03Closed: false,
      m10T04Closed: false,
      realHostOperationCovered: false,
      remoteDeploymentCovered: false,
      g10Closed: false,
    }) ||
    predecessor?.task !== "M10-T01A" ||
    predecessor?.gate !== null ||
    predecessor?.proofId !== "desen-app-user-created-blank-project" ||
    predecessor?.path !== M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH ||
    predecessor?.bytes !== M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PIN.bytes ||
    predecessor?.sha256 !== M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PIN.sha256 ||
    predecessor?.profile !== "desen.app.user-created-blank-project-proof.v1" ||
    predecessor?.result !== "PASS" ||
    predecessor?.immutable !== true ||
    artifact?.authority?.source?.atomicInputConnection !== true ||
    artifact?.authority?.source?.operationTriggerBoundary !== true ||
    artifact?.authority?.source?.visualActionComposer !== true ||
    artifact?.authority?.source?.advancedJsonRetained !== true ||
    artifact?.authority?.source?.visualConditionalPresence !== true ||
    artifact?.authority?.source?.sourceAndCatalogDerivedFixtures !== true ||
    artifact?.authority?.source?.genericRunControls !== true ||
    artifact?.authority?.source?.requestInputRetained !== false ||
    artifact?.authority?.package?.appPackageName !== "@desen/app-web" ||
    artifact?.authority?.package?.browserPackageName !== "@desen/app-browser-e2e" ||
    artifact?.authority?.package?.exactHeadBrowserExecution !== true ||
    artifact?.authority?.package?.catalogFixtureOnly !== true ||
    artifact?.authority?.execution?.browserExecutedByVerifier !== false ||
    artifact?.authority?.execution?.deterministicReaderStartsListener !== false ||
    artifact?.tests?.browserExecutedByVerifier !== false ||
    artifact?.boundary?.trackedFiles !== M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.length ||
    !Array.isArray(trackedReceipts) ||
    trackedReceipts.length !== M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.length ||
    !isDeepStrictEqual(
      trackedReceipts.map((receipt) => receipt?.path),
      M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS,
    ) ||
    new Set(trackedReceipts.map((receipt) => receipt?.path)).size !==
      M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.length ||
    !isDeepStrictEqual(artifact?.boundary?.checkpointOwnedReaderPaths, [
      "scripts/lib/desen-app-visual-behavior-authoring-proof.mjs",
      "tests/desen-app-visual-behavior-authoring.test.mjs",
    ])
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The immutable M10-T01B identity, claims, authority, or receipt manifest drifted.",
    );
  }
  for (const receipt of trackedReceipts) {
    if (
      !Number.isSafeInteger(receipt?.bytes) ||
      receipt.bytes < 0 ||
      typeof receipt.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(receipt.sha256)
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", "The M10-T01B receipt manifest is malformed.");
    }
    const bytes = files.get(receipt.path);
    if (
      evergreenProductCompositionSuccessor === null &&
      (bytes?.byteLength !== receipt.bytes || sha256(bytes ?? Buffer.alloc(0)) !== receipt.sha256)
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `The exact current M10-T01B receipt drifted: ${receipt.path}.`,
      );
    }
  }
  const hostedBrowserReceipt = M10_VISUAL_BEHAVIOR_AUTHORING_HOSTED_BROWSER_COMPATIBILITY_RECEIPT;
  const hostedBrowserBytes = files.get(hostedBrowserReceipt.path);
  if (
    evergreenProductCompositionSuccessor === null &&
    (hostedBrowserBytes?.byteLength !== hostedBrowserReceipt.bytes ||
      sha256(hostedBrowserBytes ?? Buffer.alloc(0)) !== hostedBrowserReceipt.sha256)
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact M10-T01B hosted-browser compatibility receipt drifted.",
    );
  }
  return deepFreeze({
    task: artifact.task,
    evergreenProductCompositionSuccessor,
    artifact: {
      path: M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH,
      ...pin,
      immutable: true,
    },
    predecessor: { ...predecessor },
    currentProjection: {
      relationship: "EXACT_M10_T01B_ARTIFACT_OWNED_LIVE_RECEIPTS",
      currentReceipts: trackedReceipts,
      hostedBrowserCompatibility: {
        compatibilityReceipt: "M10-T01B-HOSTED-BROWSER-COMPAT",
        correctiveReceiptOnly: true,
        overriddenHistoricalPaths: [hostedBrowserReceipt.path],
        trackedReceipts: [hostedBrowserReceipt],
      },
    },
    p08Status: artifact.claim.p08Status,
    p09Status: artifact.claim.p09Status,
    visualInputConnectionCovered: artifact.claim.visualInputConnectionCovered,
    visualOperationActionCovered: artifact.claim.visualOperationActionCovered,
    visualConditionalPresenceCovered: artifact.claim.visualConditionalPresenceCovered,
    catalogDerivedRunControlsCovered: artifact.claim.catalogDerivedRunControlsCovered,
    advancedJsonRetained: artifact.claim.advancedJsonRetained,
    authoredBrowserSmokeCovered: artifact.claim.authoredBrowserSmokeCovered,
    m10T02Closed: artifact.claim.m10T02Closed,
    g10Closed: artifact.claim.g10Closed,
  });
}

export async function buildDesenAppStructuredInspectorEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const evergreenProductCompositionSuccessor =
    await authenticateDesenAppEvergreenProductCompositionSuccessor();
  const historicalFileOverrides = materializeDesenAppHistoricalReaderFileOverrides(
    evergreenProductCompositionSuccessor,
    options.fileOverrides,
  );
  const workspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files] = await Promise.all([
    authenticateFrozenArtifact(workspaceRoot),
    readTrackedFiles(workspaceRoot, historicalFileOverrides),
  ]);
  if (options.fileOverrides.size === 0 && options.parentArtifactBytes === undefined) {
    return deepFreeze({
      ...frozen,
      currentCompatibility: readDesenAppHistoricalReaderProjection(
        evergreenProductCompositionSuccessor,
        "desen-app-structured-inspector",
      ),
    });
  }
  const userCreatedBlankProjectSuccessor = authenticateM10UserCreatedBlankProjectSuccessor(
    files,
    null,
  );
  const visualBehaviorAuthoringSuccessor = authenticateM10VisualBehaviorAuthoringSuccessor(
    files,
    null,
  );
  const parent = authenticateParent(options.parentArtifactBytes ?? files.get(PARENT_ARTIFACT_PATH));
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const successor = inspectStateBindingSuccessor(files);
  const fixturesScenariosSuccessor = authenticateFixturesScenariosSuccessor(files);
  const sourcePersistenceSuccessor = authenticateSourcePersistenceSuccessor(files);
  const nodeLinkedDiagnosticsSuccessor = authenticateNodeLinkedDiagnosticsSuccessor(files);
  const publishActivationSuccessor = authenticatePublishActivationSuccessor(files);
  const emptyProjectBrowserE2eSuccessor = authenticateM10EmptyProjectBrowserE2eSuccessor(files);
  const currentCompatibility = deepFreeze({
    emptyProjectBrowserE2eSuccessor,
    userCreatedBlankProjectSuccessor,
    visualBehaviorAuthoringSuccessor,
    schemaVersion: 1,
    proofId: "desen-app-structured-inspector",
    profile: "desen.app.structured-inspector-proof.v1",
    task: "M09-T06",
    result: "PASS",
    prerequisites: [parent],
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      recursiveClosedObjectControls: frozen.artifact.claim.recursiveClosedObjectControls,
      strictBoundedStructuredJsonCapture: frozen.artifact.claim.strictBoundedStructuredJsonCapture,
      publicEditorCoreNestedMutation: frozen.artifact.claim.publicEditorCoreNestedMutation,
      exactOwnDataRouteAndSelectionCapture:
        frozen.artifact.claim.exactOwnDataRouteAndSelectionCapture,
      continuousSchemaRevalidation: frozen.artifact.claim.continuousSchemaRevalidation,
      failedEditPreservesCurrentDocument: frozen.artifact.claim.failedEditPreservesCurrentDocument,
      dynamicValuesLocked: frozen.artifact.claim.dynamicValuesLocked,
      publisherSessionPreview: frozen.artifact.claim.publisherSessionPreview,
      sourceAndPreviewCommitAtomically: frozen.artifact.claim.sourceAndPreviewCommitAtomically,
      inspectorOutsideManagedCapabilitySubtree:
        frozen.artifact.claim.inspectorOutsideManagedCapabilitySubtree,
      selectionOverlayBoundaryRetained: frozen.artifact.claim.selectionOverlayBoundaryRetained,
    },
    successor,
    fixturesScenariosSuccessor,
    sourcePersistenceSuccessor,
    nodeLinkedDiagnosticsSuccessor,
    publishActivationSuccessor,
    boundary: {
      retainedHistoricalReceipts: RETAINED_HISTORICAL_PATHS.length,
      successorCompatibilityPaths: SUCCESSOR_COMPATIBILITY_PATHS.length,
      currentPathReceipts: receipts(files),
      additiveSuccessorReceipts: [
        AUTHORING_SLOT_SOURCE_PATH,
        AUTHORING_DATA_TEST_PATH,
        AUTHORING_SLOT_TEST_PATH,
        NAMED_SLOT_ARTIFACT_PATH,
        STATE_BINDING_ARTIFACT_PATH,
        EVENT_ACTION_SOURCE_PATH,
        EVENT_ACTION_PANEL_PATH,
        EVENT_ACTION_TEST_PATH,
        EVENT_ACTION_PANEL_TEST_PATH,
        FIXTURES_SCENARIOS_ARTIFACT_PATH,
      ].map((relativePath) => ({
        path: relativePath,
        bytes: files.get(relativePath).byteLength,
        sha256: sha256(files.get(relativePath)),
      })),
    },
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
    "Task: M09-T06",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "M09-T08: NOT_PROVEN",
    "M09-T10: NOT_PROVEN",
    "M09-T12: NOT_PROVEN",
    "M09-T14: NOT_PROVEN",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ]) {
    if (!text.includes(required)) {
      fail("PROOF_DOCUMENT_DRIFT", `Proof document is missing ${required}.`);
    }
  }
}

/** Verifies committed M09-T06 bytes and the visible report digest. */
export async function verifyDesenAppStructuredInspectorEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppStructuredInspectorEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_STRUCTURED_INSPECTOR_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T06 artifact bytes differ from fresh evidence.");
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
    p08Status: built.artifact.claim.p08Status,
  });
}

/** Atomically writes exact deterministic M09-T06 proof bytes. */
export async function writeDesenAppStructuredInspectorEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_STRUCTURED_INSPECTOR_ARTIFACT_PATH,
  );
  const built = await buildDesenAppStructuredInspectorEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T06 artifact write failed safely.", {
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
