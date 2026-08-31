import { Buffer } from "node:buffer";
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
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-NODE-LINKED-DIAGNOSTICS.md";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const RUNTIME_DIAGNOSTICS_PARENT_PATH =
  "docs/proof/artifacts/runtime-react-0.1.0-reconciliation-diagnostics.json";
const CONTINUOUS_VALIDATION_PARENT_PATH =
  "docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json";
const SELECTION_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json";
const SCHEMA_INSPECTOR_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json";
const STRUCTURED_INSPECTOR_PARENT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json";
const NAMED_SLOTS_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json";
const STATE_BINDINGS_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json";
const EVENT_ACTIONS_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json";
const MODES_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json";
const FIXTURES_PARENT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const PERSISTENCE_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";

const SOURCE_PATHS = Object.freeze({
  authoringDiagnostics: "apps/desen-app/src/authoring-diagnostics.ts",
  diagnosticsPanel: "apps/desen-app/src/diagnostics-panel.tsx",
  adapterCanvas: "apps/desen-app/src/adapter-canvas.tsx",
  application: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
  inspectorPanel: "apps/desen-app/src/inspector-panel.tsx",
  authoringInspector: "apps/desen-app/src/authoring-inspector.ts",
  authoringState: "apps/desen-app/src/authoring-state.ts",
  authoringEventActions: "apps/desen-app/src/authoring-event-actions.ts",
  authoringSlots: "apps/desen-app/src/authoring-slots.ts",
  persistence: "apps/desen-app/src/authoring-persistence.ts",
});

const TEST_PATHS = Object.freeze({
  authoringDiagnostics: "apps/desen-app/test/authoring-diagnostics.test.ts",
  diagnosticsPanel: "apps/desen-app/test/diagnostics-panel.test.tsx",
  authoringInspector: "apps/desen-app/test/authoring-inspector.test.ts",
  authoringState: "apps/desen-app/test/authoring-state.test.ts",
  authoringEventActions: "apps/desen-app/test/authoring-event-actions.test.ts",
  authoringSlots: "apps/desen-app/test/authoring-slots.test.ts",
  adapterCanvas: "apps/desen-app/test/adapter-canvas.test.tsx",
  application: "apps/desen-app/test/application.test.tsx",
  persistenceApplication: "apps/desen-app/test/persistence-application.test.tsx",
});

const FOCUSED_TEST_PATHS = Object.freeze(Object.values(TEST_PATHS));
const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-node-linked-diagnostics-proof.mjs",
  "scripts/generate-desen-app-node-linked-diagnostics-proof.mjs",
  "scripts/verify-desen-app-node-linked-diagnostics.mjs",
  "tests/desen-app-node-linked-diagnostics.test.mjs",
]);
const TRACKED_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  LOCKFILE_PATH,
  ...Object.values(SOURCE_PATHS),
  ...Object.values(TEST_PATHS),
  RUNTIME_DIAGNOSTICS_PARENT_PATH,
  CONTINUOUS_VALIDATION_PARENT_PATH,
  SELECTION_PARENT_PATH,
  SCHEMA_INSPECTOR_PARENT_PATH,
  STRUCTURED_INSPECTOR_PARENT_PATH,
  NAMED_SLOTS_PARENT_PATH,
  STATE_BINDINGS_PARENT_PATH,
  EVENT_ACTIONS_PARENT_PATH,
  MODES_PARENT_PATH,
  FIXTURES_PARENT_PATH,
  PERSISTENCE_PARENT_PATH,
  ...PROOF_READER_PATHS,
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
const SELF_RESEALED_PATHS = Object.freeze([
  "scripts/lib/desen-app-node-linked-diagnostics-proof.mjs",
  "tests/desen-app-node-linked-diagnostics.test.mjs",
]);
const SUCCESSOR_COMPATIBILITY_PATHS = Object.freeze([
  ...T14_SUCCESSOR_RECEIPT_PATHS,
  ...SELF_RESEALED_PATHS,
]);
const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  M10_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH,
  M10_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH,
  M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
  "dependency-cruiser.config.cjs",
  ...new Set([
    ...TRACKED_PATHS,
    PUBLISH_ACTIVATION_ARTIFACT_PATH,
    ...T14_SUCCESSOR_RECEIPT_PATHS,
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
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 29_208,
  sha256: "8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972",
});

