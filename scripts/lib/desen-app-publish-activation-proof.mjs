import { Buffer } from "node:buffer";
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
  M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH,
  ...M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS,
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
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-PUBLISH-ACTIVATION.md";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const EDITOR_WEB_PACKAGE_PATH = "packages/editor-web/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const APPLICATION_COMPATIBILITY_TEST_PATH = "apps/desen-app/test/application.test.tsx";

const SOURCE_PATHS = Object.freeze({
  authoringPreview: "apps/desen-app/src/authoring-preview.ts",
  authoringPublication: "apps/desen-app/src/authoring-publication.ts",
  publicationControls: "apps/desen-app/src/publication-controls.tsx",
  application: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
  editorWebPublication: "packages/editor-web/src/local-bundle-channel-publication.ts",
  editorWebIndex: "packages/editor-web/src/index.ts",
  editorWebPublicPackageTypes: "packages/editor-web/test/public-package.types.mts",
});

const TEST_PATHS = Object.freeze({
  authoringPublication: "apps/desen-app/test/authoring-publication.test.ts",
  publicationControls: "apps/desen-app/test/publication-controls.test.tsx",
  publicationApplication: "apps/desen-app/test/publication-application.test.tsx",
  publicationActivationIntegration:
    "apps/desen-app/test/publication-activation-integration.test.ts",
  editorWebPublication: "packages/editor-web/test/local-bundle-channel-publication.test.ts",
  editorWebPublicPackage: "packages/editor-web/test/public-package.mjs",
});

const PARENT_PATHS = Object.freeze({
  modes: "docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json",
  fixtures: "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json",
  persistence: "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json",
  diagnostics: "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json",
  publisherGolden: "docs/proof/artifacts/publisher-0.1.0-official-golden.json",
  publisherBundle: "docs/proof/artifacts/publisher-0.1.0-bundle-publication.json",
  controlPlane: "docs/proof/artifacts/control-plane-api-0.1.0-local-api.json",
  referenceHost: "docs/proof/artifacts/reference-host-web-0.1.0-channel-consumption.json",
  g07: "docs/proof/baselines/i07-04-affected-selector-promotion.json",
});

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-publish-activation-proof.mjs",
  "scripts/generate-desen-app-publish-activation-proof.mjs",
  "scripts/verify-desen-app-publish-activation.mjs",
  "tests/desen-app-publish-activation.test.mjs",
]);

const TRACKED_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  EDITOR_WEB_PACKAGE_PATH,
  LOCKFILE_PATH,
  ...Object.values(SOURCE_PATHS),
  ...Object.values(TEST_PATHS),
  APPLICATION_COMPATIBILITY_TEST_PATH,
  ...Object.values(PARENT_PATHS),
  ...PROOF_READER_PATHS,
]);

const SELF_RESEALED_PATHS = Object.freeze([
  "scripts/lib/desen-app-publish-activation-proof.mjs",
  "tests/desen-app-publish-activation.test.mjs",
]);
const PUBLICATION_APPLICATION_TIMEOUT_SUCCESSOR = Object.freeze({
  relationship: "EXACT_TEST_TIMEOUT_HARDENING_SUCCESSOR",
  path: TEST_PATHS.publicationApplication,
  timeoutMilliseconds: 10_000,
  frozen: Object.freeze({
    bytes: 24_485,
    sha256: "52e29b84745ff331556529612015b95b581bf3007118352ebad796ca9541e0e3",
  }),
  current: Object.freeze({
    bytes: 24_539,
    sha256: "ef32ec4c16c5f2a6288e284d511a90d024100ee6f1438adc7e207deb94e5ea8f",
  }),
});
const SUCCESSOR_COMPATIBILITY_PATHS = Object.freeze([
  PUBLICATION_APPLICATION_TIMEOUT_SUCCESSOR.path,
  ...Object.keys(M10_EMPTY_PROJECT_SUCCESSOR_RECEIPTS),
  ...SELF_RESEALED_PATHS,
]);
const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  ...new Set([
    ...TRACKED_PATHS,
    M10_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH,
    M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH,
    M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
    ...M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS,
    "dependency-cruiser.config.cjs",
  ]),
]);
const RETAINED_HISTORICAL_PATHS = Object.freeze(
  TRACKED_PATHS.filter(
    (relativePath) =>
      !SUCCESSOR_COMPATIBILITY_PATHS.includes(relativePath) &&
      !M10_USER_CREATED_BLANK_PROJECT_CURRENT_PATHS.includes(relativePath),
  ),
);
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 24_763,
  sha256: "6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b",
});

const REQUIRED_TEST_NAMES = Object.freeze({
  [TEST_PATHS.authoringPublication]: Object.freeze([
    "captures only the exact route, snapshot, and two-method trusted-host port",
    "blocks every unsaved, unauthorized, dirty, or stale-preview state before host I/O",
    "reruns the public Publisher and emits no bytes when semantic publication rejects",
    "passes exact canonical fresh Bundle bytes, then activates only the fixed preview receipt",
    "retains every exact durable activation relationship, including identical preservation",
    "preserves conflict generation and never activates after a definite channel rejection",
    "reports host LKG preservation with the already-published channel receipt",
    "contains thrown, explicit-indeterminate, and malformed host activation outcomes",
    "fences synchronous reentrant replacement before a channel callback can authorize activation",
    "fences late activation after replacement and after controller disposal",
  ]),
  [TEST_PATHS.publicationControls]: Object.freeze([
    "publishes only an admitted saved generation and explains transient-data isolation",
    "claims Active only with distinct Source, channel, and durable activation receipts",
    "reports channel conflict without presenting reference-host activation",
    "shows a separately preserved last-known-good revision after activation rejection",
    "blocks blind retry after an indeterminate publication result",
  ]),
  [TEST_PATHS.publicationApplication]: Object.freeze([
    "authors, runs, saves, publishes, and visibly activates one exact edited durable revision",
    "single-dispatches pending work and fences persistence, modes, navigation, and authoring mutation",
    "does not ask the reference host to activate a control-plane conflict",
    "shows a mismatched durable host revision only as last-known-good preservation",
    "does not surface late replaced-port or unmounted settlements as current success",
    "keeps persistence and publication independently unavailable without trusted public ports",
  ]),
  [TEST_PATHS.publicationActivationIntegration]: Object.freeze([
    "keeps exact saved Source, Publisher Bundle, fixed channel, and active revision equal",
    "keeps repeated publication unchanged and preserves the durable active revision",
  ]),
  [TEST_PATHS.editorWebPublication]: Object.freeze([
    "publishes to a missing fixed channel in the exact GET, Bundle PUT, channel CAS order",
    "updates and preserves existing channel generations with exact If-Match CAS",
    "returns the exact channel conflict without retrying or overwriting a concurrent winner",
    "distinguishes pre-mutation read failures from Bundle and channel commit ambiguity",
    "keeps malformed or mismatched post-PUT responses indeterminate",
    "rejects non-loopback, active, weak, dynamic-channel, and implicit-fetch configuration",
  ]),
  [TEST_PATHS.editorWebPublicPackage]: Object.freeze([
    "emitted editor-web root has the exact local adapter runtime surface",
    "emitted publication port keeps its channel fixed in trusted configuration",
  ]),
});

