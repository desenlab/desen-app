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
const M10_VISUAL_BEHAVIOR_AUTHORING_HOSTED_BROWSER_COMPATIBILITY_RECEIPT = Object.freeze({
  path: "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
  bytes: 15_143,
  sha256: "5fcdc7f312bb2ef45e747499e50bf31f2dfae8e1c1b82963176d99eb8bb8395b",
});
const M10_VISUAL_BEHAVIOR_AUTHORING_RECEIPT_PATHS = Object.freeze([
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
  "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json",
  "packages/reference-catalog-web/catalog.json",
  "scripts/generate-desen-app-visual-behavior-authoring-proof.mjs",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/verify-desen-app-visual-behavior-authoring.mjs",
]);
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
const M10_USER_CREATED_BLANK_PROJECT_SUCCESSOR_RECEIPTS = Object.freeze({
  "apps/desen-app/package.json": Object.freeze({
    path: "apps/desen-app/package.json",
    bytes: 4_122,
    sha256: "7038647aa1809f07ee5131d0df8d0bee75bf1f2cdf0358be738b2c3603b64577",
  }),
  "apps/desen-app/src/application.module.css": Object.freeze({
    path: "apps/desen-app/src/application.module.css",
    bytes: 112_222,
    sha256: "3440415a516a563aac8978ea1f604b28903cce8a00d54048f557cd339289040e",
  }),
  "apps/desen-app/src/application.tsx": Object.freeze({
    path: "apps/desen-app/src/application.tsx",
    bytes: 132_468,
    sha256: "833f20edda80d840eaff27b29944c6a216f7fbe863d7ad30a65a6bb22b6b4869",
  }),
  "apps/desen-app/test/application.test.tsx": Object.freeze({
    path: "apps/desen-app/test/application.test.tsx",
    bytes: 107_788,
    sha256: "931f3097888c3f3e8c1636acd01d92975bdcbf06b37a6a55bb767dad1d905c7b",
  }),
  "dependency-cruiser.config.cjs": Object.freeze({
    path: "dependency-cruiser.config.cjs",
    bytes: 10_328,
    sha256: "46e4c21598239ce464a44ca3b54622d65f2db17145f6da75099f7acb4a7e3290",
  }),
  "pnpm-lock.yaml": Object.freeze({
    path: "pnpm-lock.yaml",
    bytes: 131_888,
    sha256: "23632d4c1d8bc8832a31db328fa36c7f1523aeb7c52f034ddbb3f8edecc4c002",
  }),
});
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
  M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH,
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
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-DESIGN-RUN-MODES.md";
const REAL_ADAPTER_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json";
const STATE_BINDING_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json";
const EVENT_ACTION_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json";
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
const LOCKFILE_PATH = "pnpm-lock.yaml";
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const SOURCE_FIXTURE_PATH = "examples/sign-in/official-derived.source.desen.json";
const BUNDLE_FIXTURE_PATH = "examples/sign-in/official-derived.bundle.desen.json";
const ADAPTER_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const APPLICATION_CSS_PATH = "apps/desen-app/src/application.module.css";
const INSPECTOR_PANEL_PATH = "apps/desen-app/src/inspector-panel.tsx";
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
  for (const receipt of Object.values(M10_USER_CREATED_BLANK_PROJECT_SUCCESSOR_RECEIPTS)) {
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
    const supersededByUserCreatedBlankProject = Object.hasOwn(
      M10_USER_CREATED_BLANK_PROJECT_SUCCESSOR_RECEIPTS,
      expected.path,
    );
    if (
      !isDeepStrictEqual(compatibilityReceipt, expected) ||
      (!supersededByUserCreatedBlankProject &&
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
  const artifactBytes = files.get(M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH);
  const pin = M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PIN;
  if (
    artifactBytes?.byteLength !== pin.bytes ||
    sha256(artifactBytes ?? Buffer.alloc(0)) !== pin.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact immutable M10-T01A user-created blank-project artifact drifted.",
    );
  }
  const artifact = parseJson(
    artifactBytes,
    M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
    "SUCCESSOR_POLICY_VIOLATION",
  );
  const parent = artifact?.prerequisites?.[0];
  const expectedClaim = {
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
  };
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.protocol !== "0.1.0" ||
    artifact?.target !== "web-react" ||
    artifact?.task !== "M10-T01A" ||
    artifact?.gate !== null ||
    artifact?.proofId !== "desen-app-user-created-blank-project" ||
    artifact?.profile !== "desen.app.user-created-blank-project-proof.v1" ||
    artifact?.result !== "PASS" ||
    !isDeepStrictEqual(artifact?.claim, expectedClaim) ||
    artifact?.prerequisites?.length !== 1 ||
    parent?.task !== "M10-T01-COMPAT" ||
    parent?.gate !== null ||
    parent?.proofId !== "desen-app-browser-e2e-workspace-compatibility" ||
    parent?.path !== M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH ||
    parent?.bytes !== M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.bytes ||
    parent?.sha256 !== M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.sha256 ||
    parent?.profile !== "desen.app.browser-e2e-workspace-compatibility-proof.v1" ||
    parent?.result !== "PASS" ||
    parent?.immutable !== true ||
    artifact?.authority?.source?.normalProductEntry !== true ||
    artifact?.authority?.source?.productEntryInjectsDocument !== false ||
    artifact?.authority?.source?.visibleNewProjectControl !== true ||
    artifact?.authority?.source?.visibleBlankTemplate !== true ||
    artifact?.authority?.source?.exactProjectId !== "account-app" ||
    artifact?.authority?.source?.exactSurfaceId !== "sign-in" ||
    artifact?.authority?.source?.exactCatalogIdentity !==
      "run.desen.reference.sign-in@0.1.0#web-react" ||
    !isDeepStrictEqual(artifact?.authority?.source?.frame, {
      preset: "portrait",
      width: 420,
      height: 720,
    }) ||
    artifact?.authority?.source?.localRuntimeProfile !== "desen.app.local-runtime.v1" ||
    artifact?.authority?.source?.fixedLoopbackOnly !== true ||
    artifact?.authority?.source?.freshBearerSecret !== true ||
    artifact?.authority?.source?.durableControlPlaneStore !== true ||
    artifact?.authority?.source?.productionBundlePreview !== true ||
    artifact?.authority?.source?.browserTestDeclarations !== 1 ||
    artifact?.authority?.source?.nativeDragCalls !== 2 ||
    artifact?.authority?.source?.initialProjectCount !== 0 ||
    artifact?.authority?.source?.creationGeneration !== 1 ||
    artifact?.authority?.source?.authoredGeneration !== 2 ||
    artifact?.authority?.source?.browserRuntimeErrorsAllowed !== 0 ||
    artifact?.authority?.source?.browserExecutionPerformedByReader !== false ||
    artifact?.authority?.package?.appPackageName !== "@desen/app-web" ||
    artifact?.authority?.package?.browserPackageName !== "@desen/app-browser-e2e" ||
    artifact?.authority?.package?.appDevCommand !== "node dev/local-dev.mjs" ||
    artifact?.authority?.package?.appLocalRuntimeTestCommand !==
      "vitest run test/local-runtime-persistence.test.ts dev/local-dev-host.test.mjs" ||
    artifact?.authority?.package?.appProductBootstrapTestCommand !==
      "vitest run test/product-bootstrap.test.tsx test/main-lifecycle.test.tsx" ||
    artifact?.tests?.browserTestDeclarations !== 1 ||
    artifact?.tests?.configuredProjects?.length !== 1 ||
    artifact?.tests?.configuredProjects?.[0] !== "product-chromium" ||
    artifact?.tests?.browserExecutedByVerifier !== false ||
    artifact?.tests?.boundaryExecutedByVerifier !== false ||
    artifact?.boundary?.trackedFiles !== M10_USER_CREATED_BLANK_PROJECT_TRACKED_PATHS.length ||
    artifact?.boundary?.trackedReceipts?.length !==
      M10_USER_CREATED_BLANK_PROJECT_TRACKED_PATHS.length ||
    artifact?.boundary?.immutableInputs !== true ||
    artifact?.boundary?.sourceSymlinksRejected !== true ||
    artifact?.boundary?.browserExecutionSeparateFromStaticReader !== true
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The immutable M10-T01A identity, claims, authority, or predecessor drifted.",
    );
  }

  const trackedReceipts = artifact.boundary.trackedReceipts;
  const receiptPaths = trackedReceipts.map((receipt) => receipt?.path);
  if (
    !isDeepStrictEqual(receiptPaths, M10_USER_CREATED_BLANK_PROJECT_TRACKED_PATHS) ||
    new Set(receiptPaths).size !== M10_USER_CREATED_BLANK_PROJECT_TRACKED_PATHS.length
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The immutable M10-T01A receipt closure is not exact, canonical, and unique.",
    );
  }
  for (const receipt of trackedReceipts) {
    const bytes = files.get(receipt.path);
    const historicalReceiptIsOverridden =
      M10_USER_CREATED_BLANK_PROJECT_OVERRIDDEN_HISTORICAL_PATHS.includes(receipt.path);
    const historicalReceiptIsCheckpointResealed =
      M10_USER_CREATED_BLANK_PROJECT_CHECKPOINT_RESEALED_PATHS.includes(receipt.path);
    const currentReceiptOwnedByM10T01B = M10_VISUAL_BEHAVIOR_AUTHORING_RECEIPT_PATHS.includes(
      receipt.path,
    );
    if (
      !Number.isSafeInteger(receipt.bytes) ||
      receipt.bytes < 0 ||
      !/^[0-9a-f]{64}$/u.test(receipt.sha256) ||
      (!historicalReceiptIsOverridden &&
        !historicalReceiptIsCheckpointResealed &&
        !currentReceiptOwnedByM10T01B &&
        (bytes?.byteLength !== receipt.bytes ||
          sha256(bytes ?? Buffer.alloc(0)) !== receipt.sha256))
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `The exact current M10-T01A artifact-owned receipt drifted: ${receipt.path}.`,
      );
    }
  }
  for (const receipt of M10_USER_CREATED_BLANK_PROJECT_SECURE_SCROLL_RECEIPTS) {
    if (
      M10_VISUAL_BEHAVIOR_AUTHORING_RECEIPT_PATHS.includes(receipt.path) ||
      receipt.path === M10_VISUAL_BEHAVIOR_AUTHORING_HOSTED_BROWSER_COMPATIBILITY_RECEIPT.path
    ) {
      continue;
    }
    const bytes = files.get(receipt.path);
    if (
      bytes?.byteLength !== receipt.bytes ||
      sha256(bytes ?? Buffer.alloc(0)) !== receipt.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `The exact M10-T01A Secure-scroll compatibility receipt drifted: ${receipt.path}.`,
      );
    }
  }

  return deepFreeze({
    task: artifact.task,
    artifact: {
      path: M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
      bytes: pin.bytes,
      sha256: pin.sha256,
      immutable: true,
    },
    predecessor: { ...parent },
    currentProjection: {
      relationship: "EXACT_M10_T01A_ARTIFACT_OWNED_LIVE_RECEIPTS",
      currentReceipts: trackedReceipts,
      compatibilityReceipt: "M10-T01A-SECURE-SCROLL-COMPAT",
      correctiveReceiptOnly: true,
      overriddenHistoricalPaths: M10_USER_CREATED_BLANK_PROJECT_OVERRIDDEN_HISTORICAL_PATHS,
      additivePaths: M10_USER_CREATED_BLANK_PROJECT_ADDITIVE_PATHS,
      checkpointResealedPaths: M10_USER_CREATED_BLANK_PROJECT_CHECKPOINT_RESEALED_PATHS,
      trackedReceipts: M10_USER_CREATED_BLANK_PROJECT_SECURE_SCROLL_RECEIPTS,
    },
    p08Status: artifact.claim.p08Status,
    normalProductEntryCovered: artifact.claim.normalProductEntryCovered,
    durableLocalPersistenceCovered: artifact.claim.durableLocalPersistenceCovered,
    designRunStaticParityCovered: artifact.claim.designRunStaticParityCovered,
    runtimeInputAndPendingCovered: artifact.claim.runtimeInputAndPendingCovered,
    invalidCredentialsAndPublicFailureCovered:
      artifact.claim.invalidCredentialsAndPublicFailureCovered,
    successNavigationAndHostOperationCovered:
      artifact.claim.successNavigationAndHostOperationCovered,
    g10Closed: artifact.claim.g10Closed,
  });
}