const EXPECTED_TEST_DECLARATION_COUNTS = Object.freeze({
  [TEST_PATHS.authoringDiagnostics]: 7,
  [TEST_PATHS.diagnosticsPanel]: 4,
  [TEST_PATHS.authoringInspector]: 27,
  [TEST_PATHS.authoringState]: 13,
  [TEST_PATHS.authoringEventActions]: 13,
  [TEST_PATHS.authoringSlots]: 23,
  [TEST_PATHS.adapterCanvas]: 10,
  [TEST_PATHS.application]: 40,
  [TEST_PATHS.persistenceApplication]: 17,
});
const EXPECTED_TEST_CASE_COUNTS = Object.freeze({
  [TEST_PATHS.authoringDiagnostics]: 7,
  [TEST_PATHS.diagnosticsPanel]: 4,
  [TEST_PATHS.authoringInspector]: 27,
  [TEST_PATHS.authoringState]: 13,
  [TEST_PATHS.authoringEventActions]: 13,
  [TEST_PATHS.authoringSlots]: 28,
  [TEST_PATHS.adapterCanvas]: 10,
  [TEST_PATHS.application]: 44,
  [TEST_PATHS.persistenceApplication]: 17,
});
const REQUIRED_TEST_NAMES = Object.freeze({
  [TEST_PATHS.authoringDiagnostics]: Object.freeze([
    "creates links only from invalidSubjects and leaves code/message/pointer guesses visible but inert",
    "preserves every duplicate occurrence without guessing which runtime instance belongs to it",
    "rejects stale report or rendered route authority and inconsistent runtime kinds without a partial model",
    "copies obligation metadata through a closed shape and never retains executable extras",
  ]),
  [TEST_PATHS.diagnosticsPanel]: Object.freeze([
    "keeps every diagnostic in projector order, announces the count, and does not steal focus",
    "renders every explicitly mapped occurrence as a native selection button",
    "leaves identity-looking unmapped and out-of-route metadata readable but non-selectable",
  ]),
  [TEST_PATHS.authoringInspector]: Object.freeze([
    "rejects invalid enum and numeric values without mutating the current Source",
  ]),
  [TEST_PATHS.authoringState]: Object.freeze([
    "returns the frozen rejected-candidate report without exposing the candidate",
  ]),
  [TEST_PATHS.authoringEventActions]: Object.freeze([
    "returns the frozen rejected-candidate report without exposing the candidate",
  ]),
  [TEST_PATHS.authoringSlots]: Object.freeze([
    "keeps dry-run inert but returns the exact report when deletion creates a semantic failure",
    "disables inserts whose Catalog defaults fail schema or bounded transition admission",
  ]),
  [TEST_PATHS.adapterCanvas]: Object.freeze([
    "renders Source-identity selection chrome as a sibling outside the managed subtree",
  ]),
  [TEST_PATHS.application]: Object.freeze([
    "keeps bound props explicit while boolean and numeric edits fail or apply atomically",
    "switches modes accessibly while preserving selection, authoring views, and local drafts",
    "uses only the App-owned drag intent and ignores forged native transfer authority",
    "forgets an admitted gap after the pointer reaches the dragged layer's no-op position",
  ]),
  [TEST_PATHS.persistenceApplication]: Object.freeze([
    "keeps rejected-candidate diagnostics outside Source, dirty state, and Save requests",
  ]),
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

function authenticateM10UserCreatedBlankProjectSuccessor(files) {
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
    if (M10_VISUAL_BEHAVIOR_AUTHORING_TRACKED_PATHS.includes(receipt.path)) continue;
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
      live?.byteLength !== receipt.bytes ||
      sha256(live ?? Buffer.alloc(0)) !== receipt.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `The exact current M10-T01B receipt drifted: ${receipt.path}.`,
      );
    }
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

/** Exact reviewed App cases in the nine-file M09-T13 focused suite. */
export const DESEN_APP_NODE_LINKED_DIAGNOSTICS_FOCUSED_TEST_CASES = 161;
const CURRENT_DESEN_APP_NODE_LINKED_DIAGNOSTICS_FOCUSED_TEST_CASES = 163;

/** Exact immutable proof receipts bounding the M09-T13 diagnostics authority. */
export const DESEN_APP_NODE_LINKED_DIAGNOSTICS_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M05-T05",
    proofId: null,
    path: RUNTIME_DIAGNOSTICS_PARENT_PATH,
    bytes: 19_234,
    sha256: "292731d7eff67d5c80bd0de0d0c940c9783e49efd34069c5c11cc9eb4264dbfb",
    profile: "desen-runtime-react-reconciliation-diagnostics-v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M08-T09",
    proofId: "editor-core-continuous-validation",
    path: CONTINUOUS_VALIDATION_PARENT_PATH,
    bytes: 40_099,
    sha256: "7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a",
    profile: "desen.editor-core.continuous-validation-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T04",
    proofId: "desen-app-selection-overlay",
    path: SELECTION_PARENT_PATH,
    bytes: 11_997,
    sha256: "9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1",
    profile: "desen.app.selection-overlay-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T05",
    proofId: "desen-app-schema-inspector",
    path: SCHEMA_INSPECTOR_PARENT_PATH,
    bytes: 22_998,
    sha256: "473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b",
    profile: "desen.app.schema-inspector-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T06",
    proofId: "desen-app-structured-inspector",
    path: STRUCTURED_INSPECTOR_PARENT_PATH,
    bytes: 26_133,
    sha256: "6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec",
    profile: "desen.app.structured-inspector-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T07",
    proofId: "desen-app-named-slot-authoring",
    path: NAMED_SLOTS_PARENT_PATH,
    bytes: 24_830,
    sha256: "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f",
    profile: "desen.app.named-slot-authoring-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T08",
    proofId: "desen-app-state-binding-editor",
    path: STATE_BINDINGS_PARENT_PATH,
    bytes: 28_766,
    sha256: "b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a",
    profile: "desen.app.state-binding-editor-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T09",
    proofId: "desen-app-event-action-editor",
    path: EVENT_ACTIONS_PARENT_PATH,
    bytes: 23_812,
    sha256: "0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab",
    profile: "desen.app.event-action-editor-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T10",
    proofId: "desen-app-design-run-modes",
    path: MODES_PARENT_PATH,
    bytes: 17_900,
    sha256: "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334",
    profile: "desen.app.design-run-modes-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T11",
    proofId: "desen-app-fixtures-scenarios-fidelity",
    path: FIXTURES_PARENT_PATH,
    bytes: 29_407,
    sha256: "3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d",
    profile: "desen.app.fixtures-scenarios-fidelity-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T12",
    proofId: "desen-app-source-persistence",
    path: PERSISTENCE_PARENT_PATH,
    bytes: 27_053,
    sha256: "717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734",
    profile: "desen.app.source-persistence-proof.v1",
    result: "PASS",
    immutable: true,
  }),
]);

/** Reviewed independent root-test names retained by the M09-T13 artifact. */
export const DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates exact validation, selection, mode, and persistence parents",
  "[mapping] proves only explicit context identity mappings create selectable targets",
  "[occurrences] preserves duplicate order and keeps unmapped diagnostics inert",
  "[fencing] rejects stale report, Catalog, route, and Runtime-kind authority",
  "[canvas] keeps the selectable invalid placeholder outside the managed Runtime subtree",
  "[mode] hides diagnostics in Run and never steals focus without explicit selection",
  "[obligations] exposes dynamic obligations only as inert visible metadata",
  "[persistence] keeps rejected diagnostics outside Source, dirty state, and Save requests",
  "[tests] retains exact nine-file 161-case focused and 24-file 339-case full evidence",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects projector, panel, integration, test, and package weakening",
  "[verification] rejects parent, artifact, report, destination, and linked-path drift",
]);

/** Default destination for deterministic M09-T13 evidence. */
export const DEFAULT_DESEN_APP_NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T13 evidence reader. */
export class DesenAppNodeLinkedDiagnosticsProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppNodeLinkedDiagnosticsProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppNodeLinkedDiagnosticsProofError(code, message, details);
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
    if (error instanceof DesenAppNodeLinkedDiagnosticsProofError) throw error;
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
  if (missing.length !== 0) fail(code, `${label} lost required M09-T13 policy.`, { missing });
}