const EXPECTED_TEST_DECLARATION_COUNTS = Object.freeze({
  [TEST_PATHS.authoringPublication]: 15,
  [TEST_PATHS.publicationControls]: 8,
  [TEST_PATHS.publicationApplication]: 6,
  [TEST_PATHS.publicationActivationIntegration]: 2,
  [TEST_PATHS.editorWebPublication]: 10,
  [TEST_PATHS.editorWebPublicPackage]: 4,
});

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

function authenticateM10UserCreatedBlankProjectSuccessor(
  files,
  evergreenProductCompositionSuccessor,
) {
  void evergreenProductCompositionSuccessor;
  const artifactBytes = files.get(M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH);
  const pin = M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PIN;
  if (
    artifactBytes?.byteLength !== pin.bytes ||
    sha256(artifactBytes ?? Buffer.alloc(0)) !== pin.sha256
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact immutable M10-T01A artifact drifted.");
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
    parent?.path !== M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH ||
    parent?.bytes !== M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.bytes ||
    parent?.sha256 !== M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.sha256 ||
    parent?.profile !== "desen.app.browser-e2e-workspace-compatibility-proof.v1" ||
    parent?.result !== "PASS" ||
    parent?.immutable !== true ||
    artifact?.authority?.source?.normalProductEntry !== true ||
    artifact?.authority?.source?.productEntryInjectsDocument !== false ||
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
    artifact?.authority?.source?.nativeDragCalls !== 2 ||
    artifact?.authority?.source?.initialProjectCount !== 0 ||
    artifact?.authority?.source?.creationGeneration !== 1 ||
    artifact?.authority?.source?.authoredGeneration !== 2 ||
    artifact?.authority?.source?.browserRuntimeErrorsAllowed !== 0 ||
    artifact?.authority?.source?.browserExecutionPerformedByReader !== false ||
    artifact?.authority?.package?.appPackageName !== "@desen/app-web" ||
    artifact?.authority?.package?.appDevCommand !== "node dev/local-dev.mjs" ||
    artifact?.authority?.package?.appLocalRuntimeTestCommand !==
      "vitest run test/local-runtime-persistence.test.ts dev/local-dev-host.test.mjs" ||
    artifact?.authority?.package?.appProductBootstrapTestCommand !==
      "vitest run test/product-bootstrap.test.tsx test/main-lifecycle.test.tsx" ||
    artifact?.tests?.browserTestDeclarations !== 1 ||
    artifact?.tests?.browserExecutedByVerifier !== false ||
    artifact?.boundary?.trackedFiles !== M10_USER_CREATED_BLANK_PROJECT_TRACKED_PATHS.length ||
    artifact?.boundary?.trackedReceipts?.length !==
      M10_USER_CREATED_BLANK_PROJECT_TRACKED_PATHS.length ||
    artifact?.boundary?.immutableInputs !== true ||
    artifact?.boundary?.sourceSymlinksRejected !== true
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact M10-T01A identity, claims, or authority drifted.",
    );
  }
  const trackedReceipts = artifact.boundary.trackedReceipts;
  const receiptPaths = trackedReceipts.map((receipt) => receipt?.path);
  if (
    !isDeepStrictEqual(receiptPaths, M10_USER_CREATED_BLANK_PROJECT_TRACKED_PATHS) ||
    new Set(receiptPaths).size !== M10_USER_CREATED_BLANK_PROJECT_TRACKED_PATHS.length
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The M10-T01A receipt closure drifted.");
  }
  for (const receipt of trackedReceipts) {
    if (M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.includes(receipt.path)) continue;
    const bytes = files.get(receipt.path);
    const historicalReceiptIsOverridden =
      M10_USER_CREATED_BLANK_PROJECT_OVERRIDDEN_HISTORICAL_PATHS.includes(receipt.path);
    const historicalReceiptIsCheckpointResealed =
      M10_USER_CREATED_BLANK_PROJECT_CHECKPOINT_RESEALED_PATHS.includes(receipt.path);
    if (
      !Number.isSafeInteger(receipt.bytes) ||
      receipt.bytes < 0 ||
      !/^[0-9a-f]{64}$/u.test(receipt.sha256) ||
      (!historicalReceiptIsOverridden &&
        !historicalReceiptIsCheckpointResealed &&
        (bytes?.byteLength !== receipt.bytes ||
          sha256(bytes ?? Buffer.alloc(0)) !== receipt.sha256))
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", `The current M10-T01A receipt drifted: ${receipt.path}.`);
    }
  }
  for (const receipt of M10_USER_CREATED_BLANK_PROJECT_SECURE_SCROLL_RECEIPTS) {
    if (
      M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.includes(receipt.path) ||
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
    artifact: { path: M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH, ...pin, immutable: true },
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
  const artifact = parseJson(artifactBytes, M10_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH);
  const predecessor = artifact?.prerequisites?.[0];
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-visual-behavior-authoring" ||
    artifact?.profile !== "desen.app.visual-behavior-authoring-proof.v1" ||
    artifact?.task !== "M10-T01B" ||
    artifact?.gate !== null ||
    artifact?.result !== "PASS" ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.p08Status !== "PROVEN" ||
    artifact?.claim?.p09Status !== "PARTIAL" ||
    artifact?.claim?.visualInputConnectionCovered !== true ||
    artifact?.claim?.visualOperationActionCovered !== true ||
    artifact?.claim?.visualConditionalPresenceCovered !== true ||
    artifact?.claim?.catalogDerivedRunControlsCovered !== true ||
    artifact?.claim?.advancedJsonRetained !== true ||
    artifact?.claim?.authoredBrowserSmokeCovered !== true ||
    artifact?.claim?.m10T02Closed !== false ||
    artifact?.claim?.g10Closed !== false ||
    predecessor?.task !== "M10-T01A" ||
    predecessor?.proofId !== "desen-app-user-created-blank-project" ||
    predecessor?.path !== M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH ||
    predecessor?.bytes !== M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PIN.bytes ||
    predecessor?.sha256 !== M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PIN.sha256 ||
    predecessor?.immutable !== true ||
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
      "The immutable M10-T01B identity, claims, or receipt manifest drifted.",
    );
  }
  for (const receipt of trackedReceipts) {
    const live = files.get(receipt.path);
    if (
      !Number.isSafeInteger(receipt?.bytes) ||
      receipt.bytes < 0 ||
      typeof receipt.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(receipt.sha256) ||
      (evergreenProductCompositionSuccessor === null &&
        (live?.byteLength !== receipt.bytes || sha256(live ?? Buffer.alloc(0)) !== receipt.sha256))
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
      `The exact M10-T01B hosted-browser compatibility receipt drifted: ${hostedBrowserReceipt.path}.`,
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

/** Exact immutable authorities directly required by M09-T14/G09. */
export const DESEN_APP_PUBLISH_ACTIVATION_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M09-T10",
    proofId: "desen-app-design-run-modes",
    path: PARENT_PATHS.modes,
    bytes: 17_900,
    sha256: "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334",
    profile: "desen.app.design-run-modes-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T11",
    proofId: "desen-app-fixtures-scenarios-fidelity",
    path: PARENT_PATHS.fixtures,
    bytes: 29_407,
    sha256: "3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d",
    profile: "desen.app.fixtures-scenarios-fidelity-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T12",
    proofId: "desen-app-source-persistence",
    path: PARENT_PATHS.persistence,
    bytes: 27_053,
    sha256: "717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734",
    profile: "desen.app.source-persistence-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T13",
    proofId: "desen-app-node-linked-diagnostics",
    path: PARENT_PATHS.diagnostics,
    bytes: 29_208,
    sha256: "8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972",
    profile: "desen.app.node-linked-diagnostics-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M06-T10",
    proofId: null,
    path: PARENT_PATHS.publisherGolden,
    bytes: 13_179,
    sha256: "a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2",
    profile: "desen.publisher.official-golden-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M06-T09",
    proofId: null,
    path: PARENT_PATHS.publisherBundle,
    bytes: 17_320,
    sha256: "2942aa84066354ee7c27557263a900eb8fd3a149d085ab55c7f880dcfca998df",
    profile: "desen.publisher.bundle-publication-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M07-T05",
    proofId: "control-plane-local-api",
    path: PARENT_PATHS.controlPlane,
    bytes: 41_945,
    sha256: "144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9",
    profile: "desen.control-plane.local-api-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M07-T11",
    proofId: "reference-host-web-channel-consumption",
    path: PARENT_PATHS.referenceHost,
    bytes: 39_307,
    sha256: "48bd9f85bd2da413fc72c1973a33732cc091796f9afc2863ec1eec15054314e0",
    profile: "desen.reference-host-web.channel-consumption-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "I07-04",
    proofId: null,
    path: PARENT_PATHS.g07,
    bytes: 88_341,
    sha256: "76a29908843c0bb9a4ca5ad74b5bc94383c3fa21463ce81e98bf53e8f01d7549",
    profile: "desen.ci.affected-selector-promotion-evidence.v1",
    result: "HOSTED_CUTOVER_VERIFIED",
    immutable: true,
  }),
]);