function authenticateM10VisualBehaviorAuthoringSuccessor(files) {
  const artifactBytes = files.get(M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH);
  const pin = M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PIN;
  if (
    artifactBytes?.byteLength !== pin.bytes ||
    sha256(artifactBytes ?? Buffer.alloc(0)) !== pin.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact immutable M10-T01B visual-behavior-authoring artifact drifted.",
    );
  }
  const artifact = parseJson(artifactBytes, M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH);
  const predecessor = {
    task: "M10-T01A",
    gate: null,
    proofId: "desen-app-user-created-blank-project",
    path: M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
    bytes: M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PIN.bytes,
    sha256: M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PIN.sha256,
    profile: "desen.app.user-created-blank-project-proof.v1",
    result: "PASS",
    immutable: true,
  };
  const expectedClaim = {
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
  };
  const expectedAuthority = {
    source: {
      atomicInputConnection: true,
      operationTriggerBoundary: true,
      visualActionComposer: true,
      advancedJsonRetained: true,
      visualConditionalPresence: true,
      sourceAndCatalogDerivedFixtures: true,
      genericRunControls: true,
      requestInputRetained: false,
      browserTestName:
        "authors and saves a valid sign-in Source from the empty project in a real browser",
      browserTestDeclarations: 1,
      browserExecutionPerformedByReader: false,
    },
    package: {
      appPackageName: "@desen/app-web",
      browserPackageName: "@desen/app-browser-e2e",
      focusedTestCommand: "pnpm --filter @desen/app-web test:behavior-authoring",
      browserCommand: "pnpm --filter @desen/app-browser-e2e test:e2e",
      exactHeadBrowserExecution: true,
      catalogId: "run.desen.reference.sign-in",
      operationId: "com.example.auth/signIn",
      operationEffect: "network",
      catalogFixtureOnly: true,
    },
    execution: {
      browserSpec: "apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts",
      browserTestName:
        "authors and saves a valid sign-in Source from the empty project in a real browser",
      browserTestDeclarations: 1,
      browserExecutedByVerifier: false,
      deterministicReaderStartsListener: false,
    },
  };
  const expectedTests = {
    focusedCommand: "pnpm --filter @desen/app-web test:behavior-authoring",
    browserCommand: "pnpm --filter @desen/app-browser-e2e test:e2e",
    verifierCommand: "node scripts/verify-desen-app-visual-behavior-authoring.mjs",
    proofReaderCommand: "node --test tests/desen-app-visual-behavior-authoring.test.mjs",
    rootTestNames: [
      "[authority] authenticates the exact immutable M10-T01A predecessor",
      "[connection] binds controlled input value and change atomically",
      "[actions] exposes Catalog-aware visual actions with advanced JSON retained",
      "[visibility] authors operation and state predicates through public editor commands",
      "[fixtures] derives generic Run outcomes from Source aliases and Catalog fixtures",
      "[browser] visible UI repairs the bad binding and authors failure visibility",
      "[boundary] keeps planned T02 through T04 closure and real host authority unclaimed",
      "[determinism] builds byte-identical evidence with complete exact receipts",
      "[policy] rejects source, parent, artifact, report, option, and destination drift",
    ],
    browserExecutedByVerifier: false,
  };
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-visual-behavior-authoring" ||
    artifact?.profile !== "desen.app.visual-behavior-authoring-proof.v1" ||
    artifact?.task !== "M10-T01B" ||
    artifact?.gate !== null ||
    artifact?.result !== "PASS" ||
    !isDeepStrictEqual(artifact?.prerequisites, [predecessor]) ||
    !isDeepStrictEqual(artifact?.claim, expectedClaim) ||
    !isDeepStrictEqual(artifact?.authority, expectedAuthority) ||
    !isDeepStrictEqual(artifact?.tests, expectedTests) ||
    artifact?.boundary?.trackedFiles !== M10_VISUAL_BEHAVIOR_AUTHORING_RECEIPT_PATHS.length ||
    artifact?.boundary?.parentArtifacts !== 1 ||
    artifact?.boundary?.immutableInputs !== true ||
    artifact?.boundary?.sourceSymlinksRejected !== true ||
    artifact?.boundary?.browserExecutionSeparateFromStaticReader !== true ||
    !isDeepStrictEqual(artifact?.boundary?.checkpointOwnedReaderPaths, [
      "scripts/lib/desen-app-visual-behavior-authoring-proof.mjs",
      "tests/desen-app-visual-behavior-authoring.test.mjs",
    ]) ||
    !isDeepStrictEqual(artifact?.boundary?.artifactTrackedEntrypoints, [
      "scripts/lib/atomic-proof-artifact.mjs",
      "scripts/generate-desen-app-visual-behavior-authoring-proof.mjs",
      "scripts/verify-desen-app-visual-behavior-authoring.mjs",
    ]) ||
    !Array.isArray(trackedReceipts) ||
    trackedReceipts.length !== M10_VISUAL_BEHAVIOR_AUTHORING_RECEIPT_PATHS.length
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The immutable M10-T01B identity, claims, authority, tests, or predecessor drifted.",
    );
  }
  const receiptPaths = trackedReceipts.map((receipt) => receipt?.path);
  if (
    !isDeepStrictEqual(receiptPaths, M10_VISUAL_BEHAVIOR_AUTHORING_RECEIPT_PATHS) ||
    new Set(receiptPaths).size !== M10_VISUAL_BEHAVIOR_AUTHORING_RECEIPT_PATHS.length
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The immutable M10-T01B receipt closure is not exact, canonical, and unique.",
    );
  }
  for (const receipt of trackedReceipts) {
    const bytes = files.get(receipt.path);
    if (
      !isDeepStrictEqual(Object.keys(receipt), ["path", "bytes", "sha256"]) ||
      !Number.isSafeInteger(receipt.bytes) ||
      receipt.bytes < 0 ||
      !/^[0-9a-f]{64}$/u.test(receipt.sha256) ||
      bytes?.byteLength !== receipt.bytes ||
      sha256(bytes ?? Buffer.alloc(0)) !== receipt.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `The exact live M10-T01B receipt drifted: ${receipt.path}.`,
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
      "The exact live M10-T01B hosted-browser compatibility receipt drifted.",
    );
  }
  return deepFreeze({
    task: "M10-T01B",
    artifact: {
      path: M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH,
      bytes: pin.bytes,
      sha256: pin.sha256,
      immutable: true,
    },
    predecessor,
    currentProjection: {
      relationship: "EXACT_M10_T01B_ARTIFACT_OWNED_LIVE_RECEIPTS",
      artifactBackedPaths: M10_VISUAL_BEHAVIOR_AUTHORING_RECEIPT_PATHS,
      trackedReceipts,
      hostedBrowserCompatibility: {
        compatibilityReceipt: "M10-T01B-HOSTED-BROWSER-COMPAT",
        correctiveReceiptOnly: true,
        overriddenHistoricalPaths: [hostedBrowserReceipt.path],
        trackedReceipts: [hostedBrowserReceipt],
      },
    },
    trackedFiles: trackedReceipts.length,
    rootTests: expectedTests.rootTestNames.length,
    visualInputConnectionCovered: artifact.claim.visualInputConnectionCovered,
    visualOperationActionCovered: artifact.claim.visualOperationActionCovered,
    visualConditionalPresenceCovered: artifact.claim.visualConditionalPresenceCovered,
    catalogDerivedRunControlsCovered: artifact.claim.catalogDerivedRunControlsCovered,
    advancedJsonRetained: artifact.claim.advancedJsonRetained,
    authoredBrowserSmokeCovered: artifact.claim.authoredBrowserSmokeCovered,
    p08Status: artifact.claim.p08Status,
    p09Status: artifact.claim.p09Status,
    m10T02Closed: artifact.claim.m10T02Closed,
    m10T03Closed: artifact.claim.m10T03Closed,
    m10T04Closed: artifact.claim.m10T04Closed,
    realHostOperationCovered: artifact.claim.realHostOperationCovered,
    g10Closed: artifact.claim.g10Closed,
  });
}

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-design-run-modes-proof.mjs",
  "scripts/generate-desen-app-design-run-modes-proof.mjs",
  "scripts/verify-desen-app-design-run-modes.mjs",
  "tests/desen-app-design-run-modes.test.mjs",
]);

