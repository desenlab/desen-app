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
const M10_VISUAL_BEHAVIOR_AUTHORING_HOSTED_BROWSER_COMPATIBILITY_RECEIPT = Object.freeze({
  path: "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
  bytes: 15_143,
  sha256: "5fcdc7f312bb2ef45e747499e50bf31f2dfae8e1c1b82963176d99eb8bb8395b",
});
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
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-NAMED-SLOT-AUTHORING.md";
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
const PARENT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const SOURCE_FIXTURE_PATH = "examples/sign-in/official-derived.source.desen.json";
const BUNDLE_FIXTURE_PATH = "examples/sign-in/official-derived.bundle.desen.json";
const AUTHORING_DATA_PATH = "apps/desen-app/src/authoring-data.ts";
const SLOT_SOURCE_PATH = "apps/desen-app/src/authoring-slots.ts";
const PREVIEW_SOURCE_PATH = "apps/desen-app/src/authoring-preview.ts";
const ADAPTER_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const APPLICATION_CSS_PATH = "apps/desen-app/src/application.module.css";
const AUTHORING_DATA_TEST_PATH = "apps/desen-app/test/authoring-data.test.ts";
const SLOT_TEST_PATH = "apps/desen-app/test/authoring-slots.test.ts";
const PREVIEW_TEST_PATH = "apps/desen-app/test/authoring-preview.test.ts";
const ADAPTER_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
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

function authenticateM10UserCreatedBlankProjectSuccessor(files) {
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

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-named-slot-authoring-proof.mjs",
  "scripts/generate-desen-app-named-slot-authoring-proof.mjs",
  "scripts/verify-desen-app-named-slot-authoring.mjs",
  "tests/desen-app-named-slot-authoring.test.mjs",
]);

const SOURCE_PATHS = Object.freeze([
  AUTHORING_DATA_PATH,
  SLOT_SOURCE_PATH,
  PREVIEW_SOURCE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
]);

const APP_TEST_PATHS = Object.freeze([
  AUTHORING_DATA_TEST_PATH,
  SLOT_TEST_PATH,
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
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
  "scripts/lib/desen-app-named-slot-authoring-proof.mjs",
  "tests/desen-app-named-slot-authoring.test.mjs",
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
    STATE_BINDING_ARTIFACT_PATH,
    FIXTURES_SCENARIOS_ARTIFACT_PATH,
    SOURCE_PERSISTENCE_ARTIFACT_PATH,
    NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
    PUBLISH_ACTIVATION_ARTIFACT_PATH,
    ...T13_SUCCESSOR_RECEIPT_PATHS,
    ...T14_SUCCESSOR_RECEIPT_PATHS,
    ...T12_SUCCESSOR_RECEIPT_PATHS,
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
  "scripts/lib/desen-app-named-slot-authoring-proof.mjs",
  "tests/desen-app-named-slot-authoring.test.mjs",
]);

const FROZEN_ARTIFACT_PIN = Object.freeze({
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
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
]);

const EXPECTED_AUTHORING_DATA_TEST_NAMES = Object.freeze([
  "projects the exact Catalog library and official Source surface trees",
  "preserves absent slots, own empty slots, and Source child-array order",
]);

const EXPECTED_SLOT_TEST_NAMES = Object.freeze([
  "projects the selected slot and captures an exact frozen selection",
  "inserts reference components with exact defaults and deterministic collision IDs",
  "removes a newly inserted nested subtree and preserves the owning slot plus prior siblings",
  "$label",
  "preflights and rejects a move into the moving node's descendant slot",
  "projects a declared-but-absent slot with effective min/max semantics",
  "implements ID/category OR, unrestricted, explicit-empty, and max acceptance",
  "disables inserts whose Catalog defaults fail schema or bounded transition admission",
  "moves across component and behavior owners without changing the node",
  "deletes from a behavior-owned slot and retains its own empty slot key",
  "rejects crossing a source minimum or destination maximum atomically",
  "disables root deletion and deletion across the owning slot minimum",
  "rejects one insert or move into an absent optional minItems:2 slot",
  "fails closed when a minimal insert cannot materialize the component's own required slot",
  "finishes a cross-owner move across 1,024 sibling nodes",
  "deletes the final node from a 1,024-sibling slot within the bounded profile",
  "rejects stale and forged selections without mutating Source",
  "rejects cross-route and extra-field inputs",
  "never invokes accessors on hostile selection or edit objects",
  "captures deletion selections as exact own data and rejects cross-route authority",
  "rejects deletion with a %s",
  "captures every edit Proxy own descriptor exactly once",
]);

const EXPECTED_PREVIEW_TEST_NAMES = Object.freeze([
  "publishes a valid primitive prop edit as a fresh exact Bundle revision",
  "rejects a structurally valid but Catalog-invalid prop edit without a partial Bundle",
]);

const EXPECTED_ADAPTER_TEST_NAMES = Object.freeze([
  "replaces the exact session when a current authoring draft Bundle is rerendered",
  "renders Source-identity selection chrome as a sibling outside the managed subtree",
]);

const EXPECTED_APPLICATION_TEST_NAMES = Object.freeze([
  "renders the editable Source hierarchy and keeps the exact managed adapter canvas read only",
  "chooses an exact named-slot target and inserts Catalog defaults into Source and preview",
  "disables deletion for the surface root and a slot-minimum preflight without changing preview",
  "preserves the selected layer, preview, and focus when deletion is rejected",
  "uses only the App-owned drag intent and ignores forged native transfer authority",
  "snaps a native layer drag to the before or after half of a visible layer row",
  "keeps edge scrolling through a no-op gap, re-hit-tests, and fences a stale frame",
  "reorders a selected Source node through the keyboard placement control",
  "moves nodes across nested slots with keyboard and App-owned native drag intent",
  "keeps Components and Layers visible while filtering the exact local Catalog view",
]);

/** Exact immutable M09-T06 predecessor receipt for M09-T07. */
export const DESEN_APP_NAMED_SLOT_AUTHORING_PARENT_PIN = Object.freeze({
  task: "M09-T06",
  proofId: "desen-app-structured-inspector",
  path: PARENT_ARTIFACT_PATH,
  bytes: 26_133,
  sha256: "6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec",
  profile: "desen.app.structured-inspector-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Reviewed independent root-test names retained by the M09-T07 artifact. */
export const DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact frozen M09-T06 structured-inspector parent",
  "[catalog] proves PF-010 slot projection, presence, cardinality, and acceptance",
  "[editing] proves public insert, move, reorder, delete, identity, and index semantics",
  "[safety] proves exact capture, bounded defaults, deletion minima, and complete Source validation",
  "[ownership] keeps expanded drag targets, deletion UI, and slot chrome App-owned",
  "[tests] pins focused App behavior and exact package commands",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects weakened slot, mutation, bound, and ownership sources",
  "[verification] rejects parent, artifact, report, and filesystem authority drift",
]);

/** Default destination for deterministic M09-T07 evidence. */
export const DEFAULT_DESEN_APP_NAMED_SLOT_AUTHORING_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T07 evidence reader. */
export class DesenAppNamedSlotAuthoringProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppNamedSlotAuthoringProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppNamedSlotAuthoringProofError(code, message, details);
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
    if (error instanceof DesenAppNamedSlotAuthoringProofError) throw error;
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
    fail("SOURCE_POLICY_VIOLATION", `${label} must be exact JSON.`, { cause: String(error) });
  }
}