/** Exact reviewed declarations across the six focused M09-T14 test files. */
export const DESEN_APP_PUBLISH_ACTIVATION_FOCUSED_TEST_DECLARATIONS = 45;

/** Independent root-test names retained in the M09-T14 artifact. */
export const DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates exact App, Publisher, control-plane, reference-host, and G07 parents",
  "[source] reruns the public Publisher from the exact saved authored Source only",
  "[transients] excludes scenarios, fixtures, operation inputs, and rejected diagnostics",
  "[publication] sends exact Bundle bytes before fixed-channel compare-and-set",
  "[activation] distinguishes Source, channel, and durable activation generations",
  "[containment] preserves last-known-good activation and fences stale or uncertain work",
  "[boundary] keeps Node control-plane and reference-host packages outside browser App imports",
  "[integration] exercises real public control-plane and reference-host channel consumption",
  "[tests] retains exact focused source-level semantic evidence",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects source, test, package, and linked-path weakening",
  "[verification] rejects parent, artifact, report, destination, and option drift",
]);

/** Default destination for deterministic M09-T14/G09 evidence. */
export const DEFAULT_DESEN_APP_PUBLISH_ACTIVATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T14 evidence reader. */
export class DesenAppPublishActivationProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppPublishActivationProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppPublishActivationProofError(code, message, details);
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

function canonicalArtifactBytes(artifact) {
  let text = JSON.stringify(artifact, null, 2);
  const compactArrays = Object.freeze([
    Object.freeze({
      expanded: `        "publicationControls": [
          "react",
          "./application.module.css"
        ],`,
      compact: '        "publicationControls": ["react", "./application.module.css"],',
    }),
    Object.freeze({
      expanded: `        "editorWebPublication": [
          "./local-source-json.js"
        ],`,
      compact: '        "editorWebPublication": ["./local-source-json.js"],',
    }),
    Object.freeze({
      expanded: `        "editorWebPublicPackageTypes": [
          "@desen/editor-web",
          "@desen/editor-web"
        ]`,
      compact: '        "editorWebPublicPackageTypes": ["@desen/editor-web", "@desen/editor-web"]',
    }),
  ]);
  for (const { expanded, compact } of compactArrays) {
    if (text.split(expanded).length !== 2) {
      fail("ARTIFACT_FORMAT_DRIFT", "Expected one reviewed Prettier JSON compaction target.");
    }
    text = text.replace(expanded, compact);
  }
  return Buffer.from(`${text}\n`);
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
    if (error instanceof DesenAppPublishActivationProofError) throw error;
    fail("AUTHORITY_UNREADABLE", `${label} could not be read safely.`, { cause: String(error) });
  } finally {
    await handle?.close();
  }
}

async function readTrackedFiles(workspaceRoot, overrides) {
  const files = new Map();
  for (const relativePath of CURRENT_COMPATIBILITY_PATHS) {
    files.set(
      relativePath,
      overrides.get(relativePath) ??
        (await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath)),
    );
  }
  return files;
}

function decodeUtf8(bytes, label) {
  const value = Buffer.from(bytes).toString("utf8");
  if (value.includes("\0") || !Buffer.from(value, "utf8").equals(Buffer.from(bytes))) {
    fail("SOURCE_POLICY_VIOLATION", `${label} must be exact UTF-8 text.`);
  }
  return value;
}

function parseJson(bytes, label, code = "SOURCE_POLICY_VIOLATION") {
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  } catch (error) {
    fail(code, `${label} must be exact JSON.`, { cause: String(error) });
  }
}

function assertIncludes(source, markers, label, code = "SOURCE_POLICY_VIOLATION") {
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length !== 0) {
    fail(code, `${label} lost required M09-T14 policy.`, { missing });
  }
}

function assertExcludes(source, markers, label, code = "SOURCE_POLICY_VIOLATION") {
  const present = markers.filter((marker) => source.includes(marker));
  if (present.length !== 0) {
    fail(code, `${label} acquired forbidden M09-T14 authority.`, { present });
  }
}