const SOURCE_PATHS = Object.freeze([
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  INSPECTOR_PANEL_PATH,
]);

const APP_TEST_PATHS = Object.freeze([ADAPTER_TEST_PATH, APPLICATION_TEST_PATH]);

const TRACKED_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  LOCKFILE_PATH,
  CATALOG_PATH,
  SOURCE_FIXTURE_PATH,
  BUNDLE_FIXTURE_PATH,
  ...SOURCE_PATHS,
  ...APP_TEST_PATHS,
  REAL_ADAPTER_ARTIFACT_PATH,
  STATE_BINDING_ARTIFACT_PATH,
  EVENT_ACTION_ARTIFACT_PATH,
  ...PROOF_READER_PATHS,
]);

const T11_SUCCESSOR_RECEIPT_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  LOCKFILE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  INSPECTOR_PANEL_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
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
  T14_PUBLICATION_APPLICATION_TEST_PATH,
  "apps/desen-app/test/publication-controls.test.tsx",
  "packages/editor-web/package.json",
  "packages/editor-web/src/index.ts",
  "packages/editor-web/src/local-bundle-channel-publication.ts",
  "packages/editor-web/test/local-bundle-channel-publication.test.ts",
  "packages/editor-web/test/public-package.mjs",
  "packages/editor-web/test/public-package.types.mts",
]);

const SUCCESSOR_COMPATIBILITY_PATHS = Object.freeze([
  ...T11_SUCCESSOR_RECEIPT_PATHS,
  ...T12_SUCCESSOR_RECEIPT_PATHS,
  ...T13_SUCCESSOR_RECEIPT_PATHS,
  ...T14_SUCCESSOR_RECEIPT_PATHS,
  "scripts/lib/desen-app-design-run-modes-proof.mjs",
  "tests/desen-app-design-run-modes.test.mjs",
]);

const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH,
  M10_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH,
  M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH,
  M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
  "dependency-cruiser.config.cjs",
  ...new Set([
    ...M10_VISUAL_BEHAVIOR_AUTHORING_RECEIPT_PATHS.filter(
      (relativePath) => relativePath !== M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
    ),
    ...TRACKED_PATHS,
    FIXTURES_SCENARIOS_ARTIFACT_PATH,
    SOURCE_PERSISTENCE_ARTIFACT_PATH,
    NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
    PUBLISH_ACTIVATION_ARTIFACT_PATH,
    ...T13_SUCCESSOR_RECEIPT_PATHS,
    ...T14_SUCCESSOR_RECEIPT_PATHS,
    ...T12_SUCCESSOR_RECEIPT_PATHS,
    ...M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS,
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
  "scripts/lib/desen-app-design-run-modes-proof.mjs",
  "tests/desen-app-design-run-modes.test.mjs",
]);

const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 17_900,
  sha256: "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334",
});

const T11_SUCCESSOR_ARTIFACT_PIN = Object.freeze({
  task: "M09-T11",
  proofId: "desen-app-fixtures-scenarios-fidelity",
  profile: "desen.app.fixtures-scenarios-fidelity-proof.v1",
  result: "PASS",
  path: FIXTURES_SCENARIOS_ARTIFACT_PATH,
  bytes: 29_407,
  sha256: "3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d",
});

const EXPECTED_ADAPTER_TEST_NAMES = Object.freeze([
  "runs real adapter events on the same session and preserves state across mode changes",
]);

const EXPECTED_APPLICATION_TEST_NAMES = Object.freeze([
  "switches modes accessibly while preserving selection, authoring views, and local drafts",
  "rejects stale hidden authoring callbacks while Run interactions leave Source unchanged",
  "resets the ephemeral mode to Design when a new surface route mounts",
]);

/** Exact immutable proof receipts that bound M09-T10 App authority. */
export const DESEN_APP_DESIGN_RUN_MODES_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M09-T03",
    proofId: "desen-app-real-adapter-canvas",
    path: REAL_ADAPTER_ARTIFACT_PATH,
    bytes: 73_111,
    sha256: "8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151",
    profile: "desen.app.real-adapter-canvas-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T08",
    proofId: "desen-app-state-binding-editor",
    path: STATE_BINDING_ARTIFACT_PATH,
    bytes: 28_766,
    sha256: "b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a",
    profile: "desen.app.state-binding-editor-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T09",
    proofId: "desen-app-event-action-editor",
    path: EVENT_ACTION_ARTIFACT_PATH,
    bytes: 23_812,
    sha256: "0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab",
    profile: "desen.app.event-action-editor-proof.v1",
    result: "PASS",
    immutable: true,
  }),
]);

/** Reviewed independent root-test names retained by the M09-T10 artifact. */
export const DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact T03, T08, and T09 parents",
  "[session] proves one immutable Source and Bundle across both modes",
  "[lifecycle] proves mode is excluded from Runtime mount identity",
  "[design] proves interaction-disabled selection and authoring only",
  "[run] proves adapter event to Runtime state action and rerender",
  "[safety] proves revision stability, central guards, and denied host ports",
  "[tests] pins accessible mode behavior, exclusions, and package commands",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects weakened mode, lifecycle, execution, and authoring sources",
  "[verification] rejects parents, artifact, report, and filesystem authority drift",
]);

/** Default destination for deterministic M09-T10 evidence. */
export const DEFAULT_DESEN_APP_DESIGN_RUN_MODES_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T10 evidence reader. */
export class DesenAppDesignRunModesProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppDesignRunModesProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppDesignRunModesProofError(code, message, details);
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
    if (error instanceof DesenAppDesignRunModesProofError) throw error;
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

function assertIncludes(source, markers, label, code = "SOURCE_POLICY_VIOLATION") {
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length !== 0) {
    fail(code, `${label} lost required event/action policy.`, { missing });
  }
}