function assertIncludes(source, markers, label) {
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} lost required named-slot policy.`, { missing });
  }
}

function assertExcludes(source, markers, label) {
  const present = markers.filter((marker) => source.includes(marker));
  if (present.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} acquired forbidden authority.`, { present });
  }
}

function sourceSection(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = endMarker === undefined ? source.length : source.indexOf(endMarker, start + 1);
  if (start < 0 || end < 0 || end <= start) {
    fail("SOURCE_POLICY_VIOLATION", `${label} could not be isolated.`);
  }
  return source.slice(start, end);
}

function inspectAuthoringData(source) {
  assertIncludes(
    source,
    [
      "validateDesenInteractionCatalogSet",
      "validateDesenSourceInteractionContracts",
      "export interface AuthoringSlotContract",
      "readonly slotContracts: readonly AuthoringSlotContract[]",
      "readonly defaultProps: JsonObject",
      "function projectSlotContracts(",
      'Object.hasOwn(slot, "minItems")',
      "required\n            ? 1\n            : 0",
      'Object.hasOwn(slot, "accepts") || Object.hasOwn(slot, "acceptsCategories")',
      "defaultProps: optionalObject(authoring?.defaultProps) ?? Object.freeze({})",
      "slotContracts: metadata.slotContracts",
      "validationDocument: sourceResult.value",
    ],
    "authoring-data.ts",
  );
  assertExcludes(
    source,
    ["react", "react-dom", "document.querySelector", "getBoundingClientRect"],
    "authoring-data.ts",
  );
  return deepFreeze({
    publicCatalogAndSourceValidation: true,
    completeDeclaredSlotProjection: true,
    effectiveMinimumProfile: "minItems ?? (required ? 1 : 0)",
    explicitAcceptancePresenceRetained: true,
    authoringDefaultsRetained: true,
    sourcePresenceRetainedSeparately: true,
    validatedDocumentSnapshotRetained: true,
  });
}

function inspectSlotSource(source) {
  assertIncludes(
    source,
    [
      "createDesenEditorContinuousValidator",
      "  deleteDesenEditorNode,",
      "insertDesenEditorNode",
      "moveDesenEditorNode",
      "reorderDesenEditorNode",
      "setDesenEditorOwnerProp",
      "export function evaluateAuthoringSlotInsertion(",
      "export function evaluateAuthoringSlotPlacement(",
      "export function evaluateAuthoringNodeDeletion(",
      "export function applyAuthoringNodeDelete(",
      "canonicalizeJsonBytes",
      "maxDefaultPropTransitions: 256",
      "maxAggregateSnapshotWorkBytes: 33_554_432",
      "const VALIDATOR_BY_MODEL = new WeakMap<",
      "VALIDATOR_BY_MODEL.get(model)",
      "VALIDATOR_BY_MODEL.set(model, prepared)",
      "const INSERTION_ADMISSION_BY_MODEL = new WeakMap<",
      "const PLACEMENT_ADMISSION_BY_MODEL = new WeakMap<",
      "function admissionKey(selection: AuthoringSlotSelection, subjectId: string)",
      "selection.ownerCapabilityId",
      "function materializePlacementCompatibility(",
      'base.operation === "reorder" && index > base.sourceIndex ? index - 1 : index',
      'changesSource: base.operation === "move" || finalIndex !== base.sourceIndex',
      "const keys = Reflect.ownKeys(edit)",
      "Object.getOwnPropertyDescriptor(edit, key)",
      "function captureComponentSelection(",
      "const fields = exactOwnData(selection, [",
      "const contractsBySet = new WeakMap<",
      "if (owner.slots.length === 0) return",
      "contractsBySet.set(owner.slotContracts, contracts)",
      "present: sourceSlot !== undefined",
      "if (!slot.contract.constrainsChildren) return true",
      "slot.contract.acceptedCapabilityIds.includes(component.id)",
      "slot.contract.acceptedCategories.includes(component.semanticCategory)",
      "slot.children.length >= slot.contract.maximum",
      "const transitionCount = Object.keys(component.defaultProps).length + 1",
      "transitionCount - 1 > SLOT_INSERT_PROFILE.maxDefaultPropTransitions",
      "const properties = Object.keys(component.defaultProps)",
      "if (!withinDefaultProfile(document, component)) return undefined",
      "properties.sort(compareText)",
      "Math.floor(SLOT_INSERT_PROFILE.maxAggregateSnapshotWorkBytes / transitionCount)",
      "prepared.model.validationDocument",
      "capturedEdit.index > projection.slot.children.length",
      "projection.slot.children.length + 1 < projection.slot.contract.minimum",
      "capturedEdit.index > placement.index ? capturedEdit.index - 1 : capturedEdit.index",
      "placement.slot.children.length - 1 < placement.slot.contract.minimum",
      "nodeContainsOwner(placement.node, capturedSelection)",
      "insertDesenEditorNode(model.validationDocument",
      "const validationReport = validationReportForCandidate(prepared.model, changed.document)",
      '? failure("source-invalid", validationReport)',
      "placement === undefined || placement === null",
      "does not invent a private subtree transaction",
    ],
    "authoring-slots.ts",
  );
  assertExcludes(
    source,
    [
      "react",
      "react-dom",
      "DragEvent",
      "dataTransfer",
      "document.querySelector",
      "getBoundingClientRect",
      "elementFromPoint",
      "querySelector",
    ],
    "authoring-slots.ts",
  );
  const insertionPreflight = sourceSection(
    source,
    "export function evaluateAuthoringSlotInsertion(",
    "/** Re-authorizes one current Source node",
    "insertion preflight",
  );
  const placementPreflight = sourceSection(
    source,
    "export function evaluateAuthoringSlotPlacement(",
    "/** Re-authorizes whether the exact current selection may be removed",
    "placement preflight",
  );
  const deletionPreflight = sourceSection(
    source,
    "export function evaluateAuthoringNodeDeletion(",
    "/**\n * Removes one exact selected subtree",
    "deletion preflight",
  );
  const deletionMutation = sourceSection(
    source,
    "export function applyAuthoringNodeDelete(",
    "/**\n * Applies an insertion",
    "deletion mutation",
  );
  const mutation = sourceSection(
    source,
    "export function applyAuthoringSlotEdit(",
    undefined,
    "slot mutation",
  );
  assertIncludes(
    insertionPreflight,
    [
      "projection.slot.children.length + 1 < projection.slot.contract.minimum",
      "const admissions = insertionAdmissions(model)",
      "const key = admissionKey(capturedSelection, componentId)",
      "const cached = admissions.get(key)",
      "index > cached.maximumIndex",
      "cached.compatibility",
      "insertDesenEditorNode(model.validationDocument",
      "validateCandidate(model, staged)",
    ],
    "insertion preflight",
  );
  assertIncludes(
    placementPreflight,
    [
      "projection.slot.children.length + 1 < projection.slot.contract.minimum",
      "const admissions = placementAdmissions(model)",
      "const key = admissionKey(capturedSelection, nodeId)",
      "const cached = admissions.get(key)",
      "index > cached.maximumIndex",
      "materializePlacementCompatibility(cached.base, index)",
      "admissions.set(key, Object.freeze({ maximumIndex, base }))",
      "reorderDesenEditorNode(model.validationDocument",
      "moveDesenEditorNode(model.validationDocument",
      "validateCandidate(model, changed.document)",
    ],
    "placement preflight",
  );
  assertIncludes(
    deletionPreflight,
    [
      "const capturedSelection = captureComponentSelection(selection)",
      "placement === undefined ||\n    placement === null",
      "placement.node.capabilityId !== capturedSelection.capabilityId",
      "placement.node.displayName !== capturedSelection.displayName",
      "placement.node.conditional !== capturedSelection.conditional",
      "placement.slot.children.length - 1 < placement.slot.contract.minimum",
      "deleteDesenEditorNode(model.validationDocument",
      "validateCandidate(model, changed.document)",
    ],
    "deletion preflight",
  );
  assertIncludes(
    deletionMutation,
    [
      "const capturedSelection = captureComponentSelection(selection)",
      "prepareCatalogAuthoringModel(catalogValue, document)",
      "findNodePlacement(",
      "placement.node.capabilityId !== capturedSelection.capabilityId",
      "placement.slot.children.length - 1 < placement.slot.contract.minimum",
      "deleteDesenEditorNode(prepared.model.validationDocument",
      "const validationReport = validationReportForCandidate(prepared.model, changed.document)",
      '? failure("source-invalid", validationReport)',
      'operation: "delete"',
    ],
    "deletion mutation",
  );
  assertIncludes(
    mutation,
    ["projection.slot.children.length + 1 < projection.slot.contract.minimum"],
    "slot mutation",
  );
  return deepFreeze({
    publicEditorCoreOnly: true,
    exactRouteSelectionAndEditCapture: true,
    editDescriptorsCapturedOnce: true,
    absentSlotProjection: true,
    linearSharedContractTraversal: true,
    exactIdOrCategoryAcceptance: true,
    unrestrictedOnlyWhenAcceptanceFieldsAbsent: true,
    componentInsertionPreflight: true,
    nodeMoveAndReorderPreflight: true,
    nodeDeletionPreflight: true,
    insertionPreflightRunsPublicMutationAndValidation: true,
    placementPreflightRunsPublicMutationAndValidation: true,
    deletionPreflightRunsPublicMutationAndValidation: true,
    cyclePreflight: true,
    sameSlotNoOpReported: true,
    destinationMaximumBeforeInsertOrMove: true,
    absentDestinationMinimumBeforeInsertOrMove: true,
    sourceMinimumBeforeCrossSlotMove: true,
    sourceMinimumBeforeDelete: true,
    sameSlotBoundaryConvertedAfterRemoval: true,
    rootPlacementRejected: true,
    rootDeletionRejected: true,
    cyclesPreflightedBeforePublicEditorCoreMove: true,
    deterministicStableIdInsert: true,
    publicNestedSubtreeDelete: true,
    exactComponentDeletionSelectionCapture: true,
    defaultPropTransitionLimit: 256,
    defaultPropWorkByteLimit: 33_554_432,
    defaultPropWidthCheckedBeforeSort: true,
    validatorPreparationCachedPerModel: true,
    insertionAdmissionCachedPerModelAndExactTarget: true,
    placementAdmissionCachedPerModelAndExactTarget: true,
    admissionCacheKeysExcludeBoundaryIndex: true,
    cachedPlacementBaseMaterializesBoundaryFinalIndex: true,
    cachedAdmissionsRejectOutOfRangeBoundary: true,
    minimalRequiredSlotInsertFailsClosed: true,
    validatedSourceSnapshotMutation: true,
    completeSourceRevalidation: true,
    deletionCompleteSourceRevalidation: true,
    noPartialDocumentOrIdentityOnFailure: true,
    noPartialDocumentOnDeleteFailure: true,
  });
}