function parseTypeScript(source, relativePath, code = "SOURCE_POLICY_VIOLATION") {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail(code, `${relativePath} must parse as TypeScript.`);
  }
  return sourceFile;
}

function inspectImports(source, relativePath) {
  const sourceFile = parseTypeScript(source, relativePath);
  const imports = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      fail("SOURCE_POLICY_VIOLATION", `${relativePath} acquired dynamic import authority.`);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return Object.freeze(imports);
}

function interfaceProperties(source, relativePath, interfaceName) {
  const sourceFile = parseTypeScript(source, relativePath);
  let properties;
  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      if (properties !== undefined) {
        fail("SOURCE_POLICY_VIOLATION", `${relativePath} duplicated ${interfaceName}.`);
      }
      properties = node.members.map((member) =>
        member.name !== undefined && ts.isIdentifier(member.name) ? member.name.text : null,
      );
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (properties === undefined || properties.includes(null)) {
    fail("SOURCE_POLICY_VIOLATION", `${relativePath} lost exact ${interfaceName} fields.`);
  }
  return Object.freeze([...properties].sort());
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

/** Verifies the complete saved-Source-to-active-reference-host M09-T14 boundary. */
export function verifyDesenAppPublishActivationSourcePolicy(rawInput) {
  const input = captureSourcePolicyInput(rawInput);
  const imports = Object.fromEntries(
    Object.entries(SOURCE_PATHS)
      .filter(
        ([, relativePath]) =>
          relativePath.endsWith(".ts") ||
          relativePath.endsWith(".tsx") ||
          relativePath.endsWith(".mts"),
      )
      .map(([key, relativePath]) => [key, inspectImports(input[key], relativePath)]),
  );

  for (const key of [
    "authoringPreview",
    "authoringPublication",
    "publicationControls",
    "application",
  ]) {
    const forbidden = imports[key].filter(
      (specifier) =>
        specifier.startsWith("node:") ||
        specifier === "@desen/control-plane-api" ||
        specifier === "@desen/reference-host-web-server" ||
        specifier === "@desen/reference-host-web" ||
        (specifier.startsWith("@desen/") && specifier.includes("/src/")),
    );
    if (forbidden.length !== 0) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        `${SOURCE_PATHS[key]} crossed the browser/Node composition boundary.`,
        { forbidden },
      );
    }
  }

  assertIncludes(
    input.authoringPreview,
    [
      'import { publishDesenSource } from "@desen/publisher"',
      "createDesenEditorDocument(document)",
      "JSON.stringify(admitted.document)",
      "publishDesenSource(rawSource, REFERENCE_CATALOG_PACKAGES)",
      "bundle: published.bundle",
      "revision: published.bundle.revision",
    ],
    SOURCE_PATHS.authoringPreview,
  );
  assertExcludes(
    input.authoringPreview,
    ["scenarioDocument", "effectiveDocument", "operationInput", "password:"],
    SOURCE_PATHS.authoringPreview,
  );

  assertIncludes(
    input.authoringPublication,
    [
      'export const AUTHORING_PUBLICATION_CHANNEL = "preview" as const',
      'const PORT_KEYS = Object.freeze(["activateReferenceHost", "publishBundleToChannel"])',
      '"savedDocument"',
      '"sourceGeneration"',
      "capturedSnapshot.canonicalDocument !== capturedSnapshot.canonicalSavedDocument",
      "prepareAuthoringPreviewBundle(capturedSnapshot.snapshot.document)",
      "freshPreview.revision !== capturedSnapshot.snapshot.previewRevision",
      "bundleBytes = canonicalizeJsonBytes(freshPreview.bundle)",
      "channelName: AUTHORING_PUBLICATION_CHANNEL",
      "publishBundleToChannel(",
      "activateReferenceHost(",
      "channelGeneration",
      "activationGeneration",
      "operationIsCurrent(token, version)",
      'publicationIndeterminate("control-plane"',
      '"reference-host",',
      '"reference-host-failed",',
      '"reference-host-unavailable",',
      "lastKnownGoodPreserved",
      '"stale-operation"',
    ],
    SOURCE_PATHS.authoringPublication,
  );
  assertExcludes(
    input.authoringPublication,
    ["globalThis.fetch", "window.fetch", "scenarioDocument", "fixtureDocument", "operationInput:"],
    SOURCE_PATHS.authoringPublication,
  );
  const snapshotProperties = interfaceProperties(
    input.authoringPublication,
    SOURCE_PATHS.authoringPublication,
    "AuthoringPublicationSnapshot",
  );
  if (
    !isDeepStrictEqual(snapshotProperties, [
      "document",
      "persistenceAuthority",
      "previewRevision",
      "savedDocument",
      "sourceGeneration",
    ])
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Publication snapshot widened beyond authored Source state.", {
      snapshotProperties,
    });
  }
  const requestProperties = interfaceProperties(
    input.authoringPublication,
    SOURCE_PATHS.authoringPublication,
    "AuthoringControlPlanePublicationRequest",
  );
  if (!isDeepStrictEqual(requestProperties, ["bundleBytes", "revision"])) {
    fail("SOURCE_POLICY_VIOLATION", "Control-plane publication request widened.", {
      requestProperties,
    });
  }

  assertIncludes(
    input.publicationControls,
    [
      'readonly channelName: "preview"',
      'aria-label="Publish saved Source"',
      'aria-label="Publication stages"',
      "Only the exact saved Source is published. Preview scenarios and fixture data stay local.",
      'status.state === "indeterminate"',
      "status.sourceGeneration",
      "status.channelGeneration",
      "status.activationGeneration",
      "preserved",
      "last known good",
    ],
    SOURCE_PATHS.publicationControls,
  );

  assertIncludes(
    input.editorWebPublication,
    [
      "createLocalDesenBundleChannelPublicationPort",
      "readonly channelName: string",
      "readonly bundleBytes: Readonly<Uint8Array>",
      'readonly status: "indeterminate"',
      'phase: "bundle-write"',
      'phase: "channel-write"',
      '"if-none-match": "*"',
      '`"g:${String(expectedGeneration)}"`',
      "`${options.origin}/v1/channels/${options.channelName}`",
      "`${options.origin}/v1/bundles/${revision}`",
      "body: new Uint8Array(request.bundleBytes)",
      "captured.fetch(",
      'status: "conflict"',
    ],
    SOURCE_PATHS.editorWebPublication,
  );
  assertExcludes(
    input.editorWebPublication,
    ["globalThis.fetch", "window.fetch", "fetch.bind", "request.channelName"],
    SOURCE_PATHS.editorWebPublication,
  );
  const adapterRequestProperties = interfaceProperties(
    input.editorWebPublication,
    SOURCE_PATHS.editorWebPublication,
    "LocalDesenBundleChannelPublicationRequest",
  );
  if (!isDeepStrictEqual(adapterRequestProperties, ["bundleBytes", "revision"])) {
    fail("SOURCE_POLICY_VIOLATION", "Editor Web request acquired channel-selection authority.", {
      adapterRequestProperties,
    });
  }

  assertIncludes(
    input.editorWebIndex,
    [
      "createLocalDesenBundleChannelPublicationPort",
      "LocalDesenBundleChannelPublicationPort",
      'from "./local-bundle-channel-publication.js"',
    ],
    SOURCE_PATHS.editorWebIndex,
  );
  assertExcludes(
    input.editorWebIndex,
    ["control-plane-api", "reference-host-web-server"],
    SOURCE_PATHS.editorWebIndex,
  );
  assertIncludes(
    input.editorWebPublicPackageTypes,
    [
      'from "@desen/editor-web"',
      "createLocalDesenBundleChannelPublicationPort",
      "LocalDesenBundleChannelPublicationOptions",
      "LocalDesenBundleChannelPublicationResult",
      "publishBundleToChannel",
      "@ts-expect-error",
    ],
    SOURCE_PATHS.editorWebPublicPackageTypes,
  );

  assertIncludes(
    input.application,
    [
      'import { createAuthoringPublicationController } from "./authoring-publication.js"',
      'import { PublicationControls } from "./publication-controls.js"',
      "readonly publicationPort?: AuthoringPublicationPort | null",
      "publicationPort === null",
      "createAuthoringPublicationController({",
      "publicationController?.subscribe ?? subscribeUnavailablePublication",
      "publicationController?.read ?? readUnavailablePublication",
      "publicationController.replaceSnapshot(readCurrentPublicationSnapshot())",
      "void publicationController.publish()",
      "savedDocument: livePersistence?.savedDocument ?? null",
      "sourceGeneration: livePersistence?.generation ?? null",
      "previewRevision: preview.ok ? preview.revision : UNAVAILABLE_PREVIEW_REVISION",
      'channelName: "preview"',
      'state: "indeterminate"',
      'state: "preserved"',
      'state: "stale"',
      "publicationPending",
      "<PublicationControls",
      "onPublish={publishSavedSource}",
      "publicationPort={publicationPort}",
    ],
    SOURCE_PATHS.application,
  );
  assertIncludes(
    input.applicationCss,
    [
      ".publicationControls",
      ".publicationHeading",
      ".publicationStages",
      ".publicationStatus",
      ".publicationAdmission",
      ".publicationReceipt",
    ],
    SOURCE_PATHS.applicationCss,
  );

  return deepFreeze({
    imports,
    publicPublisherRootOnly: true,
    savedAuthoredSourceOnly: true,
    transientScenarioFixtureOperationAndDiagnosticsExcluded: true,
    publisherRerunBeforePublication: true,
    exactBundleBytesForwarded: true,
    fixedPreviewChannel: true,
    channelCompareAndSet: true,
    sourceChannelAndActivationGenerationsDistinct: true,
    staleOperationFenced: true,
    indeterminateOutcomeBlocksBlindAuthority: true,
    lastKnownGoodActivationPreserved: true,
    browserAppImportsNodeCompositionPackages: false,
    editorWebUsesInjectedFetchOnly: true,
  });
}