function assertExcludes(source, markers, label) {
  const present = markers.filter((marker) => source.includes(marker));
  if (present.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} acquired forbidden authority.`, { present });
  }
}

function unwrapParenthesizedExpression(node) {
  let current = node;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function exactObjectPropertyInitializers(rawNode, expectedNames, label) {
  const node = unwrapParenthesizedExpression(rawNode);
  if (!ts.isObjectLiteralExpression(node)) {
    fail("SOURCE_POLICY_VIOLATION", `${label} must remain one exact object literal.`);
  }
  const actualNames = [];
  const properties = new Map();
  for (const property of node.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      !ts.isIdentifier(property.name) ||
      properties.has(property.name.text)
    ) {
      fail("SOURCE_POLICY_VIOLATION", `${label} admits only unique named data properties.`);
    }
    actualNames.push(property.name.text);
    properties.set(property.name.text, property.initializer);
  }
  if (!isDeepStrictEqual(actualNames, expectedNames)) {
    fail("SOURCE_POLICY_VIOLATION", `${label} field closure drifted.`, {
      actual: actualNames,
      expected: expectedNames,
    });
  }
  return properties;
}

function exactZeroArgumentArrow(rawNode, label) {
  const node = unwrapParenthesizedExpression(rawNode);
  if (
    !ts.isArrowFunction(node) ||
    node.parameters.length !== 0 ||
    (node.modifiers?.length ?? 0) !== 0
  ) {
    fail("SOURCE_POLICY_VIOLATION", `${label} must remain one synchronous zero-argument arrow.`);
  }
  return node.body;
}

function assertExactIdentifier(rawNode, expected, label) {
  const node = unwrapParenthesizedExpression(rawNode);
  if (!ts.isIdentifier(node) || node.text !== expected) {
    fail("SOURCE_POLICY_VIOLATION", `${label} result drifted.`);
  }
}

function assertExactString(rawNode, expected, label) {
  const node = unwrapParenthesizedExpression(rawNode);
  if (!ts.isStringLiteral(node) || node.text !== expected) {
    fail("SOURCE_POLICY_VIOLATION", `${label} result drifted.`);
  }
}

function assertExactStatusCallback(rawNode, status, label, withGeneration = false) {
  const result = exactZeroArgumentArrow(rawNode, label);
  const properties = exactObjectPropertyInitializers(
    result,
    withGeneration ? ["status", "generation"] : ["status"],
    `${label} result`,
  );
  assertExactString(properties.get("status"), status, `${label}.status`);
  if (withGeneration && properties.get("generation").kind !== ts.SyntaxKind.NullKeyword) {
    fail("SOURCE_POLICY_VIOLATION", `${label}.generation result drifted.`);
  }
}

function isExactRejectedEditResult(rawNode) {
  const node = unwrapParenthesizedExpression(rawNode);
  if (
    !ts.isCallExpression(node) ||
    node.arguments.length !== 1 ||
    !ts.isPropertyAccessExpression(node.expression) ||
    !ts.isIdentifier(node.expression.expression) ||
    node.expression.expression.text !== "Object" ||
    node.expression.name.text !== "freeze"
  ) {
    return false;
  }
  let properties;
  try {
    properties = exactObjectPropertyInitializers(
      node.arguments[0],
      ["ok", "reason"],
      "Run-mode rejected edit result",
    );
  } catch (error) {
    if (error instanceof DesenAppDesignRunModesProofError) return false;
    throw error;
  }
  return (
    unwrapParenthesizedExpression(properties.get("ok")).kind === ts.SyntaxKind.FalseKeyword &&
    ts.isStringLiteral(unwrapParenthesizedExpression(properties.get("reason"))) &&
    unwrapParenthesizedExpression(properties.get("reason")).text === "edit-rejected"
  );
}

function assertExactSnapshotGroup(rawNode, snapshotIdentifier, label) {
  const properties = exactObjectPropertyInitializers(rawNode, ["getSnapshot", "subscribe"], label);
  assertExactIdentifier(
    exactZeroArgumentArrow(properties.get("getSnapshot"), `${label}.getSnapshot`),
    snapshotIdentifier,
    `${label}.getSnapshot`,
  );
  const unsubscribe = exactZeroArgumentArrow(properties.get("subscribe"), `${label}.subscribe`);
  assertExactIdentifier(
    exactZeroArgumentArrow(unsubscribe, `${label}.subscribe result`),
    "undefined",
    `${label}.subscribe result`,
  );
}

function inspectRuntimeHostPorts(source) {
  const sourceFile = parseTypeScript(source, ADAPTER_SOURCE_PATH);
  const declarations = [];
  const calls = [];
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "ADAPTER_CANVAS_HOST_PORTS"
    ) {
      declarations.push(node);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "createRuntimeHostPorts"
    ) {
      calls.push(node);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (
    declarations.length !== 1 ||
    calls.length !== 1 ||
    declarations[0].initializer !== calls[0] ||
    calls[0].arguments.length !== 1
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "adapter-canvas.tsx must retain one exact host-port declaration.",
    );
  }

  const argument = calls[0].arguments[0];
  if (
    !ts.isSatisfiesExpression(argument) ||
    argument.type.getText(sourceFile) !== "RuntimeHostPorts"
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The host-port declaration must retain its RuntimeHostPorts closure.",
    );
  }
  const ports = exactObjectPropertyInitializers(
    argument.expression,
    [
      "navigation",
      "storage",
      "operations",
      "resources",
      "tokens",
      "context",
      "environment",
      "clock",
      "diagnostics",
    ],
    "ADAPTER_CANVAS_HOST_PORTS",
  );

  const navigation = exactObjectPropertyInitializers(
    ports.get("navigation"),
    ["navigate"],
    "hostPorts.navigation",
  );
  assertExactStatusCallback(navigation.get("navigate"), "denied", "hostPorts.navigation.navigate");

  const storage = exactObjectPropertyInitializers(
    ports.get("storage"),
    ["getBundle", "putBundle", "readActivation", "commitActivation"],
    "hostPorts.storage",
  );
  assertExactStatusCallback(storage.get("getBundle"), "missing", "hostPorts.storage.getBundle");
  assertExactStatusCallback(storage.get("putBundle"), "conflict", "hostPorts.storage.putBundle");
  assertExactStatusCallback(
    storage.get("readActivation"),
    "missing",
    "hostPorts.storage.readActivation",
  );
  assertExactStatusCallback(
    storage.get("commitActivation"),
    "conflict",
    "hostPorts.storage.commitActivation",
    true,
  );

  const operations = exactObjectPropertyInitializers(
    ports.get("operations"),
    ["invoke"],
    "hostPorts.operations",
  );
  assertExactStatusCallback(operations.get("invoke"), "denied", "hostPorts.operations.invoke");
  const resources = exactObjectPropertyInitializers(
    ports.get("resources"),
    ["load"],
    "hostPorts.resources",
  );
  assertExactStatusCallback(resources.get("load"), "denied", "hostPorts.resources.load");
  const tokens = exactObjectPropertyInitializers(
    ports.get("tokens"),
    ["resolve"],
    "hostPorts.tokens",
  );
  assertExactStatusCallback(tokens.get("resolve"), "missing", "hostPorts.tokens.resolve");

  assertExactSnapshotGroup(ports.get("context"), "EMPTY_RUNTIME_JSON", "hostPorts.context");
  assertExactSnapshotGroup(
    ports.get("environment"),
    "WEB_RUNTIME_ENVIRONMENT",
    "hostPorts.environment",
  );

  const clock = exactObjectPropertyInitializers(ports.get("clock"), ["now"], "hostPorts.clock");
  const clockResult = unwrapParenthesizedExpression(
    exactZeroArgumentArrow(clock.get("now"), "hostPorts.clock.now"),
  );
  if (!ts.isNumericLiteral(clockResult) || clockResult.text !== "1") {
    fail("SOURCE_POLICY_VIOLATION", "hostPorts.clock.now result drifted.");
  }
  const diagnostics = exactObjectPropertyInitializers(
    ports.get("diagnostics"),
    ["report"],
    "hostPorts.diagnostics",
  );
  assertExactIdentifier(
    exactZeroArgumentArrow(diagnostics.get("report"), "hostPorts.diagnostics.report"),
    "undefined",
    "hostPorts.diagnostics.report",
  );
}

function inspectRuntimeMountHostPorts(source) {
  const sourceFile = parseTypeScript(source, ADAPTER_SOURCE_PATH);
  const calls = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "mountRuntimeHeadlessSession"
    ) {
      calls.push(node);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  const argument = calls[0]?.arguments[0];
  if (
    calls.length !== 1 ||
    calls[0].arguments.length !== 1 ||
    argument === undefined ||
    !ts.isObjectLiteralExpression(argument) ||
    argument.properties.length !== 3
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The Runtime mount must retain one exact Bundle/Catalog/host-port tuple.",
    );
  }
  const [bundle, catalogs, hostPorts] = argument.properties;
  if (
    !ts.isShorthandPropertyAssignment(bundle) ||
    bundle.name.text !== "bundle" ||
    !ts.isPropertyAssignment(catalogs) ||
    !ts.isIdentifier(catalogs.name) ||
    catalogs.name.text !== "catalogs" ||
    !ts.isArrayLiteralExpression(catalogs.initializer) ||
    catalogs.initializer.elements.length !== 1 ||
    !ts.isIdentifier(catalogs.initializer.elements[0]) ||
    catalogs.initializer.elements[0].text !== "referenceCatalog" ||
    !ts.isShorthandPropertyAssignment(hostPorts) ||
    hostPorts.name.text !== "hostPorts"
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The Runtime mount must consume the exact App-owned hostPorts parameter.",
    );
  }
}

function inspectAdapterSource(source) {
  assertIncludes(
    source,
    [
      'export type DesenAdapterCanvasMode = "design" | "run"',
      'mode = "design"',
      "data-adapter-canvas-mode={mode}",
      'data-adapter-interactions={mode === "run" ? "enabled" : "disabled"}',
      'disabled={mode === "design"}',
      'mode === "design" && selectedDiagnostic !== undefined',
      "<DiagnosticPlaceholderOverlay",
      'mode === "design" ? (',
      "<SelectionOverlay projection={projection} />",
      "Run preview · real adapter controls use the selected synthetic fixture.",
      "mountRuntimeHeadlessSession({",
      "hostPorts = ADAPTER_CANVAS_HOST_PORTS",
      "hostPorts,",
      "<RuntimeReactSurfaceBoundary",
      "useRuntimeReactSurface(input)",
      'navigation: { navigate: () => ({ status: "denied" }) }',
      'operations: { invoke: () => ({ status: "denied" }) }',
      'resources: { load: () => ({ status: "denied" }) }',
      'getBundle: () => ({ status: "missing" })',
      'putBundle: () => ({ status: "conflict" })',
      'commitActivation: () => ({ status: "conflict", generation: null })',
    ],
    "adapter-canvas.tsx",
  );
  assertExcludes(
    source,
    [
      "window.fetch",
      "globalThis.fetch",
      "localStorage",
      "sessionStorage",
      "@desen/runtime-core/src",
      "@desen/runtime-react/src",
    ],
    "adapter-canvas.tsx",
  );
  inspectRuntimeMountIdentity(source);
  inspectRuntimeHostPorts(source);
  inspectRuntimeMountHostPorts(source);
  return deepFreeze({
    modes: ["design", "run"],
    designDefault: true,
    oneRuntimeSessionAcrossModeToggle: true,
    modeExcludedFromMountEffectIdentity: true,
    sameManagedCapabilitySubtree: true,
    designControlsDisabled: true,
    designSelectionOverlayOnly: true,
    runAdapterInteractionsEnabled: true,
    exactPublicRuntimeReactBoundary: true,
    hostPortsDeniedOrInert: true,
    externalEffectsDenied: true,
  });
}

function inspectRuntimeMountIdentity(source) {
  const sourceFile = parseTypeScript(source, ADAPTER_SOURCE_PATH);
  const mountEffects = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useEffect" &&
      node.arguments.length === 2 &&
      ts.isArrowFunction(node.arguments[0]) &&
      node.arguments[0].getText(sourceFile).includes("mountRuntimeHeadlessSession")
    ) {
      mountEffects.push(node);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (mountEffects.length !== 1) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "adapter-canvas.tsx must retain exactly one Runtime-mount effect.",
    );
  }
  const dependencies = mountEffects[0].arguments[1];
  if (!ts.isArrayLiteralExpression(dependencies)) {
    fail("SOURCE_POLICY_VIOLATION", "The Runtime-mount effect needs an explicit dependency list.");
  }
  const names = dependencies.elements.map((element) => element.getText(sourceFile));
  if (
    names.includes("mode") ||
    names.includes("selection") ||
    names.length !== 5 ||
    !["bundle", "hostPorts", "previewRevision", "routeIdentity", "supported"].every((name) =>
      names.includes(name),
    )
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Mode or authoring state entered Runtime mount identity.", {
      dependencies: names,
    });
  }
}

function inspectApplicationSource(source) {
  assertIncludes(
    source,
    [
      'type SurfaceEditorMode = "design" | "run"',
      'useState<SurfaceEditorMode>("design")',
      'const modeRef = useRef<SurfaceEditorMode>("design")',
      "function isDesignMode()",
      'modeRef.current !== "design"',
      'role="group"',
      'aria-label="Design and Run mode"',
      'aria-pressed={mode === "design"}',
      'aria-pressed={mode === "run"}',
      "data-mode={mode}",
      "mode={mode}",
      'selection={mode === "design" ? selection : null}',
      'interactive={mode === "design" && !publicationPending}',
      "Object.freeze({ document: result.document, preview: nextPreview })",
    ],
    "application.tsx",
  );
  assertExcludes(
    source,
    [
      "@desen/runtime-core/src",
      "@desen/runtime-react/src",
      "@desen/editor-core/src",
      "@desen/publisher/src",
      "localStorage",
      "sessionStorage",
      "window.fetch",
    ],
    "application.tsx",
  );
  inspectCentralAuthoringGuards(source);
  inspectModeToggleFlow(source);
  return deepFreeze({
    modeState: "App-owned closed union",
    oneImmutableAuthoringSession: true,
    sameDocumentAndPreviewAcrossToggle: true,
    exactBundleRevisionUnchanged: true,
    exactSourceRevisionUnchanged: true,
    centralRunModeAuthoringGuards: true,
    runSelectionSuppressed: true,
    runPanelsMountedButNoninteractive: true,
    accessiblePressedModeControl: true,
    liveSafetyStatus: true,
  });
}

function inspectModeToggleFlow(source) {
  const sourceFile = parseTypeScript(source, APPLICATION_SOURCE_PATH);
  const matches = [];
  const visit = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "chooseMode" &&
      node.body !== undefined
    ) {
      matches.push(node.body.getText(sourceFile));
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (matches.length !== 1) {
    fail("SOURCE_POLICY_VIOLATION", "application.tsx must retain exactly one mode transition.");
  }
  assertIncludes(
    matches[0],
    ["modeRef.current = nextMode", "setMode(nextMode)", ".current?.focus()"],
    "chooseMode",
  );
  assertExcludes(
    matches[0],
    [
      "setAuthoringSession",
      "setSelection",
      "prepareAuthoringPreviewBundle",
      "mountRuntimeHeadlessSession",
    ],
    "chooseMode",
  );
}

function inspectCentralAuthoringGuards(source) {
  const sourceFile = parseTypeScript(source, APPLICATION_SOURCE_PATH);
  inspectDesignModePredicate(sourceFile);
  const expectedNames = [
    "toggleSelection",
    "editSelectedProperty",
    "editSelectedBinding",
    "editLocalState",
    "editSelectedEventAction",
    "editNamedSlot",
    "deleteSelectedLayer",
  ];
  const guardedFunctions = new Map(expectedNames.map((name) => [name, []]));
  const visit = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name !== undefined &&
      expectedNames.includes(node.name.text) &&
      node.body !== undefined
    ) {
      guardedFunctions.get(node.name.text).push(node);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  for (const name of expectedNames) {
    const declarations = guardedFunctions.get(name);
    if (declarations.length !== 1) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        "application.tsx lost the exact central Run-mode authoring guard coverage.",
        { function: name, declarations: declarations.length },
      );
    }
    const effectiveStatements = declarations[0].body.statements.filter(
      (statement) =>
        !ts.isEmptyStatement(statement) &&
        !(ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)),
    );
    const guard = effectiveStatements[0];
    if (
      guard === undefined ||
      !ts.isIfStatement(guard) ||
      guard.elseStatement !== undefined ||
      !ts.isPrefixUnaryExpression(guard.expression) ||
      guard.expression.operator !== ts.SyntaxKind.ExclamationToken ||
      !ts.isCallExpression(guard.expression.operand) ||
      guard.expression.operand.arguments.length !== 0 ||
      !ts.isIdentifier(guard.expression.operand.expression) ||
      guard.expression.operand.expression.text !== "isDesignMode"
    ) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        `The ${name} Design guard must be its first effective statement.`,
      );
    }
    const consequent = ts.isBlock(guard.thenStatement)
      ? guard.thenStatement.statements.length === 1
        ? guard.thenStatement.statements[0]
        : undefined
      : guard.thenStatement;
    if (consequent === undefined || !ts.isReturnStatement(consequent)) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        `The ${name} Design guard must directly return before authoring work.`,
      );
    }
    if (name === "toggleSelection") {
      if (consequent.expression !== undefined) {
        fail("SOURCE_POLICY_VIOLATION", "toggleSelection must return inertly in Run mode.");
      }
    } else if (
      consequent.expression === undefined ||
      !isExactRejectedEditResult(consequent.expression)
    ) {
      fail("SOURCE_POLICY_VIOLATION", `${name} must return the exact rejected edit result.`);
    }
  }
}

function inspectDesignModePredicate(sourceFile) {
  const declarations = [];
  const visit = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "isDesignMode" &&
      node.body !== undefined
    ) {
      declarations.push(node);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  const declaration = declarations[0];
  const statements = declaration?.body?.statements.filter(
    (statement) =>
      !ts.isEmptyStatement(statement) &&
      !(ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)),
  );
  if (
    declarations.length !== 1 ||
    declaration.parameters.length !== 0 ||
    declaration.asteriskToken !== undefined ||
    (declaration.modifiers?.length ?? 0) !== 0 ||
    declaration.type?.kind !== ts.SyntaxKind.BooleanKeyword ||
    !isDeepStrictEqual(
      statements.map((statement) => statement.getText(sourceFile)),
      [
        'if (modeRef.current !== "design") return false;',
        "if (publicationController === null) return true;",
        "if (publicationControllerLifetime.current !== publicationController) return false;",
        "const current = publicationController.read();",
        "return !current.disposed && current.pending === null;",
      ],
    )
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "isDesignMode must retain exact Design-mode and publication-lifetime admission.",
    );
  }
}

function inspectInspectorSource(source) {
  assertIncludes(
    source,
    [
      "readonly hidden?: boolean | undefined",
      "hidden = false",
      "hidden={hidden}",
      "data-preserve-inspector-draft='true'",
    ],
    "inspector-panel.tsx",
  );
  assertExcludes(source, ["@desen/runtime-core", "@desen/runtime-react"], "inspector-panel.tsx");
  return deepFreeze({
    hiddenAdmissionExplicit: true,
    runMutationControlsUnreachable: true,
    modeTogglePreservesUnappliedDraft: true,
    remainsAppOwnedChrome: true,
  });
}

function inspectCssSource(source) {
  const responsiveDisclosureOwner = `.workspaceLifecycle,
  .workspaceBoundary {
    width: 100%;
  }`;
  const responsiveDisclosurePopover = `.workspaceLifecycleBody,
  .workspaceBoundary p {
    inset-inline: 0;
    width: auto;
  }`;
  assertIncludes(
    source,
    [
      ".modeControl {",
      ".surfaceEditor::before {",
      ".canvasWorkspace {",
      ".canvasFrame {",
      "@media (max-width: 64rem) {",
      responsiveDisclosureOwner,
      responsiveDisclosurePopover,
    ],
    "application.module.css",
  );
  assertExcludes(
    source,
    [
      "pointer-events: auto !important",
      '.surfaceEditor[data-mode="run"]',
      '.surfaceFrame[data-mode="run"]',
    ],
    "application.module.css",
  );
  return deepFreeze({
    visibleModeControl: true,
    sharedDesignRunWorkplane: true,
    stableModeFrameCoordinates: true,
    noManagedCapabilityTreeOwnership: true,
    responsiveDisclosureOwnerFullWidth: true,
    responsiveDisclosureBothInlineEdgesClamped: true,
    responsiveDisclosureWidthAuto: true,
  });
}

/** Verifies exact source-policy markers without retaining caller-owned source text. */
export function verifyDesenAppDesignRunModesSourcePolicy(rawInput) {
  const keys = ["adapterSource", "applicationCss", "applicationSource", "inspectorSource"];
  const input = exactOwnDataOptions(rawInput, keys, "source policy input");
  for (const key of keys) {
    if (typeof input[key] !== "string" || input[key].includes("\0")) {
      fail("SOURCE_POLICY_VIOLATION", key + " must be exact source text.");
    }
  }
  return deepFreeze({
    adapter: inspectAdapterSource(input.adapterSource),
    application: inspectApplicationSource(input.applicationSource),
    inspector: inspectInspectorSource(input.inspectorSource),
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

function collectTestNames(rawSource, relativePath) {
  const sourceFile = parseTypeScript(rawSource, relativePath);
  const names = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const direct =
        ts.isIdentifier(node.expression) && ["it", "test"].includes(node.expression.text);
      const parameterized =
        ts.isCallExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        ts.isIdentifier(node.expression.expression.expression) &&
        ["it", "test"].includes(node.expression.expression.expression.text) &&
        node.expression.expression.name.text === "each";
      if (direct || parameterized) names.push(node.arguments[0].text);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return names;
}

function requireTestNames(actual, expected, relativePath) {
  const missing = expected.filter((name) => !actual.includes(name));
  if (missing.length !== 0) {
    fail("TEST_POLICY_VIOLATION", `${relativePath} lost required tests.`, { missing });
  }
}

function namedTestBody(rawSource, relativePath, testName) {
  const sourceFile = parseTypeScript(rawSource, relativePath);
  const bodies = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length >= 2 &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === testName &&
      ((ts.isIdentifier(node.expression) && ["it", "test"].includes(node.expression.text)) ||
        (ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          ["it", "test"].includes(node.expression.expression.text)))
    ) {
      bodies.push(node.arguments[1].getText(sourceFile));
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (bodies.length !== 1) {
    fail(
      "TEST_POLICY_VIOLATION",
      `${relativePath} must contain exactly one ${testName} test body.`,
    );
  }
  return bodies[0];
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
  requireTestNames(names[ADAPTER_TEST_PATH], EXPECTED_ADAPTER_TEST_NAMES, ADAPTER_TEST_PATH);
  requireTestNames(
    names[APPLICATION_TEST_PATH],
    EXPECTED_APPLICATION_TEST_NAMES,
    APPLICATION_TEST_PATH,
  );

  const adapterModeTest = namedTestBody(
    sources.get(ADAPTER_TEST_PATH),
    ADAPTER_TEST_PATH,
    EXPECTED_ADAPTER_TEST_NAMES[0],
  );
  assertIncludes(
    adapterModeTest,
    [
      "expect(runCanvas).toBe(designCanvas)",
      "managedSubtree",
      "expect(lifecycle.mounted).toEqual([session])",
      "expect(lifecycle.disposed).toHaveLength(0)",
      'fireEvent.change(email, { target: { value: "run-mode@example.test" } })',
      '"value",\n      "run-mode@example.test"',
      'mode="run"',
      'mode="design"',
    ],
    "adapter Design/Run test",
    "TEST_POLICY_VIOLATION",
  );

  const applicationSource = sources.get(APPLICATION_TEST_PATH);
  const accessibleModeTest = namedTestBody(
    applicationSource,
    APPLICATION_TEST_PATH,
    EXPECTED_APPLICATION_TEST_NAMES[0],
  );
  assertIncludes(
    accessibleModeTest,
    [
      'getByRole("group", { name: "Design and Run mode" })',
      'getByRole("button", { name: "Run" })',
      'getByRole("button", { name: "Design" })',
      "expect(document.activeElement).toBe(runButton)",
      "expect((authoring as HTMLElement).hidden).toBe(true)",
      "expect((inspector as HTMLElement).hidden).toBe(true)",
      'componentSearch.value).toBe("feedback")',
      'value,\n    ).toBe("Unapplied design hint")',
      'placeholder,\n    ).toBe("Work email")',
    ],
    "accessible application Design/Run test",
    "TEST_POLICY_VIOLATION",
  );
  const runGuardTest = namedTestBody(
    applicationSource,
    APPLICATION_TEST_PATH,
    EXPECTED_APPLICATION_TEST_NAMES[1],
  );
  assertIncludes(
    runGuardTest,
    [
      "const preflightCountInRun = previewPreflight.mock.calls.length",
      "fireEvent.click(staleApply)",
      "fireEvent.click(staleDelete)",
      "toHaveBeenCalledTimes(preflightCountInRun)",
      'fireEvent.change(liveEmail, { target: { value: "runtime@example.com" } })',
      'placeholder,\n    ).toBe("")',
    ],
    "application Run guard test",
    "TEST_POLICY_VIOLATION",
  );
  const routeResetTest = namedTestBody(
    applicationSource,
    APPLICATION_TEST_PATH,
    EXPECTED_APPLICATION_TEST_NAMES[2],
  );
  assertIncludes(
    routeResetTest,
    [
      'fireEvent.click(screen.getByRole("button", { name: "Run" }))',
      'window.location.pathname).toBe("/projects/account-app/surfaces/recovery")',
      'getByRole("button", { name: "Design" }).getAttribute("aria-pressed")',
    ],
    "application route reset test",
    "TEST_POLICY_VIOLATION",
  );

  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:design-run && node --test tests/desen-app-design-run-modes.test.mjs",
    appTestNames: names,
    rootTestNames: DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES,
    localCommandReceipts: {
      adapter: {
        command: "pnpm --filter @desen/app-web exec vitest run test/adapter-canvas.test.tsx",
        result: "PASS",
        testFiles: 1,
        tests: 9,
      },
      application: {
        command: "pnpm --filter @desen/app-web exec vitest run test/application.test.tsx",
        result: "PASS",
        testFiles: 1,
        tests: 35,
      },
      focusedDesignRun: {
        command: "pnpm --filter @desen/app-web test:design-run",
        result: "PASS",
        testFiles: 2,
        tests: 44,
      },
      fullApp: {
        command: "pnpm --filter @desen/app-web test",
        result: "PASS",
        testFiles: 15,
        tests: 210,
      },
      rootProof: {
        command: "node --test tests/desen-app-design-run-modes.test.mjs",
        result: "PASS",
        testFiles: 1,
        tests: 10,
      },
    },
    semanticCoverage: [
      "ONE_IMMUTABLE_SOURCE_AND_BUNDLE_SESSION",
      "MODE_EXCLUDED_FROM_RUNTIME_MOUNT_IDENTITY",
      "ZERO_REMOUNT_OR_DISPOSE_ON_TOGGLE",
      "SAME_MANAGED_CAPABILITY_SUBTREE",
      "DESIGN_INTERACTIONS_DISABLED_AND_SELECTION_ONLY",
      "RUN_ADAPTER_EVENT_TO_RUNTIME_STATE_SET_RERENDER",
      "SOURCE_AND_BUNDLE_REVISION_STABLE",
      "CENTRAL_RUN_AUTHORING_GUARDS",
      "ALL_EXTERNAL_HOST_PORTS_DENIED_OR_INERT",
      "ACCESSIBLE_DESIGN_RUN_CONTROL",
      "FIXTURE_PERSISTENCE_DIAGNOSTICS_PUBLICATION_E2E_EXCLUDED",
    ],
  });
}

function inspectPackages(files) {
  const root = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const appCommand = "vitest run test/adapter-canvas.test.tsx test/application.test.tsx";
  if (app.scripts?.["test:design-run"] !== appCommand) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact App Design/Run test command drifted.");
  }
  const prefix =
    "node scripts/verify-desen-app-real-adapter-canvas.mjs && node scripts/verify-desen-app-state-binding-editor.mjs && node scripts/verify-desen-app-event-action-editor.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:design-run && ";
  const expectedRootCommands = {
    "generate:desen-app-design-run-modes":
      prefix + "node scripts/generate-desen-app-design-run-modes-proof.mjs",
    "verify:desen-app-design-run-modes":
      prefix + "node scripts/verify-desen-app-design-run-modes.mjs",
    "test:desen-app-design-run-modes":
      prefix + "node --test tests/desen-app-design-run-modes.test.mjs",
  };
  for (const [name, command] of Object.entries(expectedRootCommands)) {
    if (root.scripts?.[name] !== command) {
      fail("PACKAGE_POLICY_VIOLATION", "The exact " + name + " command drifted.");
    }
  }
  for (const dependency of [
    "@desen/catalog-sdk",
    "@desen/editor-core",
    "@desen/protocol",
    "@desen/publisher",
    "@desen/runtime-core",
    "@desen/runtime-react",
    "@desen/validator",
  ]) {
    if (app.dependencies?.[dependency] !== "workspace:*") {
      fail("PACKAGE_POLICY_VIOLATION", "The App lost public dependency " + dependency + ".");
    }
  }
  return deepFreeze({
    appName: app.name,
    appTestCommand: appCommand,
    rootCommands: expectedRootCommands,
    parentsAuthenticatedInsideReader: true,
  });
}

function authenticateParent(bytes, pin) {
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", `The exact frozen ${pin.task} parent artifact changed.`);
  }
  const artifact = parseJson(bytes, `frozen ${pin.task} parent artifact`);
  if (
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result
  ) {
    fail("PARENT_DRIFT", `The frozen ${pin.task} identity drifted.`);
  }
  if (
    pin.proofId === "desen-app-real-adapter-canvas" &&
    (artifact.claim?.exactOfficialBundleMounted !== true ||
      artifact.claim?.exactPublicRuntimeReactRendererUsed !== true ||
      artifact.claim?.managedCompositionRegistryOnly !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T03 Runtime canvas authority claims drifted.");
  }
  if (
    pin.proofId === "desen-app-state-binding-editor" &&
    (artifact.claim?.surfaceLocalPrimitiveStateList !== true ||
      artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
      artifact.claim?.stateAndBindingChromeOutsideManagedCapabilitySubtree !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T08 App authority claims drifted.");
  }
  if (
    pin.proofId === "desen-app-event-action-editor" &&
    (artifact.claim?.closedActionTypes?.includes("state.set") !== true ||
      artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
      artifact.claim?.publicEditorCoreEventActionMutation !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T09 event/action authority claims drifted.");
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
    "frozen M09-T10 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T10 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T10 proof artifact");
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-design-run-modes" ||
    artifact?.profile !== "desen.app.design-run-modes-proof.v1" ||
    artifact?.task !== "M09-T10" ||
    artifact?.result !== "PASS" ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.oneImmutableSourceAndBundleSession !== true ||
    artifact?.claim?.modeExcludedFromRuntimeMountIdentity !== true ||
    artifact?.claim?.zeroRuntimeRemountOrDisposeOnToggle !== true ||
    artifact?.claim?.sameManagedCapabilitySubtreeOnToggle !== true ||
    artifact?.claim?.designControlsDisabled !== true ||
    artifact?.claim?.runAdapterEventToRuntimeStateSet !== true ||
    artifact?.claim?.runStateSetRerendersAdapter !== true ||
    artifact?.claim?.centralAuthoringGuardsInRun !== true ||
    artifact?.claim?.allExternalHostPortsDeniedOrInert !== true ||
    artifact?.claim?.fixturesAndScenariosClaimed !== false ||
    artifact?.claim?.persistenceClaimed !== false ||
    artifact?.claim?.diagnosticsClaimed !== false ||
    artifact?.claim?.publicationClaimed !== false ||
    artifact?.claim?.activationClaimed !== false ||
    artifact?.claim?.browserE2eClaimed !== false ||
    artifact?.claim?.p08Status !== "NOT_PROVEN" ||
    artifact?.claim?.p09Status !== "PARTIAL" ||
    artifact?.claim?.pf028Status !== "OPEN" ||
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
    !isDeepStrictEqual(artifact?.tests?.rootTestNames, DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES)
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T10 artifact identity or retained claims drifted.");
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
    const authority = taskTimeReceipts.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      authority === undefined ||
      bytes === undefined ||
      authority.bytes !== bytes.byteLength ||
      authority.sha256 !== sha256(bytes)
    ) {
      fail("BOUNDARY_DRIFT", `A retained M09-T10 task-time receipt drifted: ${relativePath}.`);
    }
  }
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
      M10_VISUAL_BEHAVIOR_AUTHORING_RECEIPT_PATHS.includes(relativePath) ||
      M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS.includes(relativePath) ||
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
      M10_VISUAL_BEHAVIOR_AUTHORING_RECEIPT_PATHS.includes(relativePath) ||
      M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS.includes(relativePath) ||
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
    artifactBytes.byteLength !== T11_SUCCESSOR_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== T11_SUCCESSOR_ARTIFACT_PIN.sha256
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T11 artifact bytes drifted.");
  }
  const artifact = parseJson(artifactBytes, FIXTURES_SCENARIOS_ARTIFACT_PATH);
  const parent = artifact.prerequisites?.[0];
  const testCaseCounts = artifact.tests?.testCaseCounts;
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  if (
    artifact.task !== T11_SUCCESSOR_ARTIFACT_PIN.task ||
    artifact.proofId !== T11_SUCCESSOR_ARTIFACT_PIN.proofId ||
    artifact.profile !== T11_SUCCESSOR_ARTIFACT_PIN.profile ||
    artifact.result !== T11_SUCCESSOR_ARTIFACT_PIN.result ||
    parent?.task !== "M09-T10" ||
    parent?.proofId !== "desen-app-design-run-modes" ||
    parent?.bytes !== FROZEN_ARTIFACT_PIN.bytes ||
    parent?.sha256 !== FROZEN_ARTIFACT_PIN.sha256 ||
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
    artifact.claim?.persistenceClaimed !== false ||
    artifact.claim?.diagnosticsClaimed !== false ||
    artifact.claim?.publicationClaimed !== false ||
    artifact.claim?.activationClaimed !== false ||
    artifact.claim?.browserE2eClaimed !== false ||
    artifact.claim?.p08Status !== "NOT_PROVEN" ||
    artifact.claim?.p09Status !== "PARTIAL" ||
    artifact.claim?.s001Status !== "TESTED" ||
    artifact.claim?.pf028Status !== "CLOSED" ||
    artifact.tests?.focusedTestCases !== 86 ||
    testCaseCounts?.[ADAPTER_TEST_PATH] !== 10 ||
    testCaseCounts?.[APPLICATION_TEST_PATH] !== 40 ||
    !Array.isArray(trackedReceipts)
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T11 artifact identity or claims drifted.");
  }
  const receiptMap = reviewedSuccessorReceiptMap(trackedReceipts);
  for (const relativePath of T11_SUCCESSOR_RECEIPT_PATHS) {
    if (
      M10_VISUAL_BEHAVIOR_AUTHORING_RECEIPT_PATHS.includes(relativePath) ||
      M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS.includes(relativePath) ||
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
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `The live M09-T11 successor receipt drifted: ${relativePath}.`,
      );
    }
  }
  return deepFreeze({
    task: T11_SUCCESSOR_ARTIFACT_PIN.task,
    artifact: T11_SUCCESSOR_ARTIFACT_PIN,
    exactDesignRunParent: FROZEN_ARTIFACT_PIN,
    scenarioSourceAndBundleEphemeral: true,
    authoredSourceAndPublishablePreviewUnchanged: true,
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
    persistenceImplemented: false,
    diagnosticsImplemented: false,
    publicationImplemented: false,
    activationImplemented: false,
    browserE2eImplemented: false,
  });
}

function isExactPublicationApplicationTimeoutSuccessor(bytes) {
  if (
    bytes.byteLength !== T14_LIVE_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
    sha256(bytes) !== T14_LIVE_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256
  ) {
    return false;
  }
  const source = decodeUtf8(bytes, T14_PUBLICATION_APPLICATION_TEST_PATH);
  const liveClosing = "  }, 10_000);";
  if (source.split(liveClosing).length - 1 !== 1) return false;
  const frozenBytes = Buffer.from(source.replace(liveClosing, "  });"));
  if (
    frozenBytes.byteLength !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
    sha256(frozenBytes) !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256
  ) {
    return false;
  }
  const sourceFile = parseTypeScript(source, T14_PUBLICATION_APPLICATION_TEST_PATH);
  let namedTestCalls = 0;
  let exactTimeoutCalls = 0;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "it" &&
      node.arguments.length >= 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text ===
        "does not surface late replaced-port or unmounted settlements as current success"
    ) {
      namedTestCalls += 1;
      if (
        node.arguments.length === 3 &&
        ts.isNumericLiteral(node.arguments[2]) &&
        node.arguments[2].getText(sourceFile) === "10_000"
      ) {
        exactTimeoutCalls += 1;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return namedTestCalls === 1 && exactTimeoutCalls === 1;
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
    if (M10_VISUAL_BEHAVIOR_AUTHORING_RECEIPT_PATHS.includes(relativePath)) continue;
    if (M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS.includes(relativePath)) continue;
    const receipt = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (relativePath === T14_PUBLICATION_APPLICATION_TEST_PATH) {
      if (
        receipt?.bytes !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
        receipt.sha256 !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256 ||
        bytes === undefined ||
        !isExactPublicationApplicationTimeoutSuccessor(bytes)
      ) {
        fail(
          "SUCCESSOR_POLICY_VIOLATION",
          `The exact live M09-T14 timeout successor drifted: ${relativePath}.`,
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

/** Retained task-time builder used only to define the frozen M09-T10 evidence shape. */
async function _buildFreshDesenAppDesignRunModesEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  const parents = DESEN_APP_DESIGN_RUN_MODES_PARENT_PINS.map((pin) =>
    authenticateParent(files.get(pin.path), pin),
  );
  const source = verifyDesenAppDesignRunModesSourcePolicy({
    adapterSource: decodeUtf8(files.get(ADAPTER_SOURCE_PATH), ADAPTER_SOURCE_PATH),
    applicationSource: decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    applicationCss: decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH),
    inspectorSource: decodeUtf8(files.get(INSPECTOR_PANEL_PATH), INSPECTOR_PANEL_PATH),
  });
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const trackedReceipts = receipts(files);
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-design-run-modes",
    profile: "desen.app.design-run-modes-proof.v1",
    task: "M09-T10",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: parents,
    claim: {
      taskStatus: "DONE",
      oneImmutableSourceAndBundleSession: true,
      modeExcludedFromRuntimeMountIdentity: true,
      zeroRuntimeRemountOrDisposeOnToggle: true,
      sameManagedCapabilitySubtreeOnToggle: true,
      designControlsDisabled: true,
      designSelectionAndAuthoringOnly: true,
      runAdapterEventToRuntimeStateSet: true,
      runStateSetRerendersAdapter: true,
      sourceRevisionUnchangedOnToggle: true,
      bundleRevisionUnchangedOnToggle: true,
      centralAuthoringGuardsInRun: true,
      allExternalHostPortsDeniedOrInert: true,
      accessibleModeControl: true,
      fixturesAndScenariosClaimed: false,
      persistenceClaimed: false,
      diagnosticsClaimed: false,
      publicationClaimed: false,
      activationClaimed: false,
      browserE2eClaimed: false,
      p08Status: "NOT_PROVEN",
      p09Status: "PARTIAL",
      pf025Status: "OPEN",
      pf028Status: "OPEN",
      pf083Status: "OPEN",
    },
    authority: {
      protocolProfiles: {
        design: "App selection and authoring chrome; Runtime controls disabled",
        run: "exact public adapter event through Runtime React/Core action execution",
        session: "one immutable {document, preview} with the same Source and Bundle revision",
        lifecycle: "mode excluded from Runtime mount-effect identity",
        hostPorts: "navigation, operations, resources denied; storage/tokens missing or conflict",
      },
      source,
    },
    application: {
      package: packageContract,
      modeFlow: [
        "one App-owned closed Design/Run state",
        "same immutable authoring Source and Publisher Bundle session",
        "mode excluded from Runtime session mount identity",
        "Design disables managed controls and admits selection/authoring",
        "Run suppresses selection and centrally rejects authoring",
        "Run adapter event enters Runtime React then Runtime Core",
        "closed state.set action updates Runtime local state",
        "Runtime React rerenders the same managed capability subtree",
      ],
      ownership: {
        modeControl: "Desen App sibling chrome",
        selectionOverlay: "Design-only App sibling chrome",
        managedCapabilitySubtree: "exact Runtime React adapter output",
        execution: "Runtime Core through public Runtime React bridge",
      },
    },
    tests,
    boundary: {
      trackedFiles: TRACKED_PATHS.length,
      trackedReceipts,
      proofReaderPaths: PROOF_READER_PATHS,
      parentArtifacts: 3,
      immutableInputs: true,
      sourceSymlinksRejected: true,
    },
    result: "PASS",
    nonclaims: [
      "M09-T10 proves only the controlled sign-in Design/Run slice on one in-memory session.",
      "Fixtures and scenarios remain M09-T11; no operation fixture or scenario orchestration is claimed.",
      "M09-T12 is NOT_PROVEN: no save/open or durable persistence UI is claimed.",
      "M09-T13 is NOT_PROVEN: no node-linked diagnostics navigation or placeholder UI is claimed.",
      "M09-T14 is NOT_PROVEN: no control-plane publication or channel activation is claimed.",
      "G09 and real-browser E2E remain NOT_PROVEN.",
      "P-08 remains NOT_PROVEN until persistence, publication, and browser-E2E owners pass.",
      "P-09 is PARTIAL: state.set is exercised; operation lifecycle remains a later owner.",
      "PF-025, PF-028, and PF-083 remain OPEN; Design/Run presentation does not provide operation fixtures or amend protocol vocabulary.",
      "No required-gate, global CI count, or hosted-CI pass is inferred from local evidence.",
    ],
  });
  const artifactBytes = canonicalArtifactBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

/** Authenticates frozen M09-T10 evidence and checks its exact additive M09-T11 successor. */
export async function buildDesenAppDesignRunModesEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files] = await Promise.all([
    authenticateFrozenArtifact(workspaceRoot),
    readTrackedFiles(workspaceRoot, options.fileOverrides),
  ]);
  const parents = DESEN_APP_DESIGN_RUN_MODES_PARENT_PINS.map((pin) =>
    authenticateParent(files.get(pin.path), pin),
  );
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const source = verifyDesenAppDesignRunModesSourcePolicy({
    adapterSource: decodeUtf8(files.get(ADAPTER_SOURCE_PATH), ADAPTER_SOURCE_PATH),
    applicationSource: decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    applicationCss: decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH),
    inspectorSource: decodeUtf8(files.get(INSPECTOR_PANEL_PATH), INSPECTOR_PANEL_PATH),
  });
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const successor = authenticateFixturesScenariosSuccessor(files);
  const sourcePersistenceSuccessor = authenticateSourcePersistenceSuccessor(files);
  const nodeLinkedDiagnosticsSuccessor = authenticateNodeLinkedDiagnosticsSuccessor(files);
  const publishActivationSuccessor = authenticatePublishActivationSuccessor(files);
  const emptyProjectBrowserE2eSuccessor = authenticateM10EmptyProjectBrowserE2eSuccessor(files);
  const userCreatedBlankProjectSuccessor = authenticateM10UserCreatedBlankProjectSuccessor(files);
  const visualBehaviorAuthoringSuccessor = authenticateM10VisualBehaviorAuthoringSuccessor(files);
  const currentCompatibility = deepFreeze({
    emptyProjectBrowserE2eSuccessor,
    userCreatedBlankProjectSuccessor,
    visualBehaviorAuthoringSuccessor,
    schemaVersion: 1,
    proofId: "desen-app-design-run-modes",
    profile: "desen.app.design-run-modes-proof.v1",
    task: "M09-T10",
    result: "PASS",
    prerequisites: parents,
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      oneImmutableSourceAndBundleSession: frozen.artifact.claim.oneImmutableSourceAndBundleSession,
      modeExcludedFromRuntimeMountIdentity:
        frozen.artifact.claim.modeExcludedFromRuntimeMountIdentity,
      zeroRuntimeRemountOrDisposeOnToggle:
        frozen.artifact.claim.zeroRuntimeRemountOrDisposeOnToggle,
      sameManagedCapabilitySubtreeOnToggle:
        frozen.artifact.claim.sameManagedCapabilitySubtreeOnToggle,
      designControlsDisabled: frozen.artifact.claim.designControlsDisabled,
      designSelectionAndAuthoringOnly: frozen.artifact.claim.designSelectionAndAuthoringOnly,
      runAdapterEventToRuntimeStateSet: frozen.artifact.claim.runAdapterEventToRuntimeStateSet,
      runStateSetRerendersAdapter: frozen.artifact.claim.runStateSetRerendersAdapter,
      sourceRevisionUnchangedOnToggle: frozen.artifact.claim.sourceRevisionUnchangedOnToggle,
      bundleRevisionUnchangedOnToggle: frozen.artifact.claim.bundleRevisionUnchangedOnToggle,
      centralAuthoringGuardsInRun: frozen.artifact.claim.centralAuthoringGuardsInRun,
      baselineExternalHostPortsDeniedOrInert:
        frozen.artifact.claim.allExternalHostPortsDeniedOrInert,
    },
    source,
    successor,
    sourcePersistenceSuccessor,
    nodeLinkedDiagnosticsSuccessor,
    publishActivationSuccessor,
    package: packageContract,
    testPolicy: {
      adapterTestNames: tests.appTestNames[ADAPTER_TEST_PATH],
      applicationTestNames: tests.appTestNames[APPLICATION_TEST_PATH],
      rootTestNames: tests.rootTestNames,
    },
    boundary: {
      retainedHistoricalReceipts: RETAINED_HISTORICAL_PATHS.length,
      successorCompatibilityPaths: SUCCESSOR_COMPATIBILITY_PATHS.length,
      currentPathReceipts: receipts(files),
      t11SuccessorReceipts: T11_SUCCESSOR_RECEIPT_PATHS.map((relativePath) => ({
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
    "Task: M09-T10",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "PF-025: OPEN",
    "PF-028: OPEN",
    "PF-083: OPEN",
    "P-09: PARTIAL",
    "M09-T11: NOT_PROVEN",
    "M09-T12: NOT_PROVEN",
    "M09-T13: NOT_PROVEN",
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
    adapter: receipts.adapter.tests,
    application: receipts.application.tests,
    focusedDesignRun: receipts.focusedDesignRun.tests,
    fullApp: receipts.fullApp.tests,
    rootProof: receipts.rootProof.tests,
  });
}

/** Verifies committed M09-T10 bytes and the visible report digest. */
export async function verifyDesenAppDesignRunModesEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppDesignRunModesEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_DESIGN_RUN_MODES_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T10 artifact bytes differ from fresh evidence.");
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

/** Atomically writes exact deterministic M09-T10 proof bytes. */
export async function writeDesenAppDesignRunModesEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_DESIGN_RUN_MODES_ARTIFACT_PATH,
  );
  const built = await buildDesenAppDesignRunModesEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T10 artifact write failed safely.", {
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