function assertExcludes(source, markers, label) {
  const present = markers.filter((marker) => source.includes(marker));
  if (present.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} acquired forbidden diagnostics authority.`, {
      present,
    });
  }
}

function assertOccurrenceCount(source, marker, expected, label) {
  const actual = source.split(marker).length - 1;
  if (actual !== expected) {
    fail("SOURCE_POLICY_VIOLATION", `${label} exact M09-T13 occurrence count drifted.`, {
      marker,
      expected,
      actual,
    });
  }
}

function parseTypeScript(source, relativePath, code = "SOURCE_POLICY_VIOLATION") {
  const scriptKind = relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail(code, `${relativePath} must parse as TypeScript.`);
  }
  return sourceFile;
}

function inspectImports(source, relativePath) {
  const sourceFile = parseTypeScript(source, relativePath);
  const imports = [];
  const violations = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) violations.push("dynamic-import");
      if (
        ts.isIdentifier(node.expression) &&
        ["eval", "fetch", "require", "setInterval", "setTimeout"].includes(node.expression.text)
      ) {
        violations.push(`call:${node.expression.text}`);
      }
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["EventSource", "Function", "WebSocket", "XMLHttpRequest"].includes(node.expression.text)
    ) {
      violations.push(`new:${node.expression.text}`);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (violations.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${relativePath} acquired executable diagnostics authority.`, {
      violations,
    });
  }
  return Object.freeze(imports);
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