function staticTestName(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function inspectTestFile(source, relativePath) {
  const sourceFile = parseTypeScript(source, relativePath, "TEST_POLICY_VIOLATION");
  const names = [];
  const imports = [];
  let declarations = 0;
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["it", "test"].includes(node.expression.text)
    ) {
      declarations += 1;
      const name = node.arguments[0] === undefined ? undefined : staticTestName(node.arguments[0]);
      if (name !== undefined) names.push(name);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return Object.freeze({
    declarations,
    names: Object.freeze(names),
    imports: Object.freeze(imports),
  });
}

function inspectTests(files) {
  const inventories = Object.fromEntries(
    Object.values(TEST_PATHS).map((relativePath) => [
      relativePath,
      inspectTestFile(decodeUtf8(files.get(relativePath), relativePath), relativePath),
    ]),
  );
  for (const [relativePath, requiredNames] of Object.entries(REQUIRED_TEST_NAMES)) {
    const inventory = inventories[relativePath];
    if (inventory.declarations !== EXPECTED_TEST_DECLARATION_COUNTS[relativePath]) {
      fail("TEST_POLICY_VIOLATION", `${relativePath} exact test inventory drifted.`, {
        expected: EXPECTED_TEST_DECLARATION_COUNTS[relativePath],
        actual: inventory.declarations,
      });
    }
    const missing = requiredNames.filter((name) => !inventory.names.includes(name));
    if (missing.length !== 0) {
      fail("TEST_POLICY_VIOLATION", `${relativePath} lost required semantic tests.`, { missing });
    }
  }
  const integration = inventories[TEST_PATHS.publicationActivationIntegration];
  const integrationImports = integration.imports;
  for (const authority of [
    "@desen/control-plane-api",
    "@desen/editor-web",
    "@desen/reference-host-web-server",
  ]) {
    if (!integrationImports.includes(authority)) {
      fail("TEST_POLICY_VIOLATION", "Real integration lost a public package authority.", {
        authority,
      });
    }
  }
  if (
    integrationImports.some(
      (specifier) => specifier.startsWith("@desen/") && specifier.includes("/src/"),
    )
  ) {
    fail("TEST_POLICY_VIOLATION", "Real integration crossed a private package seam.");
  }
  const integrationSource = decodeUtf8(
    files.get(TEST_PATHS.publicationActivationIntegration),
    TEST_PATHS.publicationActivationIntegration,
  );
  assertIncludes(
    integrationSource,
    [
      "openLocalControlPlane",
      "createLocalDesenBundleChannelPublicationPort",
      "openReferenceHostChannelActivationController",
      "AUTHORING_PUBLICATION_CHANNEL",
      "channelGeneration",
      "activationGeneration",
      "activeRevision",
    ],
    TEST_PATHS.publicationActivationIntegration,
    "TEST_POLICY_VIOLATION",
  );
  const declarationCounts = Object.fromEntries(
    Object.entries(inventories).map(([relativePath, inventory]) => [
      relativePath,
      inventory.declarations,
    ]),
  );
  const focusedTestDeclarations = Object.values(declarationCounts).reduce(
    (total, count) => total + count,
    0,
  );
  if (focusedTestDeclarations !== DESEN_APP_PUBLISH_ACTIVATION_FOCUSED_TEST_DECLARATIONS) {
    fail("TEST_POLICY_VIOLATION", "The exact focused M09-T14 declaration count drifted.");
  }
  return deepFreeze({
    command:
      "pnpm --filter @desen/editor-web test:publication && pnpm --filter @desen/editor-web test:public-package && pnpm --filter @desen/app-web test:publication && node --test tests/desen-app-publish-activation.test.mjs",
    focusedFiles: Object.values(TEST_PATHS),
    testDeclarationCounts: declarationCounts,
    focusedTestDeclarations,
    requiredTestNames: REQUIRED_TEST_NAMES,
    rootTestNames: DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES,
    realPublicIntegration: true,
  });
}

function inspectPackages(files) {
  const root = parseJson(
    files.get(ROOT_PACKAGE_PATH),
    ROOT_PACKAGE_PATH,
    "PACKAGE_POLICY_VIOLATION",
  );
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH, "PACKAGE_POLICY_VIOLATION");
  const editorWeb = parseJson(
    files.get(EDITOR_WEB_PACKAGE_PATH),
    EDITOR_WEB_PACKAGE_PATH,
    "PACKAGE_POLICY_VIOLATION",
  );
  if (app.name !== "@desen/app-web" || editorWeb.name !== "@desen/editor-web") {
    fail("PACKAGE_POLICY_VIOLATION", "The App or Editor Web package identity drifted.");
  }
  if (
    editorWeb.scripts?.["test:publication"] !==
    "vitest run test/local-bundle-channel-publication.test.ts"
  ) {
    fail("PACKAGE_POLICY_VIOLATION", "Editor Web lost its exact publication test command.");
  }
  const appCommand = app.scripts?.["test:publication"];
  if (
    typeof appCommand !== "string" ||
    !Object.values(TEST_PATHS)
      .filter((relativePath) => relativePath.startsWith("apps/desen-app/test/"))
      .every((relativePath) => appCommand.includes(path.basename(relativePath)))
  ) {
    fail("PACKAGE_POLICY_VIOLATION", "Desen App lost the complete publication test command.");
  }
  if (app.dependencies?.["@desen/publisher"] !== "workspace:*") {
    fail("PACKAGE_POLICY_VIOLATION", "Desen App lost public Publisher authority.");
  }
  const rootCommands = Object.freeze({
    generate: root.scripts?.["generate:desen-app-publish-activation"],
    verify: root.scripts?.["verify:desen-app-publish-activation"],
    test: root.scripts?.["test:desen-app-publish-activation"],
  });
  const requiredSuffixes = Object.freeze({
    generate: "node scripts/generate-desen-app-publish-activation-proof.mjs",
    verify: "node scripts/verify-desen-app-publish-activation.mjs",
    test: "node --test tests/desen-app-publish-activation.test.mjs",
  });
  for (const [kind, suffix] of Object.entries(requiredSuffixes)) {
    if (typeof rootCommands[kind] !== "string" || !rootCommands[kind].endsWith(suffix)) {
      fail("PACKAGE_POLICY_VIOLATION", `Root ${kind} publication command drifted.`);
    }
  }
  return deepFreeze({
    appName: app.name,
    appTestCommand: appCommand,
    editorWebName: editorWeb.name,
    editorWebTestCommand: editorWeb.scripts["test:publication"],
    publisherDependency: "workspace:*",
    rootPackageName: root.name,
    rootCommands,
  });
}