function inspectPreviewSource(source) {
  assertIncludes(
    source,
    [
      'import { createDesenEditorDocument } from "@desen/editor-core"',
      'import { publishDesenSource } from "@desen/publisher"',
      "createDesenEditorDocument(document)",
      "publishDesenSource(rawSource, REFERENCE_CATALOG_PACKAGES)",
      "bundle: published.bundle",
      "revision: published.bundle.revision",
    ],
    "authoring-preview.ts",
  );
  return deepFreeze({
    publicPublisherOnly: true,
    sourceReadmittedBeforePublication: true,
    exactBundleRevisionReturned: true,
    noPartialBundleOnFailure: true,
  });
}

function inspectAdapterSource(source) {
  assertIncludes(
    source,
    [
      "mounted.snapshot.revision !== previewRevision",
      "disposeRuntimeHeadlessSession(session)",
      'data-managed-capability-subtree="true"',
      "selectionOverlay",
    ],
    "adapter-canvas.tsx",
  );
  return deepFreeze({
    revisionReplacement: true,
    previousSessionDisposed: true,
    managedSubtreeExplicit: true,
    selectionOverlayRemainsSibling: true,
  });
}

function inspectApplicationSource(source) {
  assertIncludes(
    source,
    [
      "type AuthoringDragIntent =",
      'Readonly<{ readonly kind: "component"; readonly componentId: string }>',
      'Readonly<{ readonly kind: "node"; readonly nodeId: string }>',
      "function declaredSlotStates(",
      "const slotsByName = new Map(owner.slots.map((slot) => [slot.name, slot]))",
      "return owner.slotContracts.map((contract) =>",
      'event.dataTransfer.setData("text/plain", "DESEN App authoring item")',
      "const [dragIntent, setDragIntent] = useState<AuthoringDragIntent | null>(null)",
      'const dropReady = dragAdmission?.status === "accepted"',
      "type AuthoringDropAdmission =",
      "function evaluateDragIntent(",
      "interface AuthoringDragSession {",
      "function createAuthoringDragSession(epoch = 0): AuthoringDragSession",
      "const dragSession = useRef<AuthoringDragSession>(createAuthoringDragSession())",
      "dragSession.current = createAuthoringDragSession(current.epoch + 1)",
      "const [activeDropProjection, setActiveDropProjection] = useState<AuthoringDropProjection | null>",
      "const projectDrop = useCallback((next: AuthoringDropProjection | null) =>",
      "onProjectDrop={projectDrop}",
      "const activeDropIndex =",
      "const sessionOwnerKey = JSON.stringify([target.ownerKind, target.ownerId, target.slot])",
      "function projectNearestDrop(",
      "Math.abs(clientY - midpoint) <= LAYER_DROP_MIDPOINT_HYSTERESIS_PX",
      "pending.sessionEpoch !== currentSession.epoch",
      "pending.ownerKey !== currentSession.ownerKey",
      "document.elementFromPoint(pending.clientX, pending.clientY)",
      "hitSlotSurface !== pending.slotSurface",
      "function clearUnclaimedDrop(): void {",
      "data-drop-hovered={dropReady && dropHovered}",
      'data-drop-noop={dragAdmission?.status === "noop"}',
      'data-drop-noop-hovered={dragAdmission?.status === "noop" && dropHovered}',
      '{dragAdmission?.status === "noop" ? "Current position" : "Drop here"}',
      "data-drop-ready={dropReady}",
      "className={styles.slotBoundaryHitArea}",
      'data-slot-boundary-hit-area="true"',
      "onDragEnter={onBoundaryDragEnter}",
      "onDragOver={onBoundaryDragOver}",
      "onDrop={onBoundaryDrop}",
      "onDragEnter={updateDropProjection}",
      "onDragOver={updateDropProjection}",
      "onDrop={receiveDrop}",
      "interaction.onApplyIntent(projection.target, projection.index, interaction.dragIntent)",
      "event.stopPropagation();\n    const admission = projectNearestDrop(list, event.clientY, event.target);",
      'if (admission.status === "rejected" || admission.status === "unavailable") {\n      publishAdmission(admission);',
      'if (admission.status === "accepted" || admission.status === "noop") {',
      'if (admission.status === "accepted") {\n        session.lastAcceptedProjection = admission.projection;',
      '(releaseAdmission.status === "unavailable" || releaseAdmission.status === "rejected")',
      "interaction.dragSession.current.ownerKey === sessionOwnerKey",
      'interaction.dragSession.current.admission === "accepted"',
      "? interaction.dragSession.current.lastAcceptedProjection",
      'if (releaseAdmission.status === "noop") {',
      "projectAuthoringSlotSelection(resolvedActiveSlot, route, model)",
      "evaluateAuthoringSlotInsertion(\n                              route,",
      "evaluateAuthoringSlotPlacement(route, authoringModel, target",
      "selectedPlacement?.accepted === true && selectedPlacement.changesSource === true",
      'Readonly<{ readonly status: "noop"; readonly projection: AuthoringDropProjection }>',
      'status: "noop",\n        projection: Object.freeze({ index, target }),',
      "slot insertion boundary at position",
      'role="group"',
      "const componentDropReady =",
      "const [panelDragHovered, setPanelDragHovered] = useState(false)",
      "const panelDragEnterDepth = useRef(0)",
      'data-component-drag-active={dragIntent?.kind === "component"}',
      "data-drop-hovered={componentDropReady && panelDragHovered}",
      "data-drop-ready={componentDropReady}",
      "data-guide={readySlot === null}",
      "panelDragEnterDepth.current += 1",
      "panelDragEnterDepth.current = Math.max(0, panelDragEnterDepth.current - 1)",
      "className={styles.componentsView}",
      'if (!componentDropReady) return;\n    event.stopPropagation();\n    event.preventDefault();\n    event.dataTransfer.dropEffect = "copy";',
      "onDragOver={admitComponentDrop}",
      "onDrop={receiveComponentDrop}",
      "No drop target selected",
      "Choose a named slot in Layers before placing a component.",
      "Choose slot in Layers",
      "className={styles.componentSlotTarget}",
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
      "const COMPONENT_PALETTE_RENDER_LIMIT = 24",
      "const visibleComponents = components.slice(0, COMPONENT_PALETTE_RENDER_LIMIT)",
      "const groups = groupComponents(visibleComponents)",
      "Showing ${visibleComponents.length} of ${components.length} matches",
      "readonly active: boolean",
      "if (!active) return null",
      'data-authoring-layout="split"',
      'data-authoring-pane="components"',
      'data-authoring-pane="layers"',
      "disabled={!selectedMovable}",
      "disabled={!enabled}",
      "onApplyIntent(readySlot.selection, readySlot.slot.children.length",
      "applyAuthoringSlotEdit(document, referenceCatalog, route, target, edit)",
      "evaluateAuthoringNodeDeletion(route, model, selection)",
      "applyAuthoringNodeDelete(document, referenceCatalog, route, selection)",
      "prepareAuthoringPreviewBundle(result.document)",
      "commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))",
      'if (result.operation === "insert" && edit.kind === "insert" && preparedModel.ok)',
      "sourceNodeId: result.nodeId",
      'data-authoring-pane-scroll="layers"',
      "setSelection(null)",
      "Remove layer",
      "aria-label={`Delete ${selection.displayName} layer · ${selection.sourceNodeId}`}",
      "disabled={deletionCompatibility?.accepted !== true}",
      "onClick={deleteSelection}",
      "layersPane.current?.focus({ preventScroll: true })",
      "<aside",
      'aria-label="Authoring panel"',
      "<DesenAdapterCanvas",
      "placement, and Inspector chrome never enter the managed",
    ],
    "application.tsx",
  );
  assertExcludes(
    source,
    [
      "dataTransfer.getData",
      "elementsFromPoint",
      "function acceptsDragIntent(",
      "targetDragEnterDepth",
      "targetDragHovered",
      "draggable={enabled}",
      "draggable={movable}",
      "flushSync",
    ],
    "application.tsx",
  );
  const componentLibrary = sourceSection(
    source,
    "function ComponentLibrary(",
    "function AuthoringPanel(",
    "ComponentLibrary",
  );
  const componentTarget = sourceSection(
    componentLibrary,
    "aria-label={targetName}",
    "{groups.length > 0 ? (",
    "component target chrome",
  );
  assertExcludes(componentTarget, [], "component target chrome");
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
      "The Components panel fallback and its sticky target must each own the four authenticated drag handlers.",
    );
  }
  return deepFreeze({
    appOwnedDragIntent: true,
    browserPayloadIsInertHint: true,
    declaredAbsentSlotsVisible: true,
    linearDeclaredPresentJoin: true,
    orderedBoundaryControls: true,
    compactStableDropBoundaries: true,
    rowHalfDropTargets: true,
    rowGeometryUsedOnlyForBoundedDropProjection: true,
    stableNestedDragHoverTracking: true,
    stableGlobalLayerDragSession: true,
    globalLayerOwnerAndEpochFencing: true,
    innermostNestedSlotOwnsPointer: true,
    rejectedReleaseRetainsLastAcceptedProjection: true,
    noOpProjectionVisibleAndInert: true,
    edgeScrollRehitTestsExactSlotSurface: true,
    componentCompatibilityVisible: true,
    explicitComponentDropTarget: true,
    componentPanelWideDropSurface: true,
    componentTargetDirectDropSurface: true,
    componentPaletteOuterDropInert: false,
    draggableComponentCard: false,
    dedicatedComponentDragHandle: true,
    dedicatedLayerDragHandle: true,
    separateNonDraggableComponentAddAction: true,
    stickyComponentDropTarget: true,
    componentDragGuidance: true,
    slotlessDisabledPlacementGuide: true,
    browserDataTransferReads: 0,
    invalidPlacementControlsDisabled: true,
    sameSlotNoOpControlsDisabled: true,
    componentPaletteRenderLimit: 24,
    completeFilteredMatchCountRetained: true,
    splitAuthoringPanesAlwaysRendered: true,
    componentPaletteAndLayerTreeConcurrent: true,
    authoringWorkSplitAcrossPermanentPanes: true,
    staleSlotProjectionRejected: true,
    publicNodeDeletionPreflight: true,
    invalidDeletionControlsDisabled: true,
    deletionReasonAssociatedWithControl: true,
    sourceAndPreviewCommitAtomically: true,
    deletionSourceAndPreviewCommitAtomically: true,
    successfulDeletionClearsSelection: true,
    successfulInsertionSelectsNewLayer: true,
    deletionFocusReturnsToLayersPane: true,
    failedDeletionPreservesSelectionAndFocus: true,
    publisherFailurePreservesPriorSession: true,
    slotChromeOutsideManagedCapabilitySubtree: true,
  });
}