/** Verifies the complete App-owned M09-T13 diagnostics source boundary. */
export function verifyDesenAppNodeLinkedDiagnosticsSourcePolicy(rawInput) {
  const input = captureSourcePolicyInput(rawInput);
  const imports = Object.fromEntries(
    Object.entries(SOURCE_PATHS)
      .filter(([, relativePath]) => relativePath.endsWith(".ts") || relativePath.endsWith(".tsx"))
      .map(([key, relativePath]) => [key, inspectImports(input[key], relativePath)]),
  );

  assertIncludes(
    input.authoringDiagnostics,
    [
      'import { isJsonPointer, isSha256Digest } from "@desen/protocol"',
      "DesenEditorContinuousValidationReport",
      "DesenEditorInvalidSubjectMapping",
      "RuntimeReactDiagnosticIndex",
      "readonly diagnosticIndex: number",
      "readonly selectionKey: string",
      'readonly previewStatus: "materialized" | "invalid-placeholder"',
      'readonly linkStatus: "linked" | "outside-route" | "unmapped"',
      'readonly status: "rejected"',
      "report.documentFingerprint !== snapshot.documentFingerprint",
      "report.catalogSetFingerprint !== snapshot.catalogSetFingerprint",
      'return rejected("stale-validation-report")',
      'return rejected("stale-rendered-snapshot")',
      'return rejected("runtime-index-mismatch")',
      "report.invalidSubjects",
      "report.unmappedDiagnosticIndexes",
      "mapping.occurrencePointers.map",
      "mapping.subject.kind",
      "mapping.subject.id",
      "occurrenceSelectionKey(snapshot, index, mapping, occurrencePointer)",
      'linkStatus: "unmapped"',
      'linkStatus: "outside-route"',
      'linkStatus: "linked"',
      "runtimeNodeIdsBySourceNodeId",
      "runtimeNodeIdsByBehaviorId",
      "Object.freeze({ index, kind: obligation.kind, pointer: obligation.pointer, context })",
    ],
    SOURCE_PATHS.authoringDiagnostics,
  );
  assertExcludes(
    input.authoringDiagnostics,
    [
      "rendered.documentFingerprint",
      "diagnostic.code.includes",
      "diagnostic.message.includes",
      "diagnostic.pointer.includes",
      "obligation.execute",
      "onSelect:",
    ],
    SOURCE_PATHS.authoringDiagnostics,
  );
  assertOccurrenceCount(
    input.authoringDiagnostics,
    "report.invalidSubjects",
    2,
    SOURCE_PATHS.authoringDiagnostics,
  );

  assertIncludes(
    input.diagnosticsPanel,
    [
      'aria-label="Validation diagnostics"',
      'aria-live="polite"',
      'role="status"',
      "diagnostic.occurrences.map",
      "onSelect(occurrence.selectionKey)",
      'type="button"',
      "aria-current=",
      '"No Source target"',
      '"Outside this surface"',
      'aria-label="Deferred runtime checks"',
      'aria-label="Dismiss validation diagnostics"',
    ],
    SOURCE_PATHS.diagnosticsPanel,
  );
  assertExcludes(
    input.diagnosticsPanel,
    ["autoFocus", "dangerouslySetInnerHTML", "onClick={obligation"],
    SOURCE_PATHS.diagnosticsPanel,
  );

  assertIncludes(
    input.adapterCanvas,
    [
      'data-managed-capability-subtree="true"',
      'data-diagnostic-placeholder="source-identity"',
      "tabIndex={-1}",
      'role="status"',
      "projectAuthoringDiagnostics(",
      "diagnosticIndex: result.surface.diagnosticIndex",
      'mode === "design" && selectedDiagnostic !== undefined',
      "diagnosticPlaceholderRef.current?.focus({ preventScroll: true })",
      "</fieldset>",
      "<DiagnosticPlaceholderOverlay",
    ],
    SOURCE_PATHS.adapterCanvas,
  );
  assertOccurrenceCount(
    input.adapterCanvas,
    "<DiagnosticPlaceholderOverlay",
    1,
    SOURCE_PATHS.adapterCanvas,
  );

  assertIncludes(
    input.application,
    [
      "interface TransientAuthoringDiagnostics",
      "readonly ownerDocumentFingerprint: string",
      "readonly report: DesenEditorContinuousValidationReport",
      "readonly selectionKey: string",
      "const committedDocumentFingerprint = useMemo(() => digestCanonicalJson(document), [document])",
      "createDesenEditorContinuousValidator(preparedModel.model.validationCatalogs)",
      "transientDiagnostics.ownerDocumentFingerprint === committedDocumentFingerprint",
      "transientDiagnostics.snapshot.projectId === route.projectId",
      "transientDiagnostics.snapshot.surfaceId === route.surfaceId",
      "transientDiagnostics.snapshot.catalogSetFingerprint ===",
      "const report = result.ok ? undefined : result.validationReport",
      "documentFingerprint: report.documentFingerprint",
      "ownerDocumentFingerprint: committedDocumentFingerprint",
      "projectAuthoringDiagnostics(",
      "candidate.selectionKey === selectionKey",
      "setDiagnosticSelection(",
      "clearTransientDiagnostics()",
      'mode === "design" &&',
      'hidden={mode === "run"}',
      "<DiagnosticsPanel",
      "selectedSelectionKey: diagnosticSelection?.selectionKey ?? null",
      'data-component-drag-handle="true"',
      'data-layer-drag-handle="true"',
      "className={styles.slotBoundaryHitArea}",
      'data-slot-boundary-hit-area="true"',
      "onDragEnter={onBoundaryDragEnter}",
      "onDragOver={onBoundaryDragOver}",
      "onDrop={onBoundaryDrop}",
      "data-layer-drop-row-node-id={node.id}",
      'querySelector<HTMLElement>("[data-layer-drop-row-node-id]")',
      "onDrop={receiveComponentDrop}",
      'releaseAdmission.status === "rejected"',
      "interaction.dragSession.current.lastAcceptedProjection",
      "Math.abs(clientY - midpoint) <= LAYER_DROP_MIDPOINT_HYSTERESIS_PX",
      "clientY < midpoint",
      '"Current position"',
      "pendingLayerFocus.current = result.nodeId",
      'data-authoring-pane="layers"',
      "layersPane.current?.focus({ preventScroll: true })",
      "Remove layer",
    ],
    SOURCE_PATHS.application,
  );
  assertExcludes(
    input.application,
    ["flushSync", "draggable={enabled}", "draggable={movable}"],
    SOURCE_PATHS.application,
  );
  assertOccurrenceCount(
    input.application,
    "captureEditDiagnostics(result);",
    8,
    SOURCE_PATHS.application,
  );
  for (const handler of [
    "onDragEnter={enterComponentDrop}",
    "onDragLeave={leaveComponentDrop}",
    "onDragOver={admitComponentDrop}",
    "onDrop={receiveComponentDrop}",
  ]) {
    assertOccurrenceCount(input.application, handler, 2, SOURCE_PATHS.application);
  }

  assertIncludes(
    input.inspectorPanel,
    ["readonly diagnosticsControls?: ReactNode", "{diagnosticsControls}"],
    SOURCE_PATHS.inspectorPanel,
  );
  for (const key of [
    "authoringInspector",
    "authoringState",
    "authoringEventActions",
    "authoringSlots",
  ]) {
    assertIncludes(
      input[key],
      [
        "readonly validationReport?: DesenEditorContinuousValidationReport",
        '"source-invalid"',
        "validationReport",
      ],
      SOURCE_PATHS[key],
    );
  }
  assertIncludes(
    input.authoringInspector,
    ['return Object.freeze({ ok: false, reason: "source-invalid", validationReport: report })'],
    SOURCE_PATHS.authoringInspector,
  );
  assertIncludes(
    input.authoringState,
    ['return failure("source-invalid", validationReport)'],
    SOURCE_PATHS.authoringState,
  );
  assertIncludes(
    input.authoringEventActions,
    ['return failure("source-invalid", validationReport)'],
    SOURCE_PATHS.authoringEventActions,
  );
  assertIncludes(
    input.authoringSlots,
    [
      'failure("source-invalid", validationReport)',
      'failure("defaults-invalid", validationReport)',
    ],
    SOURCE_PATHS.authoringSlots,
  );

  assertExcludes(
    input.persistence,
    ["TransientAuthoringDiagnostics", "AuthoringDiagnosticsViewModel", "validationReport"],
    SOURCE_PATHS.persistence,
  );
  assertIncludes(
    input.applicationCss,
    [
      ".diagnosticsPanel",
      ".diagnosticsTarget:focus-visible",
      '.diagnosticsTarget[aria-current="true"]',
      ".diagnosticPlaceholder",
      ".diagnosticPlaceholder:focus-visible",
      '.componentsView[data-component-drag-active="true"]',
      '.componentsView[data-drop-hovered="true"]',
      ".componentDragHandle",
      ".layerDragHandle::before",
      '.slotBoundary[data-drop-ready="true"]',
      ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 1.25rem;",
      ".slotBoundaryHitArea {\n  position: absolute;\n  inset: 0;",
      '.slotBoundary[data-drop-ready="true"] .slotBoundaryHitArea,\n.slotBoundary[data-drop-noop="true"] .slotBoundaryHitArea {\n  pointer-events: auto;',
      '.slotBoundary[data-drop-noop-hovered="true"]::before',
      ".layerDragHandle {\n  position: relative;\n  width: 1.75rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.25rem;",
      ".componentDragHandle {\n  position: relative;\n  width: 2rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.1875rem -0.25rem;",
      ".deleteLayerGlyph",
    ],
    SOURCE_PATHS.applicationCss,
  );
  assertExcludes(
    input.applicationCss,
    [
      '[data-drag-active="true"] .slotBoundary',
      "margin-block: -0.875rem",
      "transition: min-height 100ms ease",
    ],
    SOURCE_PATHS.applicationCss,
  );

  return deepFreeze({
    imports,
    explicitInvalidSubjectMappingOnly: true,
    diagnosticTextIdentityInference: false,
    duplicateOccurrenceOrderPreserved: true,
    unmappedDiagnosticsVisibleAndInert: true,
    candidateDocumentAndCatalogFingerprintsRequired: true,
    renderedRouteAndRuntimeKindFenced: true,
    committedOwnerFingerprintFencedByApplication: true,
    snapshotBoundSelectionKeyReadmittedByApplication: true,
    invalidPlaceholderOutsideManagedRuntimeSubtree: true,
    runModeDiagnosticsHidden: true,
    focusRequiresExplicitSelection: true,
    obligationsVisibleMetadataOnly: true,
    rejectedCandidateDiagnosticsOutsidePersistence: true,
    editAdaptersReturnFrozenValidationReport: true,
    dedicatedComponentDragHandle: true,
    dedicatedLayerDragHandle: true,
    componentPanelWideDropSurface: true,
    innermostNestedSlotOwnsPointer: true,
    stableInsertionLaneGeometry: true,
    rowHalfProjectionBroadensHitArea: true,
    noOpPlacementFeedbackVisible: true,
    releaseDriftRetainsLastAdmittedPlacement: true,
    insertedNodeFocusedInLayers: true,
    selectedInstanceRemovalDiscoverable: true,
  });
}