function authenticateParent(bytes, pin) {
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", `The exact frozen ${pin.task} parent authority changed.`);
  }
  const artifact = parseJson(bytes, `frozen ${pin.task} parent`, "PARENT_DRIFT");
  if (
    artifact.task !== pin.task ||
    (artifact.proofId ?? null) !== pin.proofId ||
    artifact.profile !== pin.profile
  ) {
    fail("PARENT_DRIFT", `The frozen ${pin.task} identity drifted.`);
  }
  if (pin.task === "I07-04") {
    if (
      artifact.cutover?.status !== pin.result ||
      artifact.cutover?.cleanup?.status !== "PASS" ||
      artifact.cutover?.main?.status !== "PASS" ||
      artifact.cutover?.affectedCanary?.status !== "PASS" ||
      artifact.cutover?.proofReaderCheckpoint?.liveVerification !== "PASS" ||
      artifact.cutover?.infrastructureDebt?.status !== "CLOSED"
    ) {
      fail("PARENT_DRIFT", "The frozen I07-04/G07 hosted promotion authority drifted.");
    }
    return pin;
  }
  if (artifact.result !== pin.result) {
    fail("PARENT_DRIFT", `The frozen ${pin.task} result drifted.`);
  }
  if (
    pin.task.startsWith("M09-") &&
    (artifact.claim?.taskStatus !== "DONE" || artifact.claim?.publicationClaimed !== false)
  ) {
    fail("PARENT_DRIFT", `The frozen ${pin.task} App predecessor boundary drifted.`);
  }
  if (
    pin.task === "M09-T11" &&
    (artifact.claim?.authoredSourceAndPublishablePreviewUnchanged !== true ||
      artifact.claim?.operationInputOrPasswordRetained !== false)
  ) {
    fail("PARENT_DRIFT", "The frozen fixture/scenario transient boundary drifted.");
  }
  if (
    pin.task === "M09-T12" &&
    (artifact.claim?.authoredSourceOnly !== true ||
      artifact.claim?.completeAuthoredSourceCanonicalDirtyComparison !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen saved authored Source authority drifted.");
  }
  if (
    pin.task === "M09-T13" &&
    (artifact.claim?.rejectedDiagnosticsPersisted !== false ||
      artifact.claim?.lastKnownGoodPreviewPreserved !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen diagnostics containment boundary drifted.");
  }
  if (
    pin.task === "M06-T10" &&
    (artifact.claims?.publicDoublePublication?.comparisons?.firstEqualsOfficialCanonicalBytes !==
      true ||
      artifact.claims?.publicDoublePublication?.privatePublisherSeamsAbsent !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen official Publisher golden authority drifted.");
  }
  if (
    pin.task === "M06-T09" &&
    (artifact.claims?.publicApi?.sourceExports?.[0] !== "publishDesenSource" ||
      artifact.claims?.singleOfficialInputPublicRuntimeProbe?.revisionClosed !== true ||
      artifact.claims?.singleOfficialInputPublicRuntimeProbe?.publicationAbsent !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen public Bundle publication authority drifted.");
  }
  if (
    pin.task === "M07-T05" &&
    (artifact.claims?.publicFactory?.export !== "openLocalControlPlane" ||
      artifact.claims?.immutableBundles?.exactM07T01FirstWriterSemanticsRetained !== true ||
      artifact.claims?.mutableChannel?.activationFieldsAbsent !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen control-plane local API authority drifted.");
  }
  if (
    pin.task === "M07-T11" &&
    (artifact.claims?.compositionBoundary?.serverImportsOnlyPublicControlPlaneRoot !== true ||
      artifact.claims?.compositionBoundary?.browserImportsNoControlPlaneOrSecretAuthority !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen reference-host channel-consumption authority drifted.");
  }
  return pin;
}

function receipts(files) {
  return [...files.entries()]
    .filter(([relativePath]) => TRACKED_PATHS.includes(relativePath))
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([relativePath, bytes]) =>
      Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) }),
    );
}

async function authenticateFrozenArtifact(workspaceRoot) {
  const artifactBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_PATH),
    "frozen M09-T14/G09 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail(
      "ARTIFACT_DRIFT",
      "The frozen M09-T14/G09 artifact bytes differ from their exact receipt.",
    );
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T14/G09 proof artifact", "ARTIFACT_DRIFT");
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  const receiptPaths = Array.isArray(trackedReceipts)
    ? trackedReceipts.map((candidate) => candidate?.path)
    : [];
  if (
    artifact.schemaVersion !== 1 ||
    artifact.proofId !== "desen-app-publish-activation" ||
    artifact.profile !== "desen.app.publish-activation-proof.v1" ||
    artifact.task !== "M09-T14" ||
    artifact.gate !== "G09" ||
    artifact.result !== "PASS" ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.gateStatus !== "DONE" ||
    artifact.claim?.savedAuthoredSourceOnly !== true ||
    artifact.claim?.publisherRerunFromSavedSource !== true ||
    artifact.claim?.exactCanonicalBundleBytesStored !== true ||
    artifact.claim?.fixedPreviewChannelCompareAndSet !== true ||
    artifact.claim?.activeRevisionRequiresReferenceHostReceipt !== true ||
    artifact.claim?.staleCompletionCanBecomeActive !== false ||
    artifact.claim?.blindRetryAfterIndeterminate !== false ||
    artifact.claim?.conflictActivatesCandidate !== false ||
    artifact.claim?.lastKnownGoodActivationPreserved !== true ||
    artifact.tests?.focusedTestDeclarations !==
      DESEN_APP_PUBLISH_ACTIVATION_FOCUSED_TEST_DECLARATIONS ||
    artifact.tests?.rootTestNames?.length !== DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES.length ||
    artifact.boundary?.trackedFiles !== TRACKED_PATHS.length ||
    artifact.boundary?.parentArtifacts !== DESEN_APP_PUBLISH_ACTIVATION_PARENT_PINS.length ||
    trackedReceipts?.length !== TRACKED_PATHS.length ||
    !isDeepStrictEqual(
      receiptPaths,
      [...receiptPaths].sort((left, right) => left.localeCompare(right, "en-US")),
    ) ||
    !isDeepStrictEqual(artifact.prerequisites, DESEN_APP_PUBLISH_ACTIVATION_PARENT_PINS) ||
    !isDeepStrictEqual(artifact.tests?.rootTestNames, DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES)
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T14/G09 identity or retained claims drifted.");
  }
  return deepFreeze({
    artifact,
    artifactBytes: Buffer.from(artifactBytes),
    artifactSha256: FROZEN_ARTIFACT_PIN.sha256,
  });
}