function inspectCssSource(source) {
  assertIncludes(
    source,
    [
      ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 1.25rem;\n  align-items: center;\n  padding: 0 0.125rem;",
      ".slotBoundaryHitArea {\n  position: absolute;\n  inset: 0;\n  z-index: 5;\n  pointer-events: none;",
      '.slotBoundary[data-drop-ready="true"] .slotBoundaryHitArea,\n.slotBoundary[data-drop-noop="true"] .slotBoundaryHitArea {\n  pointer-events: auto;',
      '.slotBoundary[data-drop-ready="true"]::before {\n  position: absolute;\n  inset: 0.125rem;',
      '.slotBoundary[data-drop-ready="true"]',
      '.slotBoundary[data-drop-ready="true"]::before',
      '.slotBoundary[data-drop-noop="true"]::before',
      '.slotBoundary[data-drop-hovered="true"]',
      '.slotBoundary[data-drop-noop-hovered="true"]::before',
      '.slotBoundary[data-drop-ready="true"] .slotBoundaryLine',
      '.slotBoundary[data-drop-hovered="true"] .slotBoundaryLine',
      '.slotBoundary[data-drop-noop-hovered="true"] .slotBoundaryCue',
      '.slotBoundary[data-drop-noop-hovered="true"] .slotBoundaryLine',
      '.componentsView[data-component-drag-active="true"]',
      '.componentsView[data-drop-hovered="true"]',
      ".componentSlotTarget {\n  position: sticky;\n  top: 0.25rem;",
      '.componentSlotTarget[data-drag-active="true"]',
      '.componentSlotTarget[data-ready="true"]',
      '.componentSlotTarget[data-guide="true"]',
      '.componentSlotTarget[data-drop-ready="true"]',
      '.componentSlotTarget[data-drop-hovered="true"]',
      ".layerDragGuide {",
      ".layerDragHandle {\n  position: relative;\n  width: 1.75rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.25rem;",
      ".layerDragHandle::before {",
      ".componentItem {",
      ".componentDragHandle {\n  position: relative;\n  width: 2rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.1875rem -0.25rem;",
      ".componentDragHandle::before {",
      ".componentAddAction {",
    ],
    "application.module.css",
  );
  const managedSlotSelectors = source
    .split("\n")
    .filter(
      (line) =>
        line.includes("data-managed-capability-subtree") &&
        (line.includes("slot") || line.includes("componentItem")),
    );
  if (managedSlotSelectors.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", "Slot chrome CSS entered the managed capability subtree.", {
      managedSlotSelectors,
    });
  }
  assertExcludes(
    source,
    [
      "margin-block: -1.125rem",
      "margin-block: -0.875rem",
      "transition: min-height",
      '[data-drag-active="true"] .slotBoundary',
    ],
    "application.module.css",
  );
  return deepFreeze({
    namedSlotSelectors: true,
    selectedTargetPresentation: true,
    compactStableDropBoundaries: true,
    nonOverlappingFullWidthDropHitAreas: true,
    rowDropPositionPresentation: true,
    stableHoveredDropPresentation: true,
    noOpDropPresentation: true,
    stableGlobalDragGuidePresentation: true,
    stickyComponentTargetPresentation: true,
    panelWideComponentDropPresentation: true,
    slotlessTargetGuidePresentation: true,
    draggableComponentCardPresentation: false,
    dedicatedComponentDragHandlePresentation: true,
    dedicatedLayerDragHandlePresentation: true,
    separateComponentAddActionPresentation: true,
    managedDescendantSlotSelectors: 0,
  });
}