function unwrapExpression(node) {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

function collectArrayDeclarations(sourceFile) {
  const declarations = new Map();
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined
    ) {
      const value = unwrapExpression(node.initializer);
      if (ts.isArrayLiteralExpression(value))
        declarations.set(node.name.text, value.elements.length);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return declarations;
}

function arrayLength(node, declarations) {
  const value = unwrapExpression(node);
  if (ts.isArrayLiteralExpression(value)) return value.elements.length;
  if (ts.isIdentifier(value)) return declarations.get(value.text);
  return undefined;
}

function staticTestName(node) {
  const value = unwrapExpression(node);
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  return undefined;
}

function isTestCall(node) {
  if (!ts.isCallExpression(node)) return false;
  if (ts.isIdentifier(node.expression) && ["it", "test"].includes(node.expression.text)) {
    return true;
  }
  if (!ts.isCallExpression(node.expression)) return false;
  const factory = node.expression;
  return (
    ts.isPropertyAccessExpression(factory.expression) &&
    ts.isIdentifier(factory.expression.expression) &&
    ["it", "test"].includes(factory.expression.expression.text) &&
    factory.expression.name.text === "each"
  );
}

function subtreeContainsTest(node) {
  let found = false;
  const visit = (candidate) => {
    if (found) return;
    if (isTestCall(candidate)) {
      found = true;
      return;
    }
    candidate.forEachChild(visit);
  };
  visit(node);
  return found;
}

function inspectTestFile(source, relativePath) {
  const sourceFile = parseTypeScript(source, relativePath, "TEST_POLICY_VIOLATION");
  const arrays = collectArrayDeclarations(sourceFile);
  let declarations = 0;
  let cases = 0;
  const names = [];
  const visit = (node, multiplier = 1) => {
    if (ts.isForOfStatement(node) && subtreeContainsTest(node.statement)) {
      const length = arrayLength(node.expression, arrays);
      if (length === undefined || length === 0) {
        fail("TEST_POLICY_VIOLATION", `${relativePath} has an unbounded test loop.`);
      }
      visit(node.statement, multiplier * length);
      return;
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && ["it", "test"].includes(node.expression.text)) {
        declarations += 1;
        cases += multiplier;
        const name =
          node.arguments[0] === undefined ? undefined : staticTestName(node.arguments[0]);
        if (name !== undefined) names.push(name);
        return;
      }
      if (ts.isCallExpression(node.expression)) {
        const factory = node.expression;
        if (
          ts.isPropertyAccessExpression(factory.expression) &&
          ts.isIdentifier(factory.expression.expression) &&
          ["it", "test"].includes(factory.expression.expression.text) &&
          factory.expression.name.text === "each"
        ) {
          const length =
            factory.arguments[0] === undefined
              ? undefined
              : arrayLength(factory.arguments[0], arrays);
          if (length === undefined || length === 0) {
            fail("TEST_POLICY_VIOLATION", `${relativePath} has an unbounded each table.`);
          }
          declarations += 1;
          cases += multiplier * length;
          const name =
            node.arguments[0] === undefined ? undefined : staticTestName(node.arguments[0]);
          if (name !== undefined) names.push(name);
          return;
        }
      }
    }
    node.forEachChild((child) => visit(child, multiplier));
  };
  visit(sourceFile);
  return Object.freeze({ declarations, cases, names: Object.freeze(names) });
}

function inspectTests(files) {
  const inventories = Object.fromEntries(
    FOCUSED_TEST_PATHS.map((relativePath) => [
      relativePath,
      inspectTestFile(decodeUtf8(files.get(relativePath), relativePath), relativePath),
    ]),
  );
  for (const relativePath of FOCUSED_TEST_PATHS) {
    const inventory = inventories[relativePath];
    if (
      inventory.declarations !== EXPECTED_TEST_DECLARATION_COUNTS[relativePath] ||
      inventory.cases !== EXPECTED_TEST_CASE_COUNTS[relativePath]
    ) {
      fail("TEST_POLICY_VIOLATION", `${relativePath} exact test inventory drifted.`, {
        actual: { declarations: inventory.declarations, cases: inventory.cases },
        expected: {
          declarations: EXPECTED_TEST_DECLARATION_COUNTS[relativePath],
          cases: EXPECTED_TEST_CASE_COUNTS[relativePath],
        },
      });
    }
    const missing = REQUIRED_TEST_NAMES[relativePath].filter(
      (name) => !inventory.names.includes(name),
    );
    if (missing.length !== 0) {
      fail("TEST_POLICY_VIOLATION", `${relativePath} lost required semantic tests.`, { missing });
    }
  }
  const focusedTestCases = FOCUSED_TEST_PATHS.reduce(
    (total, relativePath) => total + inventories[relativePath].cases,
    0,
  );
  if (focusedTestCases !== CURRENT_DESEN_APP_NODE_LINKED_DIAGNOSTICS_FOCUSED_TEST_CASES) {
    fail("TEST_POLICY_VIOLATION", "The exact focused M09-T13 case count drifted.");
  }
  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:diagnostics && node --test tests/desen-app-node-linked-diagnostics.test.mjs",
    focusedFiles: FOCUSED_TEST_PATHS,
    testDeclarationCounts: Object.fromEntries(
      FOCUSED_TEST_PATHS.map((relativePath) => [
        relativePath,
        inventories[relativePath].declarations,
      ]),
    ),
    testCaseCounts: Object.fromEntries(
      FOCUSED_TEST_PATHS.map((relativePath) => [relativePath, inventories[relativePath].cases]),
    ),
    focusedTestCases,
    fullAppTestFiles: 24,
    fullAppTestCases: 339,
    rootTestNames: DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES,
    semanticCoverage: [
      "EXPLICIT_CONTEXT_IDENTITY_MAPPING",
      "NO_TEXT_OR_POINTER_IDENTITY_INFERENCE",
      "DUPLICATE_OCCURRENCE_ORDER",
      "UNMAPPED_VISIBLE_NON_LINKABLE",
      "REPORT_SNAPSHOT_CATALOG_ROUTE_RUNTIME_KIND_FENCES",
      "SNAPSHOT_BOUND_SELECTION_READMISSION",
      "APP_OWNED_PLACEHOLDER_OUTSIDE_RUNTIME_SUBTREE",
      "RUN_HIDDEN_NO_FOCUS_STEAL",
      "INERT_OBLIGATION_METADATA",
      "DIAGNOSTICS_OUTSIDE_SOURCE_DIRTY_AND_SAVE",
    ],
  });
}