function assertRetainedHistoricalReceipts(frozenArtifact, files) {
  const receiptMap = reviewedSuccessorReceiptMap(frozenArtifact.boundary.trackedReceipts);
  for (const relativePath of RETAINED_HISTORICAL_PATHS) {
    const receipt = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      receipt === undefined ||
      bytes === undefined ||
      receipt.bytes !== bytes.byteLength ||
      receipt.sha256 !== sha256(bytes)
    ) {
      fail("BOUNDARY_DRIFT", `A retained M09-T14 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

function authenticatePublicationApplicationTimeoutSuccessor(frozenArtifact, files) {
  const policy = PUBLICATION_APPLICATION_TIMEOUT_SUCCESSOR;
  const frozenReceipt = frozenArtifact.boundary.trackedReceipts.find(
    (candidate) => candidate.path === policy.path,
  );
  if (
    frozenReceipt?.bytes !== policy.frozen.bytes ||
    frozenReceipt?.sha256 !== policy.frozen.sha256
  ) {
    fail(
      "ARTIFACT_DRIFT",
      "The frozen publication-application test receipt differs from the reviewed predecessor.",
    );
  }
  const currentBytes = files.get(policy.path);
  if (
    currentBytes?.byteLength !== policy.current.bytes ||
    sha256(currentBytes ?? Buffer.alloc(0)) !== policy.current.sha256
  ) {
    fail(
      "TEST_TIMEOUT_SUCCESSOR_DRIFT",
      "The live publication-application timeout hardening differs from its exact successor receipt.",
    );
  }
  const currentSource = decodeUtf8(currentBytes, policy.path);
  const currentMarker = "  }, 10_000);\n";
  if (currentSource.split(currentMarker).length !== 2) {
    fail(
      "TEST_TIMEOUT_SUCCESSOR_DRIFT",
      "The live publication-application test must contain one exact reviewed timeout boundary.",
    );
  }
  const projectedFrozenBytes = Buffer.from(
    currentSource
      .replace('name: "Next outcome for signIn"', 'name: "Next sign-in outcome"')
      .replace('value: "error:invalidCredentials"', 'value: "invalidCredentials"')
      .replace('name: "Complete signIn fixture"', 'name: "Complete fixture"')
      .replace(
        'expect(within(runControls).getByRole("status").textContent).toContain(\n        "Synthetic public error completed",\n      );',
        'expect(within(runControls).getByRole("status").textContent).toContain("Invalid credentials");',
      )
      .replace(currentMarker, "  });\n"),
  );
  if (
    projectedFrozenBytes.byteLength !== policy.frozen.bytes ||
    sha256(projectedFrozenBytes) !== policy.frozen.sha256
  ) {
    fail(
      "TEST_TIMEOUT_SUCCESSOR_DRIFT",
      "The exact M10-T01B compatibility projection did not reconstruct the frozen test bytes.",
    );
  }
  return deepFreeze({
    relationship: policy.relationship,
    path: policy.path,
    timeoutMilliseconds: policy.timeoutMilliseconds,
    frozenReceipt: policy.frozen,
    currentReceipt: policy.current,
    exactFrozenProjection: true,
  });
}

/** Builds detached deterministic M09-T14/G09 publication and activation evidence. */
export async function buildDesenAppPublishActivationEvidence(rawOptions = undefined) {
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
  if (options.fileOverrides.size === 0) {
    return deepFreeze({
      ...frozen,
      currentCompatibility: readDesenAppHistoricalReaderProjection(
        evergreenProductCompositionSuccessor,
        "desen-app-publish-activation",
      ),
    });
  }
  const parents = DESEN_APP_PUBLISH_ACTIVATION_PARENT_PINS.map((pin) =>
    authenticateParent(files.get(pin.path), pin),
  );
  const source = verifyDesenAppPublishActivationSourcePolicy(
    Object.fromEntries(
      Object.entries(SOURCE_PATHS).map(([key, relativePath]) => [
        key,
        decodeUtf8(files.get(relativePath), relativePath),
      ]),
    ),
  );
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const trackedReceipts = receipts(files);
  const currentProjection = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-publish-activation",
    profile: "desen.app.publish-activation-proof.v1",
    task: "M09-T14",
    gate: "G09",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: parents,
    claim: {
      taskStatus: "DONE",
      gateStatus: "DONE",
      savedAuthoredSourceOnly: true,
      publisherRerunFromSavedSource: true,
      scenarioPreviewPublished: false,
      fixtureDataPublished: false,
      operationInputOrSecretPublished: false,
      rejectedDiagnosticsPublished: false,
      exactCanonicalBundleBytesStored: true,
      fixedPreviewChannelCompareAndSet: true,
      mutableChannelIsActivationAuthority: false,
      sourceGenerationDistinct: true,
      channelGenerationDistinct: true,
      durableActivationGenerationDistinct: true,
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
    },
    authority: {
      source,
      protocolProfiles: {
        input:
          "one exact clean persisted authored Source generation, never an effective scenario preview, fixture, operation input, or rejected diagnostic candidate",
        publisher:
          "fresh public publishDesenSource execution through the App preview helper with the exact reference Catalog",
        publication:
          "exact canonical Bundle bytes stored by immutable revision before one fixed preview-channel compare-and-set",
        activation:
          "server-owned reference-host channel consumption with a distinct durable activation generation and exact active revision",
        containment:
          "stale, conflict, failed, and indeterminate outcomes never claim the candidate active and preserve last-known-good authority",
      },
    },
    application: {
      package: packageContract,
      flow: [
        "admit only a ready persisted snapshot whose current and saved authored Source canonical forms match",
        "rerun the public Publisher from that exact authored Source and require the current preview revision",
        "canonicalize and forward the resulting exact Bundle bytes with its closed revision",
        "store immutable Bundle bytes before moving the fixed preview channel with compare-and-set",
        "ask the server-owned reference host to consume that exact channel generation and revision",
        "claim Active only after an exact durable activation receipt for the same revision",
        "preserve last-known-good activation and expose conflict, failure, stale, or indeterminate outcomes without blind retry",
      ],
      ownership: {
        authoredSourceAndGeneration: "Desen App persistence session",
        bundleAndRevision: "public Publisher",
        immutableBundleAndChannelCas: "public Editor Web adapter over local control-plane API",
        activationAndActiveRevision: "server-owned reference-host channel controller",
        presentation: "Desen App Design-mode publication controls",
      },
    },
    tests,
    boundary: {
      trackedFiles: TRACKED_PATHS.length,
      trackedReceipts,
      proofReaderPaths: PROOF_READER_PATHS,
      parentArtifacts: parents.length,
      immutableInputs: true,
      sourceSymlinksRejected: true,
      historicalArtifactsReadOnly: true,
      realPublicIntegration: tests.realPublicIntegration,
    },
    result: "PASS",
    nonclaims: [
      "M09-T14/G09 proves only saved authored Source publication through the local preview channel and reference-host activation.",
      "Scenario projections, fixtures, operation inputs, secrets, and rejected diagnostic candidates remain transient and unpublished.",
      "A mutable channel remains discovery metadata and never becomes activation authority.",
      "A concrete browser E2E and remote deployment path remain NOT_PROVEN.",
      "P-08 remains NOT_PROVEN; PF-085, PF-086, and PF-089 remain OPEN.",
      "No required-gate or hosted-CI pass is inferred from this local evidence.",
    ],
  });
  const currentProjectionBytes = canonicalArtifactBytes(currentProjection);
  const publicationApplicationTimeoutSuccessor = authenticatePublicationApplicationTimeoutSuccessor(
    frozen.artifact,
    files,
  );
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const emptyProjectBrowserE2eSuccessor = authenticateM10EmptyProjectBrowserE2eSuccessor(files);
  const userCreatedBlankProjectSuccessor = authenticateM10UserCreatedBlankProjectSuccessor(
    files,
    null,
  );
  const visualBehaviorAuthoringSuccessor = authenticateM10VisualBehaviorAuthoringSuccessor(
    files,
    null,
  );
  const currentCompatibility = deepFreeze({
    emptyProjectBrowserE2eSuccessor,
    userCreatedBlankProjectSuccessor,
    visualBehaviorAuthoringSuccessor,
    schemaVersion: 1,
    proofId: "desen-app-publish-activation",
    profile: "desen.app.publish-activation-proof.v1",
    task: "M09-T14",
    gate: "G09",
    result: "PASS",
    projection: currentProjection,
    projectionBytes: currentProjectionBytes.byteLength,
    projectionSha256: sha256(currentProjectionBytes),
    boundary: {
      retainedHistoricalReceipts: RETAINED_HISTORICAL_PATHS.length,
      successorCompatibilityPaths: SUCCESSOR_COMPATIBILITY_PATHS.length,
      selfResealedPaths: SELF_RESEALED_PATHS,
      currentPathReceipts: trackedReceipts,
    },
    publicationApplicationTimeoutSuccessor,
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
    "Task: M09-T14",
    "Gate: G09",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "PF-085: OPEN",
    "PF-086: OPEN",
    "PF-089: OPEN",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ]) {
    if (!text.includes(required)) {
      fail("PROOF_DOCUMENT_DRIFT", `Proof document is missing ${required}.`);
    }
  }
}

/** Verifies committed M09-T14/G09 bytes and the visible report digest. */
export async function verifyDesenAppPublishActivationEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppPublishActivationEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_PUBLISH_ACTIVATION_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T14/G09 artifact bytes differ from fresh evidence.");
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
    gate: built.artifact.gate,
    result: built.artifact.result,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    prerequisites: built.artifact.prerequisites.length,
    trackedFiles: built.artifact.boundary.trackedFiles,
    rootTests: built.artifact.tests.rootTestNames.length,
    focusedTestDeclarations: built.artifact.tests.focusedTestDeclarations,
    p08Status: built.artifact.claim.p08Status,
    pf085Status: built.artifact.claim.pf085Status,
    pf086Status: built.artifact.claim.pf086Status,
    pf089Status: built.artifact.claim.pf089Status,
  });
}

/** Atomically writes exact deterministic M09-T14/G09 proof bytes. */
export async function writeDesenAppPublishActivationEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_PUBLISH_ACTIVATION_ARTIFACT_PATH,
  );
  const built = await buildDesenAppPublishActivationEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T14/G09 artifact write failed safely.", {
      cause: String(error),
    });
  }
  return deepFreeze({
    task: built.artifact.task,
    gate: built.artifact.gate,
    result: built.artifact.result,
    artifactPath,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.boundary.trackedFiles,
  });
}