/** Applies the exact M09-T07 production source and ownership policy. */
export function verifyDesenAppNamedSlotAuthoringSourcePolicy(rawInput) {
  const keys = [
    "adapterSource",
    "applicationSource",
    "applicationCss",
    "authoringDataSource",
    "previewSource",
    "slotSource",
  ];
  const input = exactOwnDataOptions(rawInput, keys, "source policy input");
  for (const key of keys) {
    if (typeof input[key] !== "string" || input[key].includes("\0")) {
      fail("SOURCE_POLICY_VIOLATION", `${key} must be exact source text.`);
    }
  }
  return deepFreeze({
    authoringData: inspectAuthoringData(input.authoringDataSource),
    slots: inspectSlotSource(input.slotSource),
    preview: inspectPreviewSource(input.previewSource),
    adapter: inspectAdapterSource(input.adapterSource),
    application: inspectApplicationSource(input.applicationSource),
    css: inspectCssSource(input.applicationCss),
  });
}

function parseTypeScript(rawSource, relativePath) {
  const kind = relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    relativePath,
    rawSource,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail("TEST_POLICY_VIOLATION", `${relativePath} must parse as TypeScript.`);
  }
  return sourceFile;
}

function collectDescendants(node, predicate) {
  const values = [];
  const visit = (current) => {
    if (predicate(current)) values.push(current);
    current.forEachChild(visit);
  };
  visit(node);
  return values;
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
    [...sources].map(([relativePath, source]) => [
      relativePath,
      collectTestNames(source, relativePath),
    ]),
  );
  requireTestNames(
    names[AUTHORING_DATA_TEST_PATH],
    EXPECTED_AUTHORING_DATA_TEST_NAMES,
    AUTHORING_DATA_TEST_PATH,
  );
  requireTestNames(names[SLOT_TEST_PATH], EXPECTED_SLOT_TEST_NAMES, SLOT_TEST_PATH);
  requireTestNames(names[PREVIEW_TEST_PATH], EXPECTED_PREVIEW_TEST_NAMES, PREVIEW_TEST_PATH);
  requireTestNames(names[ADAPTER_TEST_PATH], EXPECTED_ADAPTER_TEST_NAMES, ADAPTER_TEST_PATH);
  requireTestNames(
    names[APPLICATION_TEST_PATH],
    EXPECTED_APPLICATION_TEST_NAMES,
    APPLICATION_TEST_PATH,
  );
  assertIncludes(
    sources.get(SLOT_TEST_PATH),
    [
      "translates a forward end boundary after removal",
      "keeps a backward boundary in pre-removal coordinates",
      "normalizes an adjacent forward boundary to a no-op",
      "required: true,\n          minItems: 1",
      "getOwnPropertyDescriptor",
      "descriptorReads",
      "1_024",
      "Array.from({ length: 1_025 }",
      "compatibility.accepted && !compatibility.changesSource",
      "removes a newly inserted nested subtree",
      "evaluateAuthoringNodeDeletion(REFERENCE_ROUTE, model, selection)",
      "applyAuthoringNodeDelete(",
      "deletes from a behavior-owned slot and retains its own empty slot key",
      "disables root deletion and deletion across the owning slot minimum",
      "deletes the final node from a 1,024-sibling slot within the bounded profile",
      "captures deletion selections as exact own data and rejects cross-route authority",
      '"stale capability", { capabilityId: EXACT_CAPABILITY }',
      '"stale display name", { displayName: "Renamed elsewhere" }',
      '"stale conditional state", { conditional: true }',
    ],
    "authoring-slots tests",
  );
  assertIncludes(
    sources.get(APPLICATION_TEST_PATH),
    [
      "Delete Alert layer · node.alert",
      "Deleted Alert layer · node.alert.",
      "expect(layers.contains(document.activeElement)).toBe(true)",
      "disables deletion for the surface root and a slot-minimum preflight without changing preview",
      "expect(deleteAttempt).not.toHaveBeenCalled()",
      "preserves the selected layer, preview, and focus when deletion is rejected",
      "expect(document.activeElement).toBe(deleteTitle)",
      "expect(reads).toBe(0)",
      "function layerDragHandleFor(layerButton: HTMLElement): HTMLElement",
      "\"[data-layer-drag-handle='true']\"",
      "const alertCard = alert.closest(\"[data-component-card='true']\")",
      "expect((alert as HTMLButtonElement).draggable).toBe(false)",
      "expect(alertCard.draggable).toBe(false)",
      "expect(alertDragHandle.draggable).toBe(true)",
      "\"[data-component-drag-handle='true']\"",
      "fireEvent.dragEnter(dropPrompt, { dataTransfer })",
      "fireEvent.dragOver(panelSearch, { dataTransfer })",
      "fireEvent.drop(target, { dataTransfer })",
      '(target.parentElement as HTMLElement).getAttribute("data-drop-hovered")',
      "expect(slotEdit).toHaveBeenCalledTimes(1)",
      'getAttribute("data-drop-hovered")',
      'getAttribute("data-drop-ready")',
      "keeps edge scrolling through a no-op gap, re-hit-tests, and fences a stale frame",
      "drops from a visible row with the last admitted projection when drop coordinates are absent",
      "forgets an admitted gap after the pointer reaches the dragged layer's no-op position",
      'getAttribute("data-drop-noop-hovered")',
      'toContain("Current position")',
      "expect(elementFromPoint).toHaveBeenCalledWith(20, 195)",
      "expect(cancelFrame).toHaveBeenCalledWith(2)",
      "No drop target selected",
      "Choose slot in Layers",
      "Choose a named slot in Layers, then return to Components.",
    ],
    "application tests",
  );
  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:named-slots && node --test tests/desen-app-named-slot-authoring.test.mjs",
    appTestNames: names,
    rootTestNames: DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES,
    localCommandReceipts: {
      pureSlot: {
        command: "pnpm --filter @desen/app-web exec vitest run test/authoring-slots.test.ts",
        result: "PASS",
        testFiles: 1,
        tests: 27,
      },
      focusedNamedSlots: {
        command: "pnpm --filter @desen/app-web test:named-slots",
        result: "PASS",
        testFiles: 5,
        tests: 70,
      },
      fullApp: {
        command: "pnpm --filter @desen/app-web test",
        result: "PASS",
        testFiles: 11,
        tests: 151,
      },
      rootProof: {
        command: "node --test tests/desen-app-named-slot-authoring.test.mjs",
        result: "PASS",
        testFiles: 1,
        tests: 9,
      },
    },
    semanticCoverage: [
      "PF_010_EFFECTIVE_MINIMUM",
      "ABSENT_VS_EMPTY_SLOT",
      "EXACT_ID_OR_CATEGORY_ACCEPTANCE",
      "EXPLICIT_EMPTY_ACCEPTANCE_REJECTS_ALL",
      "SOURCE_MINIMUM",
      "DESTINATION_MAXIMUM",
      "ABSENT_DESTINATION_MINIMUM",
      "PF_080_BOUNDARY_CONVERSION",
      "PUBLIC_STABLE_ID_INSERT",
      "PUBLIC_MOVE_AND_REORDER",
      "PUBLIC_NESTED_SUBTREE_DELETE",
      "BEHAVIOR_OWNED_DESTINATION",
      "BEHAVIOR_OWNED_DELETE_AND_EMPTY_SLOT_KEY",
      "EXACT_OWN_DATA_CAPTURE",
      "EXACT_DELETION_SELECTION_CAPTURE",
      "STALE_DELETION_IDENTITY_REJECTION",
      "DEFAULT_PROP_STAGING_BOUNDS",
      "INSERT_DRY_RUN_REVALIDATION",
      "MOVE_REORDER_DRY_RUN_REVALIDATION",
      "DELETE_DRY_RUN_REVALIDATION",
      "ROOT_AND_SOURCE_MINIMUM_DELETE_PREFLIGHT",
      "CYCLE_PREFLIGHT",
      "SAME_SLOT_NO_OP_SUPPRESSION",
      "MODEL_KEYED_EXACT_TARGET_ADMISSION_CACHE",
      "BOUNDARY_FINAL_INDEX_MATERIALIZATION",
      "ONE_THOUSAND_TWENTY_FIVE_CACHED_BOUNDARIES",
      "ONE_THOUSAND_TWENTY_FOUR_SIBLING_DELETE",
      "COMPONENT_PALETTE_RENDER_LIMIT_24",
      "ACTIVE_TAB_ONLY_AUTHORING_WORK",
      "EXPANDED_OVERLAPPING_DROP_BOUNDARIES",
      "STABLE_NESTED_DRAG_HOVER",
      "EXPLICIT_COMPONENT_DROP_TARGET_GUIDE",
      "DATA_TRANSFER_READS_ZERO",
      "CONTINUOUS_SOURCE_REVALIDATION",
      "ATOMIC_PUBLISHER_PREVIEW",
      "ATOMIC_PUBLISHER_DELETE_PREVIEW",
      "DELETION_FOCUS_MANAGEMENT",
      "APP_OWNED_DRAG_HINTS",
    ],
  });
}