function inspectPackages(files) {
  const root = parseJson(
    files.get(ROOT_PACKAGE_PATH),
    ROOT_PACKAGE_PATH,
    "PACKAGE_POLICY_VIOLATION",
  );
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH, "PACKAGE_POLICY_VIOLATION");
  const appCommand =
    "vitest run test/authoring-diagnostics.test.ts test/diagnostics-panel.test.tsx test/authoring-inspector.test.ts test/authoring-state.test.ts test/authoring-event-actions.test.ts test/authoring-slots.test.ts test/adapter-canvas.test.tsx test/application.test.tsx test/persistence-application.test.tsx";
  if (app.name !== "@desen/app-web" || app.scripts?.["test:diagnostics"] !== appCommand) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact Desen App diagnostics command drifted.");
  }
  for (const dependency of ["@desen/editor-core", "@desen/protocol", "@desen/runtime-react"]) {
    if (app.dependencies?.[dependency] !== "workspace:*") {
      fail("PACKAGE_POLICY_VIOLATION", `Desen App lost ${dependency} diagnostics authority.`);
    }
  }
  const prefix =
    "pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:diagnostics && ";
  const expectedRootCommands = {
    "generate:desen-app-node-linked-diagnostics":
      prefix + "node scripts/generate-desen-app-node-linked-diagnostics-proof.mjs",
    "verify:desen-app-node-linked-diagnostics":
      prefix + "node scripts/verify-desen-app-node-linked-diagnostics.mjs",
    "test:desen-app-node-linked-diagnostics":
      prefix + "node --test tests/desen-app-node-linked-diagnostics.test.mjs",
  };
  for (const [name, command] of Object.entries(expectedRootCommands)) {
    if (root.scripts?.[name] !== command) {
      fail("PACKAGE_POLICY_VIOLATION", `The exact ${name} command drifted.`);
    }
  }
  return deepFreeze({
    appName: app.name,
    appTestCommand: appCommand,
    editorCoreDependency: "workspace:*",
    protocolDependency: "workspace:*",
    runtimeReactDependency: "workspace:*",
    rootPackageName: root.name,
    rootCommands: expectedRootCommands,
    parentsAuthenticatedInsideReader: true,
  });
}