function inspectPackages(files) {
  const root = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const appCommand =
    "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  if (app.scripts?.["test:named-slots"] !== appCommand) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact App named-slot test command drifted.");
  }
  const prefix =
    "node scripts/verify-desen-app-structured-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:named-slots && ";
  const expectedRootCommands = {
    "generate:desen-app-named-slot-authoring": `${prefix}node scripts/generate-desen-app-named-slot-authoring-proof.mjs`,
    "verify:desen-app-named-slot-authoring": `${prefix}node scripts/verify-desen-app-named-slot-authoring.mjs`,
    "test:desen-app-named-slot-authoring": `${prefix}node --test tests/desen-app-named-slot-authoring.test.mjs`,
  };
  for (const [name, command] of Object.entries(expectedRootCommands)) {
    if (root.scripts?.[name] !== command) {
      fail("PACKAGE_POLICY_VIOLATION", `The exact ${name} command drifted.`);
    }
  }
  const publicDependencies = [
    "@desen/catalog-sdk",
    "@desen/editor-core",
    "@desen/protocol",
    "@desen/publisher",
    "@desen/validator",
  ];
  for (const dependency of publicDependencies) {
    if (app.dependencies?.[dependency] !== "workspace:*") {
      fail("PACKAGE_POLICY_VIOLATION", `The App lost its public ${dependency} dependency.`);
    }
  }
  return deepFreeze({
    appName: app.name,
    appTestCommand: appCommand,
    rootCommands: expectedRootCommands,
    parentAuthenticatedInsideReader: true,
    publicDependencies,
  });
}