function authenticateParent(bytes, pin) {
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", `The exact frozen ${pin.task} parent artifact changed.`);
  }
  const artifact = parseJson(bytes, `frozen ${pin.task} parent artifact`, "PARENT_DRIFT");
  if (
    artifact.task !== pin.task ||
    (artifact.proofId ?? null) !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    (pin.task === "M05-T05"
      ? artifact.claim?.boundedCallbackFreeImmutableDiagnosticIndex !== true
      : artifact.claim?.taskStatus !== "DONE")
  ) {
    fail("PARENT_DRIFT", `The frozen ${pin.task} identity drifted.`);
  }
  if (
    pin.task === "M05-T05" &&
    (artifact.claim?.liveSessionSubscriptionCommitOnly !== true ||
      artifact.claim?.boundedCallbackFreeImmutableDiagnosticIndex !== true ||
      artifact.diagnostics?.repeatedSourceIdentityOneToMany !== true ||
      artifact.diagnostics?.callbackFields !== 0)
  ) {
    fail("PARENT_DRIFT", "The frozen M05-T05 Runtime diagnostic-index authority drifted.");
  }
  if (
    pin.task === "M08-T09" &&
    (artifact.claim?.explicitSubjectInvalidNodeMapping !== true ||
      artifact.claim?.duplicateOccurrenceMapping !== true ||
      artifact.claim?.controlledUnmappedDiagnostics !== true ||
      artifact.claim?.completeAuthoringSensitiveDocumentFingerprint !== true ||
      artifact.claim?.orderSensitiveCatalogSetFingerprint !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M08-T09 continuous-validation authority drifted.");
  }
  if (
    pin.task === "M09-T04" &&
    (artifact.claim?.publicDiagnosticIndexOnly !== true ||
      artifact.claim?.repeatedRuntimeInstancesPreserved !== true ||
      artifact.claim?.selectionChromeOutsideManagedCapabilitySubtree !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T04 selection authority drifted.");
  }
  if (
    pin.task === "M09-T05" &&
    (artifact.claim?.continuousSchemaRevalidation !== true ||
      artifact.claim?.failedEditPreservesCurrentDocument !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T05 schema Inspector authority drifted.");
  }
  if (
    pin.task === "M09-T06" &&
    (artifact.claim?.continuousSchemaRevalidation !== true ||
      artifact.claim?.failedEditPreservesCurrentDocument !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T06 structured Inspector authority drifted.");
  }
  if (
    pin.task === "M09-T07" &&
    (artifact.claim?.continuousCompleteSourceRevalidation !== true ||
      artifact.claim?.failedDeletionPreservesCurrentDocument !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T07 named-slot authority drifted.");
  }
  if (
    pin.task === "M09-T08" &&
    (artifact.claim?.continuousCompleteSourceRevalidation !== true ||
      artifact.claim?.failedEditPreservesCurrentDocument !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T08 state-binding authority drifted.");
  }
  if (
    pin.task === "M09-T09" &&
    (artifact.claim?.continuousCompleteSourceRevalidation !== true ||
      artifact.claim?.failedEditPreservesCurrentDocument !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T09 event/action authority drifted.");
  }
  if (
    pin.task === "M09-T10" &&
    (artifact.claim?.sameManagedCapabilitySubtreeOnToggle !== true ||
      artifact.claim?.accessibleModeControl !== true ||
      artifact.claim?.diagnosticsClaimed !== false)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T10 mode authority drifted.");
  }
  if (
    pin.task === "M09-T11" &&
    (artifact.claim?.authoredSourceAndPublishablePreviewUnchanged !== true ||
      artifact.claim?.diagnosticsClaimed !== false ||
      artifact.claim?.operationInputOrPasswordRetained !== false)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T11 fixtures/scenarios authority drifted.");
  }
  if (
    pin.task === "M09-T12" &&
    (artifact.claim?.authoredSourceOnly !== true ||
      artifact.claim?.completeAuthoredSourceCanonicalDirtyComparison !== true ||
      artifact.claim?.diagnosticsClaimed !== false)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T12 persistence authority drifted.");
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
    "frozen M09-T13 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T13 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T13 proof artifact");
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M09-T13" ||
    artifact.proofId !== "desen-app-node-linked-diagnostics" ||
    artifact.profile !== "desen.app.node-linked-diagnostics-proof.v1" ||
    artifact.result !== "PASS" ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.immutableRejectedCandidateReport !== true ||
    artifact.claim?.explicitContextIdentityMappingOnly !== true ||
    artifact.claim?.diagnosticCodeMessagePointerIdentityInference !== false ||
    artifact.claim?.duplicateOccurrenceOrderPreserved !== true ||
    artifact.claim?.unmappedDiagnosticsSelectable !== false ||
    artifact.claim?.reportSnapshotDocumentFingerprintFenced !== true ||
    artifact.claim?.reportSnapshotCatalogFingerprintFenced !== true ||
    artifact.claim?.routeAndSurfaceFenced !== true ||
    artifact.claim?.runtimeKindMismatchFailsClosed !== true ||
    artifact.claim?.invalidPlaceholderInsideManagedRuntimeSubtree !== false ||
    artifact.claim?.runModeDiagnosticsVisible !== false ||
    artifact.claim?.automaticFocusSteal !== false ||
    artifact.claim?.obligationsExecutable !== false ||
    artifact.claim?.rejectedDiagnosticsPersisted !== false ||
    artifact.claim?.rejectedDiagnosticsAffectDirtyState !== false ||
    artifact.claim?.rejectedDiagnosticsIncludedInSave !== false ||
    artifact.claim?.p08Status !== "NOT_PROVEN" ||
    artifact.claim?.p16Status !== "PROVEN" ||
    artifact.claim?.pf086Status !== "OPEN" ||
    artifact.claim?.pf089Status !== "OPEN" ||
    artifact.tests?.focusedTestCases !== DESEN_APP_NODE_LINKED_DIAGNOSTICS_FOCUSED_TEST_CASES ||
    artifact.tests?.fullAppTestFiles !== 24 ||
    artifact.tests?.fullAppTestCases !== 339 ||
    artifact.boundary?.trackedFiles !== TRACKED_PATHS.length ||
    artifact.boundary?.parentArtifacts !== 11 ||
    !Array.isArray(trackedReceipts) ||
    trackedReceipts.length !== TRACKED_PATHS.length ||
    trackedReceipts.some(
      (candidate) =>
        candidate === null ||
        typeof candidate !== "object" ||
        typeof candidate.path !== "string" ||
        !Number.isSafeInteger(candidate.bytes) ||
        candidate.bytes < 0 ||
        typeof candidate.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/u.test(candidate.sha256),
    ) ||
    !isDeepStrictEqual(
      artifact.tests?.rootTestNames,
      DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES,
    )
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T13 identity or retained claims drifted.");
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
      fail("BOUNDARY_DRIFT", `A retained M09-T13 task-time receipt drifted: ${relativePath}.`);
    }
  }
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

/** Builds detached deterministic M09-T13 node-linked diagnostics evidence. */
export async function buildDesenAppNodeLinkedDiagnosticsEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files] = await Promise.all([
    authenticateFrozenArtifact(workspaceRoot),
    readTrackedFiles(workspaceRoot, options.fileOverrides),
  ]);
  const parents = DESEN_APP_NODE_LINKED_DIAGNOSTICS_PARENT_PINS.map((pin) =>
    authenticateParent(files.get(pin.path), pin),
  );
  const source = verifyDesenAppNodeLinkedDiagnosticsSourcePolicy(
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
    proofId: "desen-app-node-linked-diagnostics",
    profile: "desen.app.node-linked-diagnostics-proof.v1",
    task: "M09-T13",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: parents,
    claim: {
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
      browserE2eClaimed: false,
      dedicatedComponentDragHandle: true,
      dedicatedLayerDragHandle: true,
      componentPanelWideDropSurface: true,
      innermostNestedSlotOwnsPointer: true,
      stableInsertionLaneGeometry: true,
      rowHalfProjectionBroadensHitArea: true,
      noOpPlacementFeedbackVisible: true,
      releaseDriftRetainsLastAdmittedPlacement: true,
      insertedNodeFocusedInLayers: true,
      selectedInstanceRemovalDiscoverable: true,
      p08Status: "NOT_PROVEN",
      p16Status: "PROVEN",
      pf086Status: "OPEN",
      pf089Status: "OPEN",
    },
    authority: {
      source,
      protocolProfiles: {
        report:
          "one immutable rejected-candidate continuous-validation report with exact document and Catalog fingerprints",
        mapping:
          "only Validator-owned invalidSubjects context identity; diagnostic text and pointers are display metadata",
        occurrence:
          "every explicit occurrence pointer retained in Validator order under one snapshot-bound selection key",
        runtime:
          "current public Runtime React diagnostic index admitted only for the current project and surface",
        placeholder:
          "App-owned focusable-on-request sibling outside the managed Runtime capability subtree",
        mode: "Design-only diagnostics presentation with no mount-authority change and no Run focus steal",
        obligations:
          "closed callback-free visible metadata with no resolver or execution authority",
        persistence:
          "transient rejected-candidate state excluded from committed Source, canonical dirty projection, and Save requests",
        authoringInteraction:
          "dedicated component and layer grips, one panel-wide authenticated append surface, innermost nested-slot pointer ownership, stable compact lanes with whole-row midpoint projection, explicit no-op feedback, and selected-instance removal discovery without widening mutation authority",
      },
    },
    application: {
      package: packageContract,
      flow: [
        "capture the exact frozen validation report only from one rejected edit",
        "fence the candidate report by exact candidate document and Catalog fingerprints",
        "fence retained transient state by the last-known-good committed Source owner and current App route",
        "project links only from explicit invalidSubjects context identities",
        "retain every duplicate occurrence and leave unmapped or outside-route diagnostics non-linkable",
        "re-admit an opaque snapshot-bound selection key from the current projection",
        "use the public Runtime diagnostic index only to distinguish materialized identity from invalid placeholder",
        "render selected invalid diagnostics in App chrome outside the managed Runtime subtree",
        "hide diagnostics in Run and focus a placeholder only after an explicit current selection",
        "copy dynamic obligations into inert visible metadata without executing them",
        "clear transient diagnostics on every successful committed Source replacement",
        "start component drag only from its dedicated dotted grip and admit the complete Components panel for the highlighted target",
        "start layer drag only from its dedicated dotted grip, fence pointer ownership to the innermost named slot, and preserve the last admitted placement through release drift",
        "switch successful insertion to Layers, focus the new node, and expose Remove layer plus guarded keyboard deletion",
      ],
      ownership: {
        validationReport: "Editor Core continuous validator",
        targetMapping: "Validator invalidSubjects entries",
        selection: "Desen App snapshot-bound key re-admission",
        runtimeIdentity: "public Runtime React diagnostic index",
        placeholderAndPanel: "Desen App Design chrome",
        managedRuntimeSubtree: "unchanged Runtime React adapter boundary",
        persistenceAndDirtyState: "committed authored Source only",
        dragAndRemovalChrome: "Desen App-owned authoring interaction state outside Runtime",
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
      focusedAppTestCases: tests.focusedTestCases,
      focusedAppTestCaseCountPinned: true,
      fullAppTestFiles: tests.fullAppTestFiles,
      fullAppTestCases: tests.fullAppTestCases,
      fullAppTestCaseCountPinned: true,
      finalCommandWiringPinned: true,
      historicalProofReadersTracked: false,
    },
    result: "PASS",
    nonclaims: [
      "M09-T13 proves only App-owned node-linked diagnostics for rejected local authoring candidates.",
      "Diagnostics do not mutate or replace the last-known-good committed Source or Runtime preview.",
      "Dynamic obligations remain visible metadata and do not grant Runtime execution authority.",
      "M09-T14 publication and activation remain NOT_PROVEN.",
      "A concrete App storage adapter and automated real-browser E2E remain NOT_PROVEN.",
      "P-16 is PROVEN for the selected Web–React profile; native diagnostic identity remains independently profiled.",
      "PF-086 remains OPEN because interoperable diagnostic-index and editor-subscription profiles are not defined.",
      "P-08 remains NOT_PROVEN; PF-089 remains OPEN.",
      "The retained authoring compatibility correction does not widen named-slot, cardinality, validator, or native-transfer authority.",
      "No required-gate, global CI count, or hosted-CI pass is inferred from local evidence.",
    ],
  });
  const publishActivationSuccessor = authenticatePublishActivationSuccessor(files);
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const emptyProjectBrowserE2eSuccessor = authenticateM10EmptyProjectBrowserE2eSuccessor(files);
  const userCreatedBlankProjectSuccessor = authenticateM10UserCreatedBlankProjectSuccessor(files);
  const visualBehaviorAuthoringSuccessor = authenticateM10VisualBehaviorAuthoringSuccessor(files);
  const currentCompatibility = deepFreeze({
    emptyProjectBrowserE2eSuccessor,
    userCreatedBlankProjectSuccessor,
    visualBehaviorAuthoringSuccessor,
    schemaVersion: 1,
    proofId: "desen-app-node-linked-diagnostics",
    profile: "desen.app.node-linked-diagnostics-proof.v1",
    task: "M09-T13",
    result: "PASS",
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      immutableRejectedCandidateReport: frozen.artifact.claim.immutableRejectedCandidateReport,
      explicitContextIdentityMappingOnly: frozen.artifact.claim.explicitContextIdentityMappingOnly,
      rejectedDiagnosticsPersisted: frozen.artifact.claim.rejectedDiagnosticsPersisted,
      publicationClaimed: frozen.artifact.claim.publicationClaimed,
      activationClaimed: frozen.artifact.claim.activationClaimed,
      p08Status: frozen.artifact.claim.p08Status,
      p16Status: frozen.artifact.claim.p16Status,
      pf086Status: frozen.artifact.claim.pf086Status,
      pf089Status: frozen.artifact.claim.pf089Status,
    },
    prerequisites: parents,
    source: currentProjection.authority.source,
    package: packageContract,
    tests,
    boundary: {
      retainedHistoricalReceipts: RETAINED_HISTORICAL_PATHS.length,
      successorCompatibilityPaths: SUCCESSOR_COMPATIBILITY_PATHS.length,
      currentPathReceipts: receipts(files),
    },
    publishActivationSuccessor,
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
    "Task: M09-T13",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "P-16: PROVEN",
    "PF-086: OPEN",
    "PF-089: OPEN",
    "M09-T14: NOT_PROVEN",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ]) {
    if (!text.includes(required)) {
      fail("PROOF_DOCUMENT_DRIFT", `Proof document is missing ${required}.`);
    }
  }
}

/** Verifies committed M09-T13 bytes and the visible report digest. */
export async function verifyDesenAppNodeLinkedDiagnosticsEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppNodeLinkedDiagnosticsEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T13 artifact bytes differ from fresh evidence.");
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
    testDeclarationCounts: built.artifact.tests.testDeclarationCounts,
    testCaseCounts: built.artifact.tests.testCaseCounts,
    focusedTestCases: built.artifact.tests.focusedTestCases,
    fullAppTestFiles: built.artifact.tests.fullAppTestFiles,
    fullAppTestCases: built.artifact.tests.fullAppTestCases,
    p08Status: built.artifact.claim.p08Status,
    p16Status: built.artifact.claim.p16Status,
    pf086Status: built.artifact.claim.pf086Status,
    pf089Status: built.artifact.claim.pf089Status,
  });
}

/** Atomically writes exact deterministic M09-T13 proof bytes. */
export async function writeDesenAppNodeLinkedDiagnosticsEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
  );
  const built = await buildDesenAppNodeLinkedDiagnosticsEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T13 artifact write failed safely.", {
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