function authenticateParent(bytes) {
  const pin = DESEN_APP_NAMED_SLOT_AUTHORING_PARENT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", "The exact frozen M09-T06 parent artifact changed.");
  }
  const artifact = parseJson(bytes, "frozen M09-T06 parent artifact");
  if (
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.publicEditorCoreNestedMutation !== true ||
    artifact.claim?.continuousSchemaRevalidation !== true ||
    artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact.claim?.inspectorOutsideManagedCapabilitySubtree !== true ||
    artifact.claim?.p08Status !== "NOT_PROVEN"
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T06 identity or retained claims drifted.");
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
    "frozen M09-T07 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T07 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T07 proof artifact");
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-named-slot-authoring" ||
    artifact?.profile !== "desen.app.named-slot-authoring-proof.v1" ||
    artifact?.task !== "M09-T07" ||
    artifact?.result !== "PASS" ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.completeCatalogDeclaredSlotProjection !== true ||
    artifact?.claim?.publicStableIdInsert !== true ||
    artifact?.claim?.publicCrossSlotMove !== true ||
    artifact?.claim?.publicSameSlotReorder !== true ||
    artifact?.claim?.publicNestedSubtreeDelete !== true ||
    artifact?.claim?.continuousCompleteSourceRevalidation !== true ||
    artifact?.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact?.claim?.slotChromeOutsideManagedCapabilitySubtree !== true ||
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
      DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES,
    )
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T07 artifact identity or retained claims drifted.");
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
      fail("BOUNDARY_DRIFT", `A retained M09-T07 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

function authenticateStateBindingSuccessor(files) {
  const artifactBytes = files.get(STATE_BINDING_ARTIFACT_PATH);
  if (
    artifactBytes.byteLength !== STATE_BINDING_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== STATE_BINDING_ARTIFACT_PIN.sha256
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T08 artifact bytes drifted.");
  }
  const artifact = parseJson(artifactBytes, STATE_BINDING_ARTIFACT_PATH);
  if (
    artifact.task !== STATE_BINDING_ARTIFACT_PIN.task ||
    artifact.proofId !== STATE_BINDING_ARTIFACT_PIN.proofId ||
    artifact.profile !== STATE_BINDING_ARTIFACT_PIN.profile ||
    artifact.result !== STATE_BINDING_ARTIFACT_PIN.result ||
    artifact.claim?.surfaceLocalPrimitiveStateList !== true ||
    artifact.claim?.primitiveStateAddUpdateDelete !== true ||
    artifact.claim?.boundedConservativeUsageCount !== true ||
    artifact.claim?.directCompatibleLocalStatePropBinding !== true ||
    artifact.claim?.exactDirectBindingChange !== true ||
    artifact.claim?.exactDirectBindingDetachToInitial !== true ||
    artifact.claim?.runtimeAndAdvancedBindingReadOnly !== true ||
    artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact.claim?.retainedNamedSlotAuthoringUxCompatibility !== true ||
    artifact.claim?.eventActionEditingClaimed !== false ||
    artifact.claim?.designRunClaimed !== false ||
    artifact.claim?.persistenceClaimed !== false ||
    artifact.claim?.activationClaimed !== false ||
    artifact.claim?.browserE2eClaimed !== false
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T08 artifact identity or claims drifted.");
  }
  return deepFreeze({
    task: STATE_BINDING_ARTIFACT_PIN.task,
    artifact: STATE_BINDING_ARTIFACT_PIN,
    surfaceLocalPrimitiveStateEditing: true,
    boundedUsageCounts: true,
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
      T13_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) ||
      T14_SUCCESSOR_RECEIPT_PATHS.includes(relativePath)
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

/** Builds detached deterministic M09-T07 named-slot authoring evidence. */
async function _buildFreshDesenAppNamedSlotAuthoringEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  const parent = authenticateParent(options.parentArtifactBytes ?? files.get(PARENT_ARTIFACT_PATH));
  const source = verifyDesenAppNamedSlotAuthoringSourcePolicy({
    authoringDataSource: decodeUtf8(files.get(AUTHORING_DATA_PATH), AUTHORING_DATA_PATH),
    slotSource: decodeUtf8(files.get(SLOT_SOURCE_PATH), SLOT_SOURCE_PATH),
    previewSource: decodeUtf8(files.get(PREVIEW_SOURCE_PATH), PREVIEW_SOURCE_PATH),
    adapterSource: decodeUtf8(files.get(ADAPTER_SOURCE_PATH), ADAPTER_SOURCE_PATH),
    applicationSource: decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    applicationCss: decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH),
  });
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const trackedReceipts = receipts(files);
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-named-slot-authoring",
    profile: "desen.app.named-slot-authoring-proof.v1",
    task: "M09-T07",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: [parent],
    claim: {
      taskStatus: "DONE",
      completeCatalogDeclaredSlotProjection: true,
      absentAndEmptySlotsRemainDistinct: true,
      pf010EffectiveMinimum: true,
      exactIdOrCategoryAcceptance: true,
      explicitEmptyAcceptanceRejectsAll: true,
      componentInsertionPreflight: true,
      nodeMoveAndReorderPreflight: true,
      nodeDeletionPreflight: true,
      invalidPlacementControlsDisabled: true,
      insertionPreflightRunsPublicMutationAndValidation: true,
      placementPreflightRunsPublicMutationAndValidation: true,
      deletionPreflightRunsPublicMutationAndValidation: true,
      cyclePreflight: true,
      sameSlotNoOpControlsDisabled: true,
      insertionAdmissionCachedPerModelAndExactTarget: true,
      placementAdmissionCachedPerModelAndExactTarget: true,
      cachedPlacementBaseMaterializesBoundaryFinalIndex: true,
      componentPaletteRenderLimit: 24,
      activeTabOnlyAuthoringWork: true,
      sourceMinimumEnforced: true,
      destinationMaximumEnforced: true,
      absentDestinationMinimumEnforced: true,
      publicStableIdInsert: true,
      publicCrossSlotMove: true,
      publicSameSlotReorder: true,
      publicNestedSubtreeDelete: true,
      pf080BoundaryConversion: true,
      nodeAndBehaviorOwnersSupported: true,
      stableIdentityPreserved: true,
      rootsAndCyclesFailClosed: true,
      rootDeletionDisabled: true,
      sourceMinimumDeletionDisabled: true,
      behaviorOwnedDeletePreservesEmptySlot: true,
      exactOwnDataRouteSelectionAndEditCapture: true,
      exactOwnDataDeletionSelectionCapture: true,
      validatedSourceSnapshotMutation: true,
      boundedDefaultPropStaging: true,
      continuousCompleteSourceRevalidation: true,
      failedEditPreservesCurrentDocument: true,
      failedDeletionPreservesCurrentDocument: true,
      appOwnedInertDragHints: true,
      browserDataTransferReadsZero: true,
      expandedDropReadyBoundaries: true,
      stableNestedDragHover: true,
      explicitComponentDropTargetGuide: true,
      keyboardPlacementControl: true,
      publisherSessionPreview: true,
      sourceAndPreviewCommitAtomically: true,
      deletionSourceAndPreviewCommitAtomically: true,
      deletionFocusManaged: true,
      slotChromeOutsideManagedCapabilitySubtree: true,
      persistenceClaimed: false,
      activationClaimed: false,
      browserE2eClaimed: false,
      p08Status: "NOT_PROVEN",
    },
    authority: {
      protocolProfiles: {
        slotSemantics: "PF-010",
        editorPositionSemantics: "PF-080",
        insertIndex: "existing destination boundary",
        moveIndex: "destination boundary before move",
        reorderIndex: "final position after selected child removal",
      },
      source,
    },
    application: {
      package: packageContract,
      mutationFlow: [
        "validator-admitted Catalog and Source projection",
        "exact route and named-slot selection reauthorization",
        "App-owned inert drag or keyboard placement intent",
        "Catalog acceptance and cardinality checks",
        "public Editor Core insert, move, reorder, or nested-subtree delete",
        "bounded Catalog default-prop staging for insert",
        "continuous complete-Source validation",
        "Publisher session-local Bundle",
        "atomic Source and exact adapter session replacement",
        "successful deletion clears stale selection and returns focus to Layers",
      ],
      ownership: {
        slotChrome: "Desen App sibling chrome",
        browserDragPayload: "inert non-authoritative hint",
        dropTargets: "expanded App-owned boundary and explicit Components target chrome",
        deletionControl: "App-owned exact-selection preflight outside managed capability subtree",
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
      "M09-T08 is NOT_PROVEN: local-state and binding editing are not implemented.",
      "M09-T09 is NOT_PROVEN: event and closed-action editing are not implemented.",
      "M09-T10 is NOT_PROVEN: no Design/Run mode is claimed.",
      "M09-T12 is NOT_PROVEN: no save/open or durable persistence UI is claimed.",
      "M09-T14 is NOT_PROVEN: session preview is not control-plane publication or activation.",
      "P-08 remains NOT_PROVEN until the remaining visual authoring and browser-E2E owners pass.",
      "A component requiring its own materialized child slot is rejected; no private subtree transaction is invented.",
      "No private DOM, component geometry, hit testing, canvas picking, or managed-tree inspection is claimed.",
      "No required-gate, global CI count, or hosted-CI pass is inferred from local evidence.",
    ],
  });
  const artifactBytes = canonicalArtifactBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

/** Authenticates frozen M09-T07 evidence and checks its live additive M09-T08 successor. */
function authenticateM10VisualBehaviorAuthoringSuccessor(files) {
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
      bytes?.byteLength !== receipt.bytes ||
      sha256(bytes ?? Buffer.alloc(0)) !== receipt.sha256
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
    hostedBrowserBytes?.byteLength !== hostedBrowserReceipt.bytes ||
    sha256(hostedBrowserBytes ?? Buffer.alloc(0)) !== hostedBrowserReceipt.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      `The exact M10-T01B hosted-browser compatibility receipt drifted: ${hostedBrowserReceipt.path}.`,
    );
  }
  return deepFreeze({
    task: artifact.task,
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

export async function buildDesenAppNamedSlotAuthoringEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files] = await Promise.all([
    authenticateFrozenArtifact(workspaceRoot),
    readTrackedFiles(workspaceRoot, options.fileOverrides),
  ]);
  const userCreatedBlankProjectSuccessor = authenticateM10UserCreatedBlankProjectSuccessor(files);
  const visualBehaviorAuthoringSuccessor = authenticateM10VisualBehaviorAuthoringSuccessor(files);
  const parent = authenticateParent(options.parentArtifactBytes ?? files.get(PARENT_ARTIFACT_PATH));
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const source = verifyDesenAppNamedSlotAuthoringSourcePolicy({
    authoringDataSource: decodeUtf8(files.get(AUTHORING_DATA_PATH), AUTHORING_DATA_PATH),
    slotSource: decodeUtf8(files.get(SLOT_SOURCE_PATH), SLOT_SOURCE_PATH),
    previewSource: decodeUtf8(files.get(PREVIEW_SOURCE_PATH), PREVIEW_SOURCE_PATH),
    adapterSource: decodeUtf8(files.get(ADAPTER_SOURCE_PATH), ADAPTER_SOURCE_PATH),
    applicationSource: decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    applicationCss: decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH),
  });
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const successor = authenticateStateBindingSuccessor(files);
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
    proofId: "desen-app-named-slot-authoring",
    profile: "desen.app.named-slot-authoring-proof.v1",
    task: "M09-T07",
    result: "PASS",
    prerequisites: [parent],
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      completeCatalogDeclaredSlotProjection:
        frozen.artifact.claim.completeCatalogDeclaredSlotProjection,
      publicStableIdInsert: frozen.artifact.claim.publicStableIdInsert,
      publicCrossSlotMove: frozen.artifact.claim.publicCrossSlotMove,
      publicSameSlotReorder: frozen.artifact.claim.publicSameSlotReorder,
      publicNestedSubtreeDelete: frozen.artifact.claim.publicNestedSubtreeDelete,
      continuousCompleteSourceRevalidation:
        frozen.artifact.claim.continuousCompleteSourceRevalidation,
      sourceAndPreviewCommitAtomically: frozen.artifact.claim.sourceAndPreviewCommitAtomically,
      slotChromeOutsideManagedCapabilitySubtree:
        frozen.artifact.claim.slotChromeOutsideManagedCapabilitySubtree,
    },
    source,
    successor,
    fixturesScenariosSuccessor,
    sourcePersistenceSuccessor,
    nodeLinkedDiagnosticsSuccessor,
    publishActivationSuccessor,
    package: packageContract,
    testPolicy: {
      applicationTestNames: tests.appTestNames[APPLICATION_TEST_PATH],
      rootTestNames: tests.rootTestNames,
    },
    boundary: {
      retainedHistoricalReceipts: RETAINED_HISTORICAL_PATHS.length,
      successorCompatibilityPaths: SUCCESSOR_COMPATIBILITY_PATHS.length,
      currentPathReceipts: receipts(files),
      additiveSuccessorReceipts: [
        APPLICATION_SOURCE_PATH,
        APPLICATION_CSS_PATH,
        APPLICATION_TEST_PATH,
        STATE_BINDING_ARTIFACT_PATH,
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
    "Task: M09-T07",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "M09-T08: NOT_PROVEN",
    "M09-T09: NOT_PROVEN",
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

function localTestCounts(artifact) {
  const receipts = artifact.tests.localCommandReceipts;
  return deepFreeze({
    pureSlot: receipts.pureSlot.tests,
    focusedNamedSlots: receipts.focusedNamedSlots.tests,
    fullApp: receipts.fullApp.tests,
    rootProof: receipts.rootProof.tests,
  });
}

/** Verifies committed M09-T07 bytes and the visible report digest. */
export async function verifyDesenAppNamedSlotAuthoringEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppNamedSlotAuthoringEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_NAMED_SLOT_AUTHORING_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T07 artifact bytes differ from fresh evidence.");
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
    localTestCounts: localTestCounts(built.artifact),
    p08Status: built.artifact.claim.p08Status,
  });
}

/** Atomically writes exact deterministic M09-T07 proof bytes. */
export async function writeDesenAppNamedSlotAuthoringEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_NAMED_SLOT_AUTHORING_ARTIFACT_PATH,
  );
  const built = await buildDesenAppNamedSlotAuthoringEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T07 artifact write failed safely.", {
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
    localTestCounts: localTestCounts(built.artifact),
  });
}
