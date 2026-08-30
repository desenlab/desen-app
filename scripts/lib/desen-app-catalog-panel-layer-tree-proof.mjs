import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-CATALOG-PANEL-LAYER-TREE.md";
const NAMED_SLOT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json";
const FIXTURES_SCENARIOS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const SHELL_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json";
const REFERENCE_ARTIFACT_PATH =
  "docs/proof/artifacts/reference-catalog-web-capability-artifact.json";
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const SOURCE_PATH = "examples/sign-in/official-derived.source.desen.json";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const AUTHORING_SOURCE_PATH = "apps/desen-app/src/authoring-data.ts";
const AUTHORING_SELECTION_SOURCE_PATH = "apps/desen-app/src/authoring-selection.ts";
const AUTHORING_INSPECTOR_SOURCE_PATH = "apps/desen-app/src/authoring-inspector.ts";
const AUTHORING_PREVIEW_SOURCE_PATH = "apps/desen-app/src/authoring-preview.ts";
const INSPECTOR_PANEL_SOURCE_PATH = "apps/desen-app/src/inspector-panel.tsx";
const STRUCTURED_JSON_SOURCE_PATH = "apps/desen-app/src/structured-json.ts";
const AUTHORING_SLOT_SOURCE_PATH = "apps/desen-app/src/authoring-slots.ts";
const AUTHORING_STATE_SOURCE_PATH = "apps/desen-app/src/authoring-state.ts";
const STATE_PANEL_SOURCE_PATH = "apps/desen-app/src/state-panel.tsx";
const AUTHORING_EVENT_ACTION_SOURCE_PATH = "apps/desen-app/src/authoring-event-actions.ts";
const EVENT_ACTION_PANEL_SOURCE_PATH = "apps/desen-app/src/event-action-panel.tsx";
const AUTHORING_FIXTURES_SOURCE_PATH = "apps/desen-app/src/authoring-fixtures.ts";
const AUTHORING_SCENARIOS_SOURCE_PATH = "apps/desen-app/src/authoring-scenarios.ts";
const PREVIEW_CONTROLS_SOURCE_PATH = "apps/desen-app/src/preview-controls.tsx";
const PREVIEW_FIDELITY_SOURCE_PATH = "apps/desen-app/src/preview-fidelity.ts";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const ADAPTER_CANVAS_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const OFFICIAL_BUNDLE_PATH = "examples/sign-in/official-derived.bundle.desen.json";
const AUTHORING_TEST_PATH = "apps/desen-app/test/authoring-data.test.ts";
const AUTHORING_SELECTION_TEST_PATH = "apps/desen-app/test/authoring-selection.test.ts";
const AUTHORING_INSPECTOR_TEST_PATH = "apps/desen-app/test/authoring-inspector.test.ts";
const AUTHORING_PREVIEW_TEST_PATH = "apps/desen-app/test/authoring-preview.test.ts";
const INSPECTOR_PANEL_TEST_PATH = "apps/desen-app/test/inspector-panel.test.tsx";
const STRUCTURED_JSON_TEST_PATH = "apps/desen-app/test/structured-json.test.ts";
const AUTHORING_SLOT_TEST_PATH = "apps/desen-app/test/authoring-slots.test.ts";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
const ADAPTER_CANVAS_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const AUTHORING_FIXTURES_TEST_PATH = "apps/desen-app/test/authoring-fixtures.test.ts";
const AUTHORING_SCENARIOS_TEST_PATH = "apps/desen-app/test/authoring-scenarios.test.ts";
const PREVIEW_CONTROLS_TEST_PATH = "apps/desen-app/test/preview-controls.test.tsx";
const PREVIEW_FIDELITY_TEST_PATH = "apps/desen-app/test/preview-fidelity.test.ts";
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
  return receiptMap;
}

const APP_PATHS = Object.freeze([
  "apps/desen-app/package.json",
  "apps/desen-app/tsconfig.json",
  "apps/desen-app/index.html",
  "apps/desen-app/README.md",
  "apps/desen-app/src/assets/breadcrumb-separator.svg",
  "apps/desen-app/src/assets/desen-logo.svg",
  "apps/desen-app/src/assets/plus.svg",
  "apps/desen-app/src/assets/settings.svg",
  "apps/desen-app/src/assets/theme.svg",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/authoring-data.ts",
  "apps/desen-app/src/main.tsx",
  "apps/desen-app/src/project-data.ts",
  "apps/desen-app/src/project-navigation.ts",
  "apps/desen-app/src/styles.css",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/authoring-data.test.ts",
  "apps/desen-app/test/main-lifecycle.test.tsx",
  "apps/desen-app/test/project-navigation.test.ts",
]);
const APP_SOURCE_PATHS = Object.freeze(
  APP_PATHS.filter((relativePath) => /\/src\/.+\.(?:ts|tsx|css|svg)$/u.test(relativePath)),
);
const TYPESCRIPT_SOURCE_PATHS = Object.freeze(
  APP_SOURCE_PATHS.filter((relativePath) => /\.(?:ts|tsx)$/u.test(relativePath)),
);
const SVG_PATHS = Object.freeze(
  APP_SOURCE_PATHS.filter((relativePath) => relativePath.endsWith(".svg")),
);
const PROOF_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-catalog-panel-layer-tree-proof.mjs",
  "scripts/generate-desen-app-catalog-panel-layer-tree-proof.mjs",
  "scripts/verify-desen-app-catalog-panel-layer-tree.mjs",
  "tests/desen-app-catalog-panel-layer-tree.test.mjs",
]);
const TRACKED_PATHS = Object.freeze([
  ...APP_PATHS,
  "pnpm-lock.yaml",
  CATALOG_PATH,
  SOURCE_PATH,
  ...PROOF_PATHS,
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
  "apps/desen-app/package.json",
  "apps/desen-app/README.md",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/styles.css",
  AUTHORING_SOURCE_PATH,
  ADAPTER_CANVAS_SOURCE_PATH,
  AUTHORING_SELECTION_SOURCE_PATH,
  "apps/desen-app/test/application.test.tsx",
  AUTHORING_TEST_PATH,
  AUTHORING_SELECTION_TEST_PATH,
  "apps/desen-app/test/main-lifecycle.test.tsx",
  "pnpm-lock.yaml",
  "scripts/lib/desen-app-catalog-panel-layer-tree-proof.mjs",
  "tests/desen-app-catalog-panel-layer-tree.test.mjs",
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
    ADAPTER_CANVAS_SOURCE_PATH,
    AUTHORING_SELECTION_SOURCE_PATH,
    AUTHORING_SELECTION_TEST_PATH,
    AUTHORING_INSPECTOR_SOURCE_PATH,
    AUTHORING_PREVIEW_SOURCE_PATH,
    INSPECTOR_PANEL_SOURCE_PATH,
    STRUCTURED_JSON_SOURCE_PATH,
    AUTHORING_SLOT_SOURCE_PATH,
    AUTHORING_STATE_SOURCE_PATH,
    STATE_PANEL_SOURCE_PATH,
    AUTHORING_EVENT_ACTION_SOURCE_PATH,
    AUTHORING_FIXTURES_SOURCE_PATH,
    AUTHORING_SCENARIOS_SOURCE_PATH,
    EVENT_ACTION_PANEL_SOURCE_PATH,
    PREVIEW_CONTROLS_SOURCE_PATH,
    PREVIEW_FIDELITY_SOURCE_PATH,
    AUTHORING_INSPECTOR_TEST_PATH,
    AUTHORING_PREVIEW_TEST_PATH,
    INSPECTOR_PANEL_TEST_PATH,
    STRUCTURED_JSON_TEST_PATH,
    AUTHORING_SLOT_TEST_PATH,
    ADAPTER_CANVAS_TEST_PATH,
    AUTHORING_FIXTURES_TEST_PATH,
    AUTHORING_SCENARIOS_TEST_PATH,
    PREVIEW_CONTROLS_TEST_PATH,
    PREVIEW_FIDELITY_TEST_PATH,
  ]),
]);
const CURRENT_TYPESCRIPT_SOURCE_PATHS = Object.freeze([
  ...new Set([
    ...TYPESCRIPT_SOURCE_PATHS,
    ...T12_SUCCESSOR_RECEIPT_PATHS.filter((entry) => /\/src\/.+\.(?:ts|tsx)$/u.test(entry)),
    ...T13_SUCCESSOR_RECEIPT_PATHS.filter((entry) => /\/src\/.+\.(?:ts|tsx)$/u.test(entry)),
    ...T14_SUCCESSOR_RECEIPT_PATHS.filter((entry) =>
      /^apps\/desen-app\/src\/.+\.(?:ts|tsx)$/u.test(entry),
    ),
    ADAPTER_CANVAS_SOURCE_PATH,
    AUTHORING_SELECTION_SOURCE_PATH,
    AUTHORING_INSPECTOR_SOURCE_PATH,
    AUTHORING_PREVIEW_SOURCE_PATH,
    INSPECTOR_PANEL_SOURCE_PATH,
    STRUCTURED_JSON_SOURCE_PATH,
    AUTHORING_SLOT_SOURCE_PATH,
    AUTHORING_STATE_SOURCE_PATH,
    STATE_PANEL_SOURCE_PATH,
    AUTHORING_EVENT_ACTION_SOURCE_PATH,
    AUTHORING_FIXTURES_SOURCE_PATH,
    AUTHORING_SCENARIOS_SOURCE_PATH,
    EVENT_ACTION_PANEL_SOURCE_PATH,
    PREVIEW_CONTROLS_SOURCE_PATH,
    PREVIEW_FIDELITY_SOURCE_PATH,
  ]),
]);
const RETAINED_HISTORICAL_PATHS = Object.freeze(
  TRACKED_PATHS.filter((relativePath) => !SUCCESSOR_COMPATIBILITY_PATHS.includes(relativePath)),
);
const SELF_RESEALED_PATHS = Object.freeze([
  "scripts/lib/desen-app-catalog-panel-layer-tree-proof.mjs",
  "tests/desen-app-catalog-panel-layer-tree.test.mjs",
]);
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 25_375,
  sha256: "85a310feaf1a0cc3656055cd3a76eeb02e02a278c21d22167853b53c03f1ee61",
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
const EXPECTED_VALIDATOR_IMPORTS = Object.freeze([
  "validateDesenInteractionCatalogSet",
  "validateDesenSourceInteractionContracts",
]);
const EXPECTED_NAMED_SLOT_DRAG_DROP_HANDLERS = Object.freeze(
  new Map([
    ["draggable", 3],
    ["onDragEnd", 2],
    ["onDragEnter", 5],
    ["onDragLeave", 3],
    ["onDragOver", 5],
    ["onDragStart", 3],
    ["onDrop", 4],
  ]),
);
const EXPECTED_COMPONENTS = Object.freeze([
  Object.freeze({
    id: "com.example.ui/Alert",
    displayName: "Alert",
    authoringCategory: "Feedback",
    semanticCategory: "feedback",
    description: "Feedback message.",
    defaultProps: Object.freeze({ text: "Message", tone: "info" }),
    slots: Object.freeze([]),
  }),
  Object.freeze({
    id: "com.example.ui/Button",
    displayName: "Button",
    authoringCategory: "Actions",
    semanticCategory: "action",
    description: "Action button.",
    defaultProps: Object.freeze({ label: "Button", loading: false, variant: "primary" }),
    slots: Object.freeze([]),
  }),
  Object.freeze({
    id: "com.example.ui/Stack",
    displayName: "Stack",
    authoringCategory: "Layout",
    semanticCategory: "layout",
    description: "Linear layout container.",
    defaultProps: Object.freeze({ direction: "vertical", gap: "md" }),
    slots: Object.freeze([
      Object.freeze({
        name: "default",
        required: false,
        minItems: 0,
        maxItems: null,
        acceptsCategories: Object.freeze([
          "layout",
          "content",
          "input",
          "action",
          "feedback",
          "complex",
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: "com.example.ui/Text",
    displayName: "Text",
    authoringCategory: "Content",
    semanticCategory: "content",
    description: "Text content.",
    defaultProps: Object.freeze({ role: "body", text: "Text" }),
    slots: Object.freeze([]),
  }),
  Object.freeze({
    id: "com.example.ui/TextField",
    displayName: "Text field",
    authoringCategory: "Inputs",
    semanticCategory: "input",
    description: "Text input.",
    defaultProps: Object.freeze({ label: "Label", value: "" }),
    slots: Object.freeze([]),
  }),
]);
const EXPECTED_SURFACE_TREES = Object.freeze([
  Object.freeze({
    id: "home",
    root: Object.freeze({
      id: "home.layout",
      use: "com.example.ui/Stack",
      conditional: false,
      behaviors: Object.freeze([]),
      slots: Object.freeze([
        Object.freeze({
          name: "default",
          children: Object.freeze([
            Object.freeze({
              id: "home.title",
              use: "com.example.ui/Text",
              conditional: false,
              behaviors: Object.freeze([]),
              slots: Object.freeze([]),
            }),
          ]),
        }),
      ]),
    }),
  }),
  Object.freeze({
    id: "sign-in",
    root: Object.freeze({
      id: "sign-in.layout",
      use: "com.example.ui/Stack",
      conditional: false,
      behaviors: Object.freeze([]),
      slots: Object.freeze([
        Object.freeze({
          name: "default",
          children: Object.freeze([
            Object.freeze({
              id: "sign-in.title",
              use: "com.example.ui/Text",
              conditional: false,
              behaviors: Object.freeze([]),
              slots: Object.freeze([]),
            }),
            Object.freeze({
              id: "sign-in.email",
              use: "com.example.ui/TextField",
              conditional: false,
              behaviors: Object.freeze([]),
              slots: Object.freeze([]),
            }),
            Object.freeze({
              id: "sign-in.password",
              use: "com.example.ui/TextField",
              conditional: false,
              behaviors: Object.freeze([]),
              slots: Object.freeze([]),
            }),
            Object.freeze({
              id: "sign-in.error",
              use: "com.example.ui/Alert",
              conditional: true,
              behaviors: Object.freeze([]),
              slots: Object.freeze([]),
            }),
            Object.freeze({
              id: "sign-in.submit",
              use: "com.example.ui/Button",
              conditional: false,
              behaviors: Object.freeze([]),
              slots: Object.freeze([]),
            }),
          ]),
        }),
      ]),
    }),
  }),
]);

/** Exact immutable M09-T01 shell authority required by the M09-T02 proof. */
export const DESEN_APP_CATALOG_PANEL_SHELL_PIN = Object.freeze({
  task: "M09-T01",
  path: SHELL_ARTIFACT_PATH,
  bytes: 12_118,
  sha256: "c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220",
  proofId: "desen-app-shell-navigation",
  profile: "desen.app.shell-navigation-proof.v1",
  result: "PASS",
});

/** Exact immutable M03-T10 reference capability authority required by M09-T02. */
export const DESEN_APP_CATALOG_PANEL_REFERENCE_CAPABILITY_PIN = Object.freeze({
  task: "M03-T10",
  path: REFERENCE_ARTIFACT_PATH,
  bytes: 87_159,
  sha256: "4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0",
  result: "PASS",
  id: "run.desen.reference.sign-in",
  version: "0.1.0",
  target: "web-react",
});

/** Exact root-test names owned by the deterministic M09-T02 proof reader. */
export const DESEN_APP_CATALOG_PANEL_LAYER_TREE_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact M09-T01 shell and M03-T10 capability artifacts",
  "[catalog-source] records five exact Catalog components and both exact Source trees",
  "[validation-ui] records fail-closed validation, filtering, tabs, and read-only hierarchy evidence",
  "[boundary] admits only inert Catalog JSON and validator APIs across Desen package imports",
  "[determinism] builds byte-identical detached M09-T02 evidence twice",
  "[mutation] rejects prerequisite, Catalog, Source, dependency, import, and test drift",
  "[verification-writer] rejects visible-pin drift and atomically preserves destinations on tampering",
  "[filesystem] rejects linked prerequisite, artifact, proof, and tracked-file authorities",
]);

/** Default destination for deterministic M09-T02 evidence. */
export const DEFAULT_DESEN_APP_CATALOG_PANEL_LAYER_TREE_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T02 evidence reader. */
export class DesenAppCatalogPanelLayerTreeProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppCatalogPanelLayerTreeProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppCatalogPanelLayerTreeProofError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
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
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) {
    fail("OPTIONS_INVALID", `${label} contains an unknown or symbol field.`);
  }
  const captured = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
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
    utilTypes.isSharedArrayBuffer(value.buffer) ||
    (Object.getPrototypeOf(value) !== Uint8Array.prototype &&
      Object.getPrototypeOf(value) !== Buffer.prototype)
  ) {
    fail("OPTIONS_INVALID", `${label} must be exact non-shared Buffer or Uint8Array bytes.`);
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

function captureBuildOptions(rawOptions) {
  const options = exactOwnDataOptions(
    rawOptions,
    [
      "fileOverrides",
      "referenceArtifactBytes",
      "referenceArtifactPath",
      "shellArtifactBytes",
      "shellArtifactPath",
      "workspaceRoot",
    ],
    "build options",
  );
  const workspaceRoot = capturePath(options.workspaceRoot, "workspaceRoot", WORKSPACE_ROOT);
  return Object.freeze({
    workspaceRoot,
    fileOverrides: captureOverrides(options.fileOverrides),
    referenceArtifactBytes:
      options.referenceArtifactBytes === undefined
        ? undefined
        : captureBytes(options.referenceArtifactBytes, "referenceArtifactBytes"),
    referenceArtifactPath: capturePath(
      options.referenceArtifactPath,
      "referenceArtifactPath",
      path.join(workspaceRoot, REFERENCE_ARTIFACT_PATH),
    ),
    shellArtifactBytes:
      options.shellArtifactBytes === undefined
        ? undefined
        : captureBytes(options.shellArtifactBytes, "shellArtifactBytes"),
    shellArtifactPath: capturePath(
      options.shellArtifactPath,
      "shellArtifactPath",
      path.join(workspaceRoot, SHELL_ARTIFACT_PATH),
    ),
  });
}

async function readRegularAuthority(absolutePath, label) {
  const resolved = path.resolve(absolutePath);
  let canonicalParent;
  try {
    canonicalParent = await realpath(path.dirname(resolved));
  } catch (error) {
    fail("AUTHORITY_UNSAFE", `${label} parent is unavailable.`, { cause: String(error) });
  }
  const canonical = path.join(canonicalParent, path.basename(resolved));
  if (canonical !== resolved) {
    fail("AUTHORITY_UNSAFE", `${label} must not traverse a linked parent.`);
  }
  let before;
  let handle;
  try {
    before = await lstat(canonical);
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.size > MAX_AUTHORITY_BYTES
    ) {
      fail("AUTHORITY_UNSAFE", `${label} must be one bounded regular non-linked file.`);
    }
    handle = await open(canonical, READ_FLAGS);
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size
    ) {
      fail("AUTHORITY_UNSAFE", `${label} changed identity while opening.`);
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength !== before.size || bytes.byteLength > MAX_AUTHORITY_BYTES) {
      fail("AUTHORITY_UNSAFE", `${label} changed size while reading.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof DesenAppCatalogPanelLayerTreeProofError) throw error;
    fail("AUTHORITY_UNSAFE", `${label} could not be read safely.`, { cause: String(error) });
  } finally {
    await handle?.close();
  }
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("UTF8_INVALID", `${label} is not valid UTF-8.`);
  }
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  } catch (error) {
    if (error instanceof DesenAppCatalogPanelLayerTreeProofError) throw error;
    fail("JSON_INVALID", `${label} is not valid JSON.`);
  }
}

function exactTextCount(source, expected) {
  return source.split(expected).length - 1;
}

function requireText(source, expected, label, code = "IMPLEMENTATION_DRIFT") {
  if (exactTextCount(source, expected) < 1) {
    fail(code, `${label} lost required M09-T02 semantics.`, { expected });
  }
}

function authenticateShellArtifact(bytes) {
  const pin = DESEN_APP_CATALOG_PANEL_SHELL_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("SHELL_PREREQUISITE_DRIFT", "The exact frozen M09-T01 shell artifact changed.");
  }
  const artifact = parseJson(bytes, SHELL_ARTIFACT_PATH);
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== pin.proofId ||
    artifact?.profile !== pin.profile ||
    artifact?.task !== pin.task ||
    artifact?.result !== pin.result ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.shellImplemented !== true ||
    artifact?.claim?.projectNavigationImplemented !== true ||
    artifact?.claim?.unknownRoutesFailClosed !== true ||
    artifact?.claim?.catalogDrivenPanelImplemented !== false
  ) {
    fail("SHELL_PREREQUISITE_DRIFT", "The M09-T01 artifact lost exact shell semantics.");
  }
  return deepFreeze({ ...pin });
}

function authenticateReferenceArtifact(bytes) {
  const pin = DESEN_APP_CATALOG_PANEL_REFERENCE_CAPABILITY_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("REFERENCE_PREREQUISITE_DRIFT", "The exact frozen M03-T10 capability artifact changed.");
  }
  const artifact = parseJson(bytes, REFERENCE_ARTIFACT_PATH);
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.task !== pin.task ||
    artifact?.result !== pin.result ||
    artifact?.identity?.id !== pin.id ||
    artifact?.identity?.version !== pin.version ||
    artifact?.identity?.target !== pin.target ||
    artifact?.identity?.protocol !== "0.1.0" ||
    artifact?.catalog?.components?.length !== 5 ||
    artifact?.inventory?.files !== 76 ||
    artifact?.inventory?.totalBytes !== 224_069
  ) {
    fail(
      "REFERENCE_PREREQUISITE_DRIFT",
      "The M03-T10 artifact lost its exact historical capability identity or inventory.",
    );
  }
  return deepFreeze({ ...pin });
}

function plainObject(value, label, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(code, `${label} must remain an inert object.`);
  }
  return value;
}

function sortedKeys(value) {
  return Object.keys(value).sort(compareText);
}

function projectCatalogComponent(id, value) {
  const contract = plainObject(value, `Catalog component ${id}`, "CATALOG_SEMANTIC_DRIFT");
  const authoring = plainObject(
    contract.authoring,
    `Catalog component ${id}.authoring`,
    "CATALOG_SEMANTIC_DRIFT",
  );
  const slots =
    contract.slots === undefined
      ? []
      : sortedKeys(
          plainObject(contract.slots, `Catalog component ${id}.slots`, "CATALOG_SEMANTIC_DRIFT"),
        ).map((name) => {
          const slot = plainObject(
            contract.slots[name],
            `Catalog component ${id}.slots.${name}`,
            "CATALOG_SEMANTIC_DRIFT",
          );
          return {
            name,
            required: slot.required,
            minItems: slot.minItems,
            maxItems: slot.maxItems ?? null,
            acceptsCategories: Array.isArray(slot.acceptsCategories)
              ? [...slot.acceptsCategories]
              : [],
          };
        });
  return {
    id,
    displayName: authoring.displayName,
    authoringCategory: authoring.category,
    semanticCategory: contract.category,
    description: contract.description,
    defaultProps: authoring.defaultProps,
    slots,
  };
}

function verifyCatalog(bytes) {
  const catalog = plainObject(
    parseJson(bytes, CATALOG_PATH),
    CATALOG_PATH,
    "CATALOG_SEMANTIC_DRIFT",
  );
  if (
    catalog.kind !== "desen.catalog" ||
    catalog.desen !== "0.1.0" ||
    catalog.id !== "run.desen.reference.sign-in" ||
    catalog.version !== "0.1.0" ||
    catalog.target !== "web-react" ||
    typeof catalog.packageDigest !== "string" ||
    !/^sha256:[a-f0-9]{64}$/u.test(catalog.packageDigest) ||
    sortedKeys(plainObject(catalog.behaviors, "Catalog behaviors", "CATALOG_SEMANTIC_DRIFT"))
      .length !== 0 ||
    sortedKeys(plainObject(catalog.resources, "Catalog resources", "CATALOG_SEMANTIC_DRIFT"))
      .length !== 0 ||
    sortedKeys(
      plainObject(catalog.operations, "Catalog operations", "CATALOG_SEMANTIC_DRIFT"),
    ).join("\0") !== "com.example.auth/signIn"
  ) {
    fail(
      "CATALOG_SEMANTIC_DRIFT",
      "The exact reference Catalog identity or capability shape drifted.",
    );
  }
  const componentsObject = plainObject(
    catalog.components,
    "Catalog components",
    "CATALOG_SEMANTIC_DRIFT",
  );
  const components = sortedKeys(componentsObject).map((id) =>
    projectCatalogComponent(id, componentsObject[id]),
  );
  if (!isDeepStrictEqual(components, EXPECTED_COMPONENTS)) {
    fail(
      "CATALOG_SEMANTIC_DRIFT",
      "The exact five Catalog component authoring contracts drifted.",
      { components },
    );
  }
  return deepFreeze({
    receipt: { path: CATALOG_PATH, bytes: bytes.byteLength, sha256: sha256(bytes) },
    identity: {
      kind: catalog.kind,
      desen: catalog.desen,
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
      packageDigest: catalog.packageDigest,
    },
    components,
    componentCount: components.length,
    operationIds: sortedKeys(catalog.operations),
    behaviorCount: 0,
    resourceCount: 0,
  });
}

function projectSourceNode(value, label) {
  const node = plainObject(value, label, "SOURCE_SEMANTIC_DRIFT");
  if (typeof node.id !== "string" || typeof node.use !== "string") {
    fail("SOURCE_SEMANTIC_DRIFT", `${label} lost an exact id/use pair.`);
  }
  const behaviorValues =
    node.behaviors === undefined
      ? []
      : Array.isArray(node.behaviors)
        ? node.behaviors
        : fail("SOURCE_SEMANTIC_DRIFT", `${label}.behaviors must remain an array.`);
  const slotsObject =
    node.slots === undefined
      ? {}
      : plainObject(node.slots, `${label}.slots`, "SOURCE_SEMANTIC_DRIFT");
  return {
    id: node.id,
    use: node.use,
    conditional: Object.hasOwn(node, "when"),
    behaviors: behaviorValues.map((behavior, index) =>
      projectSourceNode(behavior, `${label}.behaviors[${index}]`),
    ),
    slots: sortedKeys(slotsObject).map((name) => {
      const children = slotsObject[name];
      if (!Array.isArray(children)) {
        fail("SOURCE_SEMANTIC_DRIFT", `${label}.slots.${name} must remain an array.`);
      }
      return {
        name,
        children: children.map((child, index) =>
          projectSourceNode(child, `${label}.slots.${name}[${index}]`),
        ),
      };
    }),
  };
}

function verifySource(bytes) {
  const source = plainObject(parseJson(bytes, SOURCE_PATH), SOURCE_PATH, "SOURCE_SEMANTIC_DRIFT");
  const catalogs = source.catalogs;
  const surfacesObject = plainObject(source.surfaces, "Source surfaces", "SOURCE_SEMANTIC_DRIFT");
  if (
    source.kind !== "desen.source" ||
    source.desen !== "0.1.0" ||
    source.id !== "com.example.account-app" ||
    source.entry !== "sign-in" ||
    !isDeepStrictEqual(catalogs, [
      { id: "run.desen.reference.sign-in", version: "0.1.0", target: "web-react" },
    ]) ||
    sortedKeys(surfacesObject).join("\0") !== "home\0sign-in"
  ) {
    fail(
      "SOURCE_SEMANTIC_DRIFT",
      "The official Source identity, requirement, or surfaces drifted.",
    );
  }
  const surfaces = sortedKeys(surfacesObject).map((id) => {
    const surface = plainObject(
      surfacesObject[id],
      `Source surface ${id}`,
      "SOURCE_SEMANTIC_DRIFT",
    );
    if (surface.id !== id) {
      fail("SOURCE_SEMANTIC_DRIFT", `Source surface ${id} lost its exact identity.`);
    }
    return { id, root: projectSourceNode(surface.root, `Source surface ${id}.root`) };
  });
  if (!isDeepStrictEqual(surfaces, EXPECTED_SURFACE_TREES)) {
    fail("SOURCE_SEMANTIC_DRIFT", "The exact sign-in or home component/slot tree drifted.", {
      surfaces,
    });
  }
  return deepFreeze({
    receipt: { path: SOURCE_PATH, bytes: bytes.byteLength, sha256: sha256(bytes) },
    identity: {
      kind: source.kind,
      desen: source.desen,
      id: source.id,
      entry: source.entry,
      catalogs,
    },
    surfaces,
    surfaceCount: surfaces.length,
    componentNodeCount: 8,
    conditionalNodeIds: ["sign-in.error"],
  });
}

function verifyPackage(bytes, rootBytes) {
  const manifest = parseJson(bytes, APP_PACKAGE_PATH);
  const root = parseJson(rootBytes, ROOT_PACKAGE_PATH);
  const namedSlotCommand =
    "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  const namedSlotPrefix =
    "node scripts/verify-desen-app-structured-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:named-slots && ";
  const namedSlotRootCommands = {
    "generate:desen-app-named-slot-authoring": `${namedSlotPrefix}node scripts/generate-desen-app-named-slot-authoring-proof.mjs`,
    "verify:desen-app-named-slot-authoring": `${namedSlotPrefix}node scripts/verify-desen-app-named-slot-authoring.mjs`,
    "test:desen-app-named-slot-authoring": `${namedSlotPrefix}node --test tests/desen-app-named-slot-authoring.test.mjs`,
  };
  const expectedDependencies = {
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
  const expectedDevDependencies = {
    "@desen/control-plane-api": "workspace:*",
    "@desen/editor-web": "workspace:*",
    "@desen/reference-host-web-server": "workspace:*",
    "@testing-library/dom": "10.4.1",
    "@testing-library/react": "16.3.2",
    "@types/node": "24.13.3",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    jsdom: "29.1.1",
    vite: "8.1.5",
    vitest: "4.1.10",
  };
  if (
    manifest?.name !== "@desen/app-web" ||
    manifest?.private !== true ||
    manifest?.type !== "module" ||
    !isDeepStrictEqual(manifest.dependencies, expectedDependencies) ||
    !isDeepStrictEqual(manifest.devDependencies, expectedDevDependencies) ||
    manifest.scripts?.build !== "vite build" ||
    manifest.scripts?.typecheck !== "tsc -p tsconfig.json --noEmit" ||
    manifest.scripts?.test !== "vitest run" ||
    manifest.scripts?.["test:authoring"] !==
      "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/application.test.tsx" ||
    manifest.scripts?.["test:canvas"] !==
      "vitest run test/adapter-canvas.test.tsx test/application.test.tsx test/main-lifecycle.test.tsx" ||
    manifest.scripts?.["test:selection"] !==
      "vitest run test/authoring-selection.test.ts test/adapter-canvas.test.tsx test/application.test.tsx" ||
    manifest.scripts?.["test:inspector"] !==
      "vitest run test/authoring-inspector.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx" ||
    manifest.scripts?.["test:structured-inspector"] !==
      "vitest run test/structured-json.test.ts test/authoring-inspector.test.ts test/inspector-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx" ||
    manifest.scripts?.["test:named-slots"] !== namedSlotCommand ||
    manifest.scripts?.["test:fixtures-scenarios"] !==
      "vitest run test/authoring-fixtures.test.ts test/authoring-scenarios.test.ts test/preview-fidelity.test.ts test/preview-controls.test.tsx test/adapter-canvas.test.tsx test/application.test.tsx" ||
    Object.entries(namedSlotRootCommands).some(
      ([name, command]) => root.scripts?.[name] !== command,
    ) ||
    manifest.scripts?.["test:shell"] !==
      "vitest run test/project-navigation.test.ts test/application.test.tsx test/main-lifecycle.test.tsx"
  ) {
    fail("PACKAGE_DRIFT", "The M09-T02 app dependency or focused-script contract drifted.");
  }
  return deepFreeze({
    name: manifest.name,
    private: true,
    dependencies: expectedDependencies,
    devDependencies: expectedDevDependencies,
    focusedTestScript: manifest.scripts["test:authoring"],
    successorTestScript: manifest.scripts["test:canvas"],
    selectionSuccessorTestScript: manifest.scripts["test:selection"],
    inspectorSuccessorTestScript: manifest.scripts["test:inspector"],
    structuredInspectorSuccessorTestScript: manifest.scripts["test:structured-inspector"],
    namedSlotSuccessorTestScript: namedSlotCommand,
    fixturesScenariosSuccessorTestScript: manifest.scripts["test:fixtures-scenarios"],
    namedSlotRootCommands,
    editorCoreDependency: true,
    catalogSdkDependency: true,
    publisherDependency: true,
    protocolDependency: true,
    runtimeCoreDependency: true,
    runtimeReactDependency: true,
    exactReferenceAdapterSubpath: "@desen/reference-catalog-web/react-adapters",
  });
}

function resolveRelativeImport(importerPath, specifier) {
  if (
    specifier.includes("\\") ||
    specifier.includes("?") ||
    specifier.includes("#") ||
    !/^(?:\.\.?\/)[a-zA-Z0-9._/-]+$/u.test(specifier)
  ) {
    fail("IMPORT_BOUNDARY_DRIFT", `${importerPath} has an invalid relative import.`, { specifier });
  }
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(importerPath), specifier),
  );
  const extension = path.posix.extname(resolved);
  const candidates =
    extension === ".js"
      ? [`${resolved.slice(0, -3)}.ts`, `${resolved.slice(0, -3)}.tsx`]
      : [".ts", ".tsx", ".css", ".svg", ".json"].includes(extension)
        ? [resolved]
        : [];
  const admitted = candidates.filter(
    (candidate) =>
      APP_SOURCE_PATHS.includes(candidate) ||
      candidate === ADAPTER_CANVAS_SOURCE_PATH ||
      candidate === AUTHORING_SELECTION_SOURCE_PATH ||
      candidate === AUTHORING_INSPECTOR_SOURCE_PATH ||
      candidate === AUTHORING_PREVIEW_SOURCE_PATH ||
      candidate === INSPECTOR_PANEL_SOURCE_PATH ||
      candidate === STRUCTURED_JSON_SOURCE_PATH ||
      candidate === AUTHORING_SLOT_SOURCE_PATH ||
      candidate === AUTHORING_STATE_SOURCE_PATH ||
      candidate === STATE_PANEL_SOURCE_PATH ||
      candidate === AUTHORING_EVENT_ACTION_SOURCE_PATH ||
      candidate === AUTHORING_FIXTURES_SOURCE_PATH ||
      candidate === AUTHORING_SCENARIOS_SOURCE_PATH ||
      candidate === EVENT_ACTION_PANEL_SOURCE_PATH ||
      candidate === PREVIEW_CONTROLS_SOURCE_PATH ||
      candidate === PREVIEW_FIDELITY_SOURCE_PATH ||
      T12_SUCCESSOR_RECEIPT_PATHS.includes(candidate) ||
      T13_SUCCESSOR_RECEIPT_PATHS.includes(candidate) ||
      T14_SUCCESSOR_RECEIPT_PATHS.includes(candidate) ||
      candidate === SOURCE_PATH ||
      candidate === OFFICIAL_BUNDLE_PATH,
  );
  if (admitted.length !== 1) {
    fail(
      "IMPORT_BOUNDARY_DRIFT",
      `${importerPath} imports outside the exact tracked application/Source authority.`,
      { specifier, candidates },
    );
  }
  return admitted[0];
}

function importBindingShape(declaration) {
  const clause = declaration.importClause;
  if (clause === undefined) {
    return { defaultImport: null, namedImports: [], namespaceImport: null, typeOnly: false };
  }
  const shape = {
    defaultImport: clause.name?.text ?? null,
    namedImports: [],
    namespaceImport: null,
    typeOnly: clause.isTypeOnly,
  };
  if (clause.namedBindings !== undefined) {
    if (ts.isNamespaceImport(clause.namedBindings)) {
      shape.namespaceImport = clause.namedBindings.name.text;
    } else {
      shape.namedImports = clause.namedBindings.elements
        .map((element) => element.propertyName?.text ?? element.name.text)
        .sort(compareText);
    }
  }
  return shape;
}

function unwrapPlatformExpression(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function platformGlobalRoot(node, roots) {
  const current = unwrapPlatformExpression(node);
  if (ts.isIdentifier(current)) return roots.has(current.text) ? current.text : null;
  if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    return platformGlobalRoot(current.expression, roots);
  }
  return null;
}

function staticPlatformMemberName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  const argument = node.argumentExpression && unwrapPlatformExpression(node.argumentExpression);
  return argument !== undefined &&
    (ts.isStringLiteralLike(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
    ? argument.text
    : null;
}

function isIdentifierValueReference(node) {
  if (ts.isDeclarationName(node)) return false;
  const parent = node.parent;
  return !(
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isLabeledStatement(parent) && parent.label === node) ||
    ((ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === node)
  );
}

function isExactAuthoringCanvasDocumentReference(node, relativePath) {
  if (relativePath !== AUTHORING_SOURCE_PATH || node.text !== "document") return false;
  let ancestor = node.parent;
  while (ancestor !== undefined) {
    if (ts.isFunctionDeclaration(ancestor)) {
      return (
        ancestor.name?.text === "projectAuthoringCanvasFrame" &&
        ancestor.parameters.length === 2 &&
        ts.isIdentifier(ancestor.parameters[0]?.name) &&
        ancestor.parameters[0].name.text === "document"
      );
    }
    ancestor = ancestor.parent;
  }
  return false;
}

function isPlatformMemberReceiver(node) {
  let current = node;
  while (true) {
    const parent = current.parent;
    if (
      (ts.isParenthesizedExpression(parent) ||
        ts.isAsExpression(parent) ||
        ts.isTypeAssertionExpression(parent) ||
        ts.isNonNullExpression(parent) ||
        ts.isSatisfiesExpression(parent)) &&
      parent.expression === current
    ) {
      current = parent;
      continue;
    }
    return (
      (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
      parent.expression === current
    );
  }
}

function inspectImportsAndExecutionBoundary(files) {
  const inventory = [];
  let referenceCatalogImports = 0;
  let validatorImports = 0;
  let catalogSdkImports = 0;
  let editorCoreImports = 0;
  let publisherImports = 0;
  let protocolImports = 0;
  let t11RuntimeCoreImports = 0;
  let t11TestkitImports = 0;
  let t11OperationRegistrationImports = 0;
  let exactRegistryConstructionCalls = 0;
  let publicDiagnosticIndexTypeOnlyImports = 0;
  const successorImportDeclarations = new Map();
  const successorImportedNames = new Map();
  const platformGlobalRoots = new Set(["document", "globalThis", "navigator", "self", "window"]);
  const forbiddenGlobalIdentifiers = new Set([
    "EventSource",
    "WebSocket",
    "XMLHttpRequest",
    "fetch",
    "indexedDB",
    "localStorage",
    "sessionStorage",
  ]);
  const forbiddenPlatformMembers = new Set([
    "EventSource",
    "WebSocket",
    "XMLHttpRequest",
    "cookie",
    "fetch",
    "indexedDB",
    "localStorage",
    "sendBeacon",
    "sessionStorage",
  ]);
  const forbiddenCallPattern =
    /^(?:activateRevision|createDesenEditor|insertDesenEditor|moveDesenEditor|deleteDesenEditor|setDesenEditor|publish(?:Revision|Source)?|saveDesen)/u;
  const admittedT05Calls = new Map([
    [
      AUTHORING_INSPECTOR_SOURCE_PATH,
      new Set([
        "createDesenEditorContinuousValidator",
        "deleteDesenEditorOwnerProp",
        "setDesenEditorOwnerProp",
      ]),
    ],
    [AUTHORING_PREVIEW_SOURCE_PATH, new Set(["createDesenEditorDocument", "publishDesenSource"])],
    [
      AUTHORING_SLOT_SOURCE_PATH,
      new Set([
        "createDesenEditorContinuousValidator",
        "deleteDesenEditorNode",
        "insertDesenEditorNode",
        "moveDesenEditorNode",
        "reorderDesenEditorNode",
        "setDesenEditorOwnerProp",
      ]),
    ],
    [
      AUTHORING_STATE_SOURCE_PATH,
      new Set([
        "createDesenEditorContinuousValidator",
        "deleteDesenEditorStateDeclaration",
        "insertDesenEditorStateDeclaration",
        "setDesenEditorStateInitial",
        "setDesenEditorStateSchema",
      ]),
    ],
    [
      AUTHORING_EVENT_ACTION_SOURCE_PATH,
      new Set([
        "createDesenEditorContinuousValidator",
        "deleteDesenEditorAction",
        "deleteDesenEditorEventHandler",
        "insertDesenEditorAction",
        "insertDesenEditorEventHandler",
        "reorderDesenEditorAction",
        "replaceDesenEditorAction",
      ]),
    ],
    [AUTHORING_SCENARIOS_SOURCE_PATH, new Set(["setDesenEditorOwnerProp"])],
  ]);
  const exactAdapterPackages = new Set([
    "@desen/reference-catalog-web/catalog.json",
    "@desen/reference-catalog-web/react-adapters",
    "@desen/reference-catalog-web/tokens",
    "@desen/runtime-core",
    "@desen/runtime-react",
  ]);
  const admittedAdapterRuntimeCalls = new Set([
    "createRuntimeHostPorts",
    "disposeRuntimeHeadlessSession",
    "mountRuntimeHeadlessSession",
    "createRuntimeReactAdapterRegistry",
    "renderRuntimeReactSurface",
    "useRuntimeReactSurface",
  ]);
  const forbiddenSelectionIdentifiers = new Set([
    "Element",
    "HTMLElement",
    "MutationObserver",
    "Node",
    "React",
    "ResizeObserver",
  ]);
  const forbiddenSelectionMembers = new Set([
    "Children",
    "cloneElement",
    "closest",
    "createElement",
    "getBoundingClientRect",
    "matches",
    "props",
    "querySelector",
    "querySelectorAll",
  ]);
  const namedSlotDragDropHandlers = new Map(
    [...EXPECTED_NAMED_SLOT_DRAG_DROP_HANDLERS].map(([name]) => [name, 0]),
  );

  for (const relativePath of CURRENT_TYPESCRIPT_SOURCE_PATHS) {
    const source = decodeUtf8(files.get(relativePath), relativePath);
    const sourceFile = ts.createSourceFile(
      relativePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    if (sourceFile.parseDiagnostics.length > 0) {
      fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} has TypeScript parse diagnostics.`, {
        diagnosticCodes: sourceFile.parseDiagnostics.map(({ code }) => code),
      });
    }
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) {
        if (!ts.isStringLiteralLike(node.moduleSpecifier)) {
          fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} has a non-literal import.`);
        }
        const specifier = node.moduleSpecifier.text;
        const shape = importBindingShape(node);
        let resolvedPath = null;
        if (specifier.startsWith(".")) {
          resolvedPath = resolveRelativeImport(relativePath, specifier);
        } else if (specifier === "react-dom") {
          fail(
            "IMPORT_BOUNDARY_DRIFT",
            "The M09-T13 successor must retain its surrendered react-dom application authority.",
          );
        } else if (specifier === "react" || specifier === "react-dom/client") {
          if (relativePath === AUTHORING_SELECTION_SOURCE_PATH) {
            fail(
              "IMPORT_BOUNDARY_DRIFT",
              "M09-T04 selection projection must remain independent of React tree authority.",
            );
          }
          // React is the already admitted M09-T01 application framework.
        } else if (specifier === "@desen/reference-catalog-web/catalog.json") {
          referenceCatalogImports += 1;
          if (
            ![
              AUTHORING_SOURCE_PATH,
              ADAPTER_CANVAS_SOURCE_PATH,
              APPLICATION_SOURCE_PATH,
              AUTHORING_PREVIEW_SOURCE_PATH,
            ].includes(relativePath) ||
            shape.defaultImport !== "referenceCatalog" ||
            shape.namespaceImport !== null ||
            shape.namedImports.length !== 0
          ) {
            fail(
              "IMPORT_BOUNDARY_DRIFT",
              "The Catalog must enter only as one exact inert JSON import.",
            );
          }
        } else if (specifier === "@desen/catalog-sdk") {
          if (
            ![
              AUTHORING_SOURCE_PATH,
              AUTHORING_INSPECTOR_SOURCE_PATH,
              INSPECTOR_PANEL_SOURCE_PATH,
              STRUCTURED_JSON_SOURCE_PATH,
              AUTHORING_SLOT_SOURCE_PATH,
              AUTHORING_STATE_SOURCE_PATH,
              STATE_PANEL_SOURCE_PATH,
              AUTHORING_EVENT_ACTION_SOURCE_PATH,
              EVENT_ACTION_PANEL_SOURCE_PATH,
              AUTHORING_SCENARIOS_SOURCE_PATH,
            ].includes(relativePath) ||
            shape.defaultImport !== null ||
            shape.namespaceImport !== null
          ) {
            fail("IMPORT_BOUNDARY_DRIFT", "Catalog SDK entered outside the T05 inspector path.");
          }
          catalogSdkImports += 1;
        } else if (specifier === "@desen/editor-core") {
          if (
            ![
              AUTHORING_SOURCE_PATH,
              AUTHORING_INSPECTOR_SOURCE_PATH,
              AUTHORING_PREVIEW_SOURCE_PATH,
              AUTHORING_SLOT_SOURCE_PATH,
              AUTHORING_STATE_SOURCE_PATH,
              AUTHORING_EVENT_ACTION_SOURCE_PATH,
              AUTHORING_SCENARIOS_SOURCE_PATH,
              ADAPTER_CANVAS_SOURCE_PATH,
              "apps/desen-app/src/authoring-diagnostics.ts",
              "apps/desen-app/src/application.tsx",
              "apps/desen-app/src/authoring-persistence.ts",
              "apps/desen-app/src/authoring-publication.ts",
            ].includes(relativePath) ||
            shape.defaultImport !== null ||
            shape.namespaceImport !== null ||
            ([
              ADAPTER_CANVAS_SOURCE_PATH,
              "apps/desen-app/src/authoring-diagnostics.ts",
              "apps/desen-app/src/authoring-persistence.ts",
            ].includes(relativePath) &&
              shape.typeOnly !== true)
          ) {
            fail("IMPORT_BOUNDARY_DRIFT", "Editor Core entered outside the T05 inspector path.");
          }
          editorCoreImports += 1;
        } else if (specifier === "@desen/publisher") {
          if (
            ![AUTHORING_PREVIEW_SOURCE_PATH, STRUCTURED_JSON_SOURCE_PATH].includes(relativePath) ||
            shape.defaultImport !== null ||
            shape.namespaceImport !== null
          ) {
            fail("IMPORT_BOUNDARY_DRIFT", "Publisher entered outside the T05 preview path.");
          }
          publisherImports += 1;
        } else if (specifier === "@desen/protocol") {
          if (
            ![
              AUTHORING_INSPECTOR_SOURCE_PATH,
              STRUCTURED_JSON_SOURCE_PATH,
              AUTHORING_SLOT_SOURCE_PATH,
              AUTHORING_EVENT_ACTION_SOURCE_PATH,
              APPLICATION_SOURCE_PATH,
              "apps/desen-app/src/authoring-diagnostics.ts",
              "apps/desen-app/src/authoring-persistence.ts",
              "apps/desen-app/src/authoring-publication.ts",
            ].includes(relativePath) ||
            shape.defaultImport !== null ||
            shape.namespaceImport !== null ||
            (shape.typeOnly &&
              ![
                "apps/desen-app/src/authoring-diagnostics.ts",
                "apps/desen-app/src/authoring-persistence.ts",
              ].includes(relativePath))
          ) {
            fail("IMPORT_BOUNDARY_DRIFT", "Protocol entered outside the T06 inspector path.");
          }
          protocolImports += 1;
        } else if (
          specifier === "@desen/runtime-core" &&
          [APPLICATION_SOURCE_PATH, AUTHORING_FIXTURES_SOURCE_PATH].includes(relativePath)
        ) {
          const expectedNames =
            relativePath === APPLICATION_SOURCE_PATH
              ? shape.typeOnly
                ? ["RuntimeHostPorts", "RuntimeJsonObject", "RuntimeOperationPort"]
                : ["createRuntimeHostPorts"]
              : ["RuntimeHostCallResult", "RuntimeOperationPort", "RuntimeOperationRequest"];
          if (
            shape.defaultImport !== null ||
            shape.namespaceImport !== null ||
            !isDeepStrictEqual(shape.namedImports, [...expectedNames].sort(compareText)) ||
            (relativePath === AUTHORING_FIXTURES_SOURCE_PATH && shape.typeOnly !== true)
          ) {
            fail("IMPORT_BOUNDARY_DRIFT", "The exact M09-T11 Runtime Core binding drifted.");
          }
          t11RuntimeCoreImports += 1;
        } else if (
          relativePath === AUTHORING_FIXTURES_SOURCE_PATH &&
          specifier === "@desen/reference-catalog-web/operations"
        ) {
          if (
            shape.defaultImport !== null ||
            shape.namespaceImport !== null ||
            shape.typeOnly ||
            !isDeepStrictEqual(shape.namedImports, ["signInOperationRegistration"])
          ) {
            fail("IMPORT_BOUNDARY_DRIFT", "The exact public sign-in operation binding drifted.");
          }
          t11OperationRegistrationImports += 1;
        } else if (
          relativePath === AUTHORING_FIXTURES_SOURCE_PATH &&
          specifier === "@desen/testkit"
        ) {
          const expectedNames = shape.typeOnly
            ? ["SyntheticFixtureValue"]
            : [
                "SYNTHETIC_FIXTURE_CONTEXT",
                "createSyntheticFixtureSnapshot",
                "lookupSyntheticOperationError",
                "lookupSyntheticOperationSuccess",
              ];
          if (
            shape.defaultImport !== null ||
            shape.namespaceImport !== null ||
            !isDeepStrictEqual(shape.namedImports, [...expectedNames].sort(compareText))
          ) {
            fail("IMPORT_BOUNDARY_DRIFT", "The exact public synthetic fixture binding drifted.");
          }
          t11TestkitImports += 1;
        } else if (
          [AUTHORING_SELECTION_SOURCE_PATH, "apps/desen-app/src/authoring-diagnostics.ts"].includes(
            relativePath,
          ) &&
          specifier === "@desen/runtime-react"
        ) {
          if (
            shape.defaultImport !== null ||
            shape.namespaceImport !== null ||
            shape.typeOnly !== true ||
            !isDeepStrictEqual(shape.namedImports, ["RuntimeReactDiagnosticIndex"])
          ) {
            fail(
              "IMPORT_BOUNDARY_DRIFT",
              "M09-T04 selection may import only the public diagnostic index as a type.",
            );
          }
          publicDiagnosticIndexTypeOnlyImports += 1;
        } else if (
          relativePath === ADAPTER_CANVAS_SOURCE_PATH &&
          exactAdapterPackages.has(specifier)
        ) {
          if (shape.defaultImport !== null || shape.namespaceImport !== null) {
            fail(
              "IMPORT_BOUNDARY_DRIFT",
              "M09-T03 public runtime and adapter imports must use reviewed named bindings only.",
            );
          }
          successorImportDeclarations.set(
            specifier,
            (successorImportDeclarations.get(specifier) ?? 0) + 1,
          );
          const importedNames = successorImportedNames.get(specifier) ?? new Set();
          for (const importedName of shape.namedImports) importedNames.add(importedName);
          successorImportedNames.set(specifier, importedNames);
        } else if (specifier === "@desen/validator") {
          validatorImports += 1;
          if (
            relativePath !== AUTHORING_SOURCE_PATH ||
            shape.defaultImport !== null ||
            shape.namespaceImport !== null ||
            !isDeepStrictEqual(
              shape.namedImports,
              [...EXPECTED_VALIDATOR_IMPORTS].sort(compareText),
            )
          ) {
            fail(
              "IMPORT_BOUNDARY_DRIFT",
              "The validator import must expose only the two reviewed cumulative-validation APIs.",
            );
          }
        } else {
          fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} imports an unreviewed package.`, {
            specifier,
          });
        }
        inventory.push({ path: relativePath, specifier, resolvedPath, bindings: shape });
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
        fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} must not re-export another module.`);
      } else if (ts.isImportEqualsDeclaration(node) || ts.isImportTypeNode(node)) {
        fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} contains an indirect import declaration.`);
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} contains an executable dynamic import.`);
      }

      if (
        ts.isIdentifier(node) &&
        isIdentifierValueReference(node) &&
        forbiddenGlobalIdentifiers.has(node.text)
      ) {
        fail("SCOPE_BOUNDARY_DRIFT", `${relativePath} gained platform I/O authority.`, {
          identifier: node.text,
        });
      }
      if (
        ts.isIdentifier(node) &&
        isIdentifierValueReference(node) &&
        platformGlobalRoots.has(node.text) &&
        !isExactAuthoringCanvasDocumentReference(node, relativePath) &&
        (relativePath === ADAPTER_CANVAS_SOURCE_PATH ||
          relativePath === AUTHORING_SELECTION_SOURCE_PATH ||
          (!T12_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) &&
            !T13_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) &&
            !T14_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) &&
            ![
              APPLICATION_SOURCE_PATH,
              AUTHORING_INSPECTOR_SOURCE_PATH,
              AUTHORING_PREVIEW_SOURCE_PATH,
              AUTHORING_SLOT_SOURCE_PATH,
              AUTHORING_STATE_SOURCE_PATH,
              AUTHORING_EVENT_ACTION_SOURCE_PATH,
              AUTHORING_SCENARIOS_SOURCE_PATH,
            ].includes(relativePath) &&
            !isPlatformMemberReceiver(node)))
      ) {
        fail("SCOPE_BOUNDARY_DRIFT", `${relativePath} gained broad platform-global authority.`, {
          identifier: node.text,
        });
      }
      if (
        relativePath === AUTHORING_SELECTION_SOURCE_PATH &&
        ts.isIdentifier(node) &&
        forbiddenSelectionIdentifiers.has(node.text)
      ) {
        fail("SCOPE_BOUNDARY_DRIFT", `${relativePath} gained private DOM or React authority.`, {
          identifier: node.text,
        });
      }
      if (
        relativePath === AUTHORING_SELECTION_SOURCE_PATH &&
        ts.isPropertyAccessExpression(node) &&
        forbiddenSelectionMembers.has(node.name.text)
      ) {
        fail("SCOPE_BOUNDARY_DRIFT", `${relativePath} gained private DOM or React inspection.`, {
          member: node.name.text,
        });
      }
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const root = platformGlobalRoot(node.expression, platformGlobalRoots);
        if (root !== null) {
          const member = staticPlatformMemberName(node);
          const localSourceDocument =
            root === "document" &&
            [
              AUTHORING_INSPECTOR_SOURCE_PATH,
              AUTHORING_SLOT_SOURCE_PATH,
              AUTHORING_STATE_SOURCE_PATH,
              AUTHORING_EVENT_ACTION_SOURCE_PATH,
              AUTHORING_SCENARIOS_SOURCE_PATH,
            ].includes(relativePath);
          if (!localSourceDocument && (member === null || forbiddenPlatformMembers.has(member))) {
            fail("SCOPE_BOUNDARY_DRIFT", `${relativePath} gained platform I/O authority.`, {
              root,
              member: member ?? "DYNAMIC_COMPUTED_MEMBER",
            });
          }
        }
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        forbiddenCallPattern.test(node.expression.text) &&
        !T12_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) &&
        !T13_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) &&
        !T14_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) &&
        admittedT05Calls.get(relativePath)?.has(node.expression.text) !== true
      ) {
        fail("SCOPE_BOUNDARY_DRIFT", `${relativePath} gained later-slice execution authority.`, {
          call: node.expression.text,
        });
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        admittedAdapterRuntimeCalls.has(node.expression.text)
      ) {
        if (
          relativePath !== ADAPTER_CANVAS_SOURCE_PATH &&
          !(
            relativePath === APPLICATION_SOURCE_PATH &&
            node.expression.text === "createRuntimeHostPorts"
          )
        ) {
          fail("SCOPE_BOUNDARY_DRIFT", `${relativePath} gained M09-T03 runtime authority.`, {
            call: node.expression.text,
          });
        }
        if (node.expression.text === "createRuntimeReactAdapterRegistry") {
          exactRegistryConstructionCalls += 1;
          if (
            node.arguments.length !== 1 ||
            !ts.isIdentifier(node.arguments[0]) ||
            node.arguments[0].text !== "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT"
          ) {
            fail(
              "SCOPE_BOUNDARY_DRIFT",
              "M09-T03 must construct its registry from the exact public reference input.",
            );
          }
        }
      }
      if (ts.isJsxOpeningLikeElement(node)) {
        const tagName = node.tagName.getText(sourceFile);
        if (
          /^(?:canvas|Inspector|RuntimeCanvas)$/u.test(tagName) ||
          (relativePath === ADAPTER_CANVAS_SOURCE_PATH &&
            /^(?:Stack|Text|TextField|Button|Alert|form|input|label|button)$/u.test(tagName))
        ) {
          fail("SCOPE_BOUNDARY_DRIFT", `${relativePath} gained a canvas or inspector element.`);
        }
        for (const property of node.attributes.properties) {
          if (
            ts.isJsxAttribute(property) &&
            /^(?:draggable|onDrag(?:End|Enter|Leave|Over|Start)?|onDrop)$/u.test(
              property.name.getText(sourceFile),
            )
          ) {
            if (relativePath !== APPLICATION_SOURCE_PATH) {
              fail("SCOPE_BOUNDARY_DRIFT", `${relativePath} gained drag/drop mutation behavior.`);
            }
            const handlerName = property.name.getText(sourceFile);
            namedSlotDragDropHandlers.set(
              handlerName,
              (namedSlotDragDropHandlers.get(handlerName) ?? 0) + 1,
            );
          }
        }
      }
      if (
        relativePath === ADAPTER_CANVAS_SOURCE_PATH &&
        ((ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "createElement") ||
          (ts.isPropertyAccessExpression(node) && node.name.text === "dangerouslySetInnerHTML"))
      ) {
        fail("SCOPE_BOUNDARY_DRIFT", `${relativePath} gained a handwritten managed-tree bypass.`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  if (
    referenceCatalogImports !== 4 ||
    validatorImports !== 1 ||
    publicDiagnosticIndexTypeOnlyImports !== 2 ||
    catalogSdkImports !== 11 ||
    editorCoreImports !== 20 ||
    publisherImports !== 3 ||
    protocolImports !== 10 ||
    t11RuntimeCoreImports !== 3 ||
    t11TestkitImports !== 2 ||
    t11OperationRegistrationImports !== 1 ||
    !isDeepStrictEqual(namedSlotDragDropHandlers, EXPECTED_NAMED_SLOT_DRAG_DROP_HANDLERS)
  ) {
    fail(
      "IMPORT_BOUNDARY_DRIFT",
      "The source graph must retain T02-T07 package, diagnostic-index, and inert drag-hint edges.",
      {
        catalogSdkImports,
        applicationReactDomImports: 0,
        editorCoreImports,
        namedSlotDragDropHandlers: Object.fromEntries(namedSlotDragDropHandlers),
        protocolImports,
        publisherImports,
        publicDiagnosticIndexTypeOnlyImports,
        referenceCatalogImports,
        validatorImports,
        t11OperationRegistrationImports,
        t11RuntimeCoreImports,
        t11TestkitImports,
      },
    );
  }

  const expectedSuccessorImports = new Map([
    [
      "@desen/reference-catalog-web/react-adapters",
      {
        declarations: 1,
        names: ["REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT"],
      },
    ],
    [
      "@desen/reference-catalog-web/tokens",
      { declarations: 1, names: ["REFERENCE_WEB_TOKEN_CSS_PROPERTIES"] },
    ],
    [
      "@desen/runtime-core",
      {
        declarations: 2,
        names: [
          "RuntimeHostPorts",
          "RuntimeJsonObject",
          "createRuntimeHostPorts",
          "disposeRuntimeHeadlessSession",
          "mountRuntimeHeadlessSession",
        ],
      },
    ],
    [
      "@desen/runtime-react",
      {
        declarations: 2,
        names: [
          "RuntimeReactLiveSurfaceInput",
          "RuntimeReactSurfaceBoundary",
          "RuntimeReactSurfaceFailureRenderer",
          "createRuntimeReactAdapterRegistry",
          "renderRuntimeReactSurface",
          "useRuntimeReactSurface",
        ],
      },
    ],
  ]);
  for (const [specifier, expected] of expectedSuccessorImports) {
    const actualNames = [...(successorImportedNames.get(specifier) ?? [])].sort(compareText);
    if (
      successorImportDeclarations.get(specifier) !== expected.declarations ||
      !isDeepStrictEqual(actualNames, [...expected.names].sort(compareText))
    ) {
      fail("IMPORT_BOUNDARY_DRIFT", "M09-T03 public runtime/adapter binding drifted.", {
        specifier,
        actualNames,
      });
    }
  }
  if (exactRegistryConstructionCalls !== 1) {
    fail(
      "SCOPE_BOUNDARY_DRIFT",
      "M09-T03 must construct exactly one registry from the public reference input.",
    );
  }

  const authoringImports = inventory.filter(
    ({ path: importerPath }) => importerPath === AUTHORING_SOURCE_PATH,
  );
  const sourceFixtureImports = authoringImports.filter(
    ({ resolvedPath }) => resolvedPath === SOURCE_PATH,
  );
  if (sourceFixtureImports.length !== 1) {
    fail("IMPORT_BOUNDARY_DRIFT", "The authoring model must import the one exact official Source.");
  }
  const applicationAdapterEdges = inventory.filter(
    ({ path: importerPath, resolvedPath }) =>
      importerPath === APPLICATION_SOURCE_PATH && resolvedPath === ADAPTER_CANVAS_SOURCE_PATH,
  );
  const adapterBundleEdges = inventory.filter(
    ({ path: importerPath, resolvedPath }) =>
      importerPath === ADAPTER_CANVAS_SOURCE_PATH && resolvedPath === OFFICIAL_BUNDLE_PATH,
  );
  const applicationSelectionEdges = inventory.filter(
    ({ path: importerPath, resolvedPath }) =>
      importerPath === APPLICATION_SOURCE_PATH && resolvedPath === AUTHORING_SELECTION_SOURCE_PATH,
  );
  const adapterSelectionEdges = inventory.filter(
    ({ path: importerPath, resolvedPath }) =>
      importerPath === ADAPTER_CANVAS_SOURCE_PATH &&
      resolvedPath === AUTHORING_SELECTION_SOURCE_PATH,
  );
  const selectionAuthoringEdges = inventory.filter(
    ({ path: importerPath, resolvedPath }) =>
      importerPath === AUTHORING_SELECTION_SOURCE_PATH && resolvedPath === AUTHORING_SOURCE_PATH,
  );
  if (
    applicationAdapterEdges.length !== 1 ||
    adapterBundleEdges.length !== 1 ||
    applicationSelectionEdges.length !== 2 ||
    adapterSelectionEdges.length !== 2 ||
    selectionAuthoringEdges.length !== 1
  ) {
    fail(
      "IMPORT_BOUNDARY_DRIFT",
      "M09-T04 must retain exact App/canvas and additive selection identity edges.",
    );
  }

  const indexHtml = decodeUtf8(files.get("apps/desen-app/index.html"), "apps/desen-app/index.html");
  if (
    exactTextCount(indexHtml, '<script type="module" src="/src/main.tsx"></script>') !== 1 ||
    [...indexHtml.matchAll(/<script\b/giu)].length !== 1 ||
    /\s(?:on[a-z][a-z0-9_-]*|srcdoc)\s*=/iu.test(indexHtml) ||
    /\bjavascript\s*:/iu.test(indexHtml) ||
    /<(?:iframe|object|embed)\b/iu.test(indexHtml)
  ) {
    fail("IMPORT_BOUNDARY_DRIFT", "index.html gained unreviewed executable authority.");
  }
  for (const relativePath of SVG_PATHS) {
    const svg = decodeUtf8(files.get(relativePath), relativePath);
    if (
      !svg.includes("<svg") ||
      /<(?:script|foreignObject)\b|\s(?:on[a-z][a-z0-9_-]*|href|xlink:href)\s*=|\bjavascript\s*:/iu.test(
        svg,
      )
    ) {
      fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} is no longer one inert local SVG.`);
    }
  }
  for (const relativePath of [
    "apps/desen-app/src/application.module.css",
    "apps/desen-app/src/styles.css",
  ]) {
    const css = decodeUtf8(files.get(relativePath), relativePath);
    if (/@import\b|url\(\s*["']?(?:https?:|data:|javascript:)/iu.test(css)) {
      fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} gained external or executable CSS authority.`);
    }
  }

  return deepFreeze({
    method: "TYPESCRIPT_AST_EXACT_IMPORT_AND_EXECUTION_BOUNDARY",
    imports: inventory,
    exactDesenPackageImports: [
      "@desen/reference-catalog-web/catalog.json",
      "@desen/validator#validateDesenInteractionCatalogSet",
      "@desen/validator#validateDesenSourceInteractionContracts",
      "@desen/reference-catalog-web/react-adapters#REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT",
      "@desen/reference-catalog-web/tokens#REFERENCE_WEB_TOKEN_CSS_PROPERTIES",
      "@desen/runtime-core#public-headless-session-apis",
      "@desen/runtime-react#public-managed-surface-apis",
      "@desen/runtime-react#RuntimeReactDiagnosticIndex(type-only)",
      "@desen/catalog-sdk#schema-derived-inspector-controls",
      "@desen/editor-core#public-authoring-mutation",
      "@desen/publisher#session-preview-publication",
      "@desen/protocol#canonical-structured-json",
      "@desen/editor-core#named-slot-mutation",
      "@desen/catalog-sdk#named-slot-contract-types",
      "@desen/protocol#named-slot-canonical-json",
    ],
    arbitraryExecutableImports: 0,
    editorCoreImports,
    catalogSdkImports,
    publisherImports,
    protocolImports,
    runtimeCoreImports: 2 + t11RuntimeCoreImports,
    runtimeReactImports: 2,
    t11TestkitImports,
    t11OperationRegistrationImports,
    publicDiagnosticIndexTypeOnlyImports,
    applicationReactDomImports: 0,
    adapterImports: 1,
    exactReferenceAdapterRegistryConstructions: 1,
    officialBundleImports: 1,
    applicationSelectionImports: 2,
    adapterSelectionImports: 2,
    selectionAuthoringImports: 1,
    handwrittenManagedTreeElements: 0,
    privateDomAccesses: 0,
    reviewedSourceMutationCalls: 13,
    platformIoCalls: 0,
    dragDropMutationHandlers: 0,
    reviewedNamedSlotDragDropHandlers: [...namedSlotDragDropHandlers.values()].reduce(
      (total, count) => total + count,
      0,
    ),
    canvasElements: 0,
    inspectorElements: 0,
  });
}

function countRegistrations(source) {
  return [...source.matchAll(/\b(?:it|test)\s*(?:\.each\s*\([^)]*\)\s*)?\(\s*["'`]/gsu)].length;
}

function verifyImplementationAndTests(files) {
  const authoring = decodeUtf8(files.get(AUTHORING_SOURCE_PATH), AUTHORING_SOURCE_PATH);
  const application = decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH);
  const adapterCanvas = decodeUtf8(
    files.get(ADAPTER_CANVAS_SOURCE_PATH),
    ADAPTER_CANVAS_SOURCE_PATH,
  );
  const authoringSelection = decodeUtf8(
    files.get(AUTHORING_SELECTION_SOURCE_PATH),
    AUTHORING_SELECTION_SOURCE_PATH,
  );
  const authoringTest = decodeUtf8(files.get(AUTHORING_TEST_PATH), AUTHORING_TEST_PATH);
  const authoringSelectionTest = decodeUtf8(
    files.get(AUTHORING_SELECTION_TEST_PATH),
    AUTHORING_SELECTION_TEST_PATH,
  );
  const applicationTest = decodeUtf8(files.get(APPLICATION_TEST_PATH), APPLICATION_TEST_PATH);

  for (const required of [
    "prepareCatalogAuthoringModel",
    "validateDesenInteractionCatalogSet([catalogValue])",
    "validateDesenSourceInteractionContracts(sourceValue, catalogSet.value)",
    'reason: "catalog-invalid"',
    'reason: "source-invalid"',
    'reason: "projection-limit"',
    "maxIdentityOccurrencesPerSurface: 25_000",
    "maxSourceTreeDepth: 64",
    "Object.freeze",
    "REFERENCE_AUTHORING_MODEL",
  ]) {
    requireText(authoring, required, AUTHORING_SOURCE_PATH, "VALIDATION_CONTRACT_DRIFT");
  }
  for (const required of [
    'aria-label="Authoring panel"',
    'data-authoring-layout="split"',
    'data-authoring-pane="components"',
    'data-authoring-pane="layers"',
    'data-authoring-pane-scroll="components"',
    'data-authoring-pane-scroll="layers"',
    "Search catalog components",
    "No catalog matches",
    "DESEN node / slot tree",
    "aria-label={`${selectedSurface.name} layer hierarchy`}",
    "will not substitute the sign-in",
    "createAuthoringComponentSelection",
    "isSameAuthoringComponentSelection",
    "selectedSourceNodeId",
    "onToggleSelection",
    "selection={selection}",
  ]) {
    requireText(application, required, APPLICATION_SOURCE_PATH);
  }
  for (const required of [
    "interface AuthoringDragSession {",
    "const sessionOwnerKey = JSON.stringify([target.ownerKind, target.ownerId, target.slot]);",
    "pending.sessionEpoch !== currentSession.epoch",
    "pending.ownerKey !== currentSession.ownerKey",
    "hitSlotSurface !== pending.slotSurface",
    'admission.status === "rejected" || admission.status === "unavailable"',
    "interaction.dragSession.current.ownerKey === sessionOwnerKey",
    "interaction.dragSession.current.lastAcceptedProjection",
    "dragSession.current = createAuthoringDragSession(current.epoch + 1);",
    'data-component-drag-handle="true"',
    'data-layer-drag-handle="true"',
    "data-layer-drop-row-node-id={node.id}",
    'querySelector<HTMLElement>("[data-layer-drop-row-node-id]")',
    "panelDragEnterDepth",
    "className={styles.slotBoundaryHitArea}",
    'data-slot-boundary-hit-area="true"',
    "onDragEnter={onBoundaryDragEnter}",
    "onDragOver={onBoundaryDragOver}",
    "onDrop={onBoundaryDrop}",
    "onDragEnter={enterComponentDrop}",
    "onDragLeave={leaveComponentDrop}",
    "onDrop={receiveComponentDrop}",
  ]) {
    requireText(application, required, APPLICATION_SOURCE_PATH, "SUCCESSOR_POLICY_VIOLATION");
  }
  for (const forbidden of ["flushSync", "draggable={enabled}", "draggable={movable}"]) {
    if (application.includes(forbidden)) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `${APPLICATION_SOURCE_PATH} reacquired superseded drag authority.`,
        { forbidden },
      );
    }
  }
  for (const required of [
    'const SUPPORTED_PROJECT_ID = "account-app"',
    'const SUPPORTED_SURFACE_ID = "sign-in"',
    "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT",
    "officialDerivedSignInBundle",
    "createRuntimeHostPorts",
    "mountRuntimeHeadlessSession",
    "disposeRuntimeHeadlessSession",
    "renderRuntimeReactSurface",
    "useRuntimeReactSurface",
    "RuntimeReactSurfaceBoundary",
    "<fieldset",
    "disabled",
    "style={REFERENCE_WEB_TOKEN_CSS_PROPERTIES}",
    "Sign-in adapter canvas",
    "Design preview · controls are disabled.",
    "projectAuthoringSelection",
    'data-managed-capability-subtree="true"',
    'data-selection-overlay="source-identity"',
  ]) {
    requireText(adapterCanvas, required, ADAPTER_CANVAS_SOURCE_PATH, "SUCCESSOR_CANVAS_DRIFT");
  }
  for (const required of [
    "RuntimeReactDiagnosticIndex",
    "AuthoringComponentSelection",
    "AuthoringRenderedIdentitySnapshot",
    "AuthoringSelectionProjection",
    "createAuthoringComponentSelection",
    "isSameAuthoringComponentSelection",
    "projectAuthoringSelection",
    "runtimeNodeIdsBySourceNodeId",
    'status: "not-materialized"',
    'status: "materialized"',
    "Object.freeze",
  ]) {
    requireText(
      authoringSelection,
      required,
      AUTHORING_SELECTION_SOURCE_PATH,
      "SUCCESSOR_SELECTION_DRIFT",
    );
  }
  for (const required of [
    "projects the exact Catalog library and official Source surface trees",
    'reason: "catalog-invalid"',
    'reason: "source-invalid"',
    'reason: "projection-limit"',
    "com.example.ui/Unknown",
    "Object.isFrozen(model)",
    "preserves absent slots",
    "reverse()",
  ]) {
    requireText(authoringTest, required, AUTHORING_TEST_PATH, "TEST_AUTHORITY_DRIFT");
  }
  for (const required of [
    "keeps the exact managed adapter canvas read only",
    "5 of 5 components",
    "Search catalog components",
    'queryByRole("tab")',
    "No Source tree for Recovery",
    "will not substitute the sign-in tree",
    'queryByRole("tree")',
    'querySelector("canvas")',
    "chooses an exact named-slot target and inserts Catalog defaults into Source and preview",
    "uses only the App-owned drag intent and ignores forged native transfer authority",
    "keeps edge scrolling through a no-op gap, re-hit-tests, and fences a stale frame",
    "forgets an admitted gap after the pointer reaches the dragged layer's no-op position",
    "moves nodes across nested slots with keyboard and App-owned native drag intent",
    "Deleted Alert layer · node.alert.",
    "expect(document.activeElement).toBe(deleteTitle)",
    "disables deletion for the surface root and a slot-minimum preflight without changing preview",
    "preserves the selected layer, preview, and focus when deletion is rejected",
    "publish|save|run",
    "removes the managed sign-in tree synchronously",
    'matches(":disabled")',
  ]) {
    requireText(applicationTest, required, APPLICATION_TEST_PATH, "TEST_AUTHORITY_DRIFT");
  }
  for (const required of [
    "creates only a frozen inert route and Source identity",
    "keeps idle and pre-render states explicit without inventing a runtime target",
    "projects repeated component instances while excluding attached behavior identities",
    "reports a conditional Source component honestly when no runtime instance exists",
    "rejects cross-route, cross-surface, and stale-capability identities closed",
    "rejects a forged same-route Source identity instead of treating it as conditional",
  ]) {
    requireText(
      authoringSelectionTest,
      required,
      AUTHORING_SELECTION_TEST_PATH,
      "TEST_AUTHORITY_DRIFT",
    );
  }

  const registrations = {
    "authoring-data.test.ts": countRegistrations(authoringTest),
    "authoring-selection.test.ts": countRegistrations(authoringSelectionTest),
    "application.test.tsx": countRegistrations(applicationTest),
  };
  if (
    registrations["authoring-data.test.ts"] < 5 ||
    registrations["authoring-selection.test.ts"] < 6 ||
    registrations["application.test.tsx"] < 10
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The focused M09-T02 positive/negative test inventory shrank.", {
      registrations,
    });
  }
  const receiptByPath = new Map(receipts(files).map((receipt) => [receipt.path, receipt]));
  return deepFreeze({
    projection: {
      validatorApis: EXPECTED_VALIDATOR_IMPORTS,
      validationOrder: "CATALOG_SET_THEN_SOURCE_INTERACTION_CONTRACTS",
      failurePolicy: "NO_PARTIAL_AUTHORING_MODEL",
      failureReasons: ["catalog-invalid", "source-invalid", "projection-limit"],
      maxSourceTreeDepth: 64,
      maxIdentityOccurrencesPerSurface: 25_000,
      recursivelyFrozenReadModel: true,
    },
    ui: {
      authoringLayout: "PERMANENT_VERTICAL_SPLIT",
      authoringPanes: ["Components", "Layers"],
      splitAuthoringPanesAlwaysRendered: true,
      componentFilter: "LOCAL_READ_MODEL_ONLY",
      layerHierarchySemantics: "AUTHORING_SOURCE_TREE_WITH_PUBLIC_EDITOR_CORE_MUTATIONS",
      unknownSurfacePolicy: "EXPLICIT_NO_SOURCE_TREE_WITHOUT_SUBSTITUTION",
      insertionControls: "CATALOG_ADMITTED_ADD_AND_DEDICATED_DRAG_HANDLE",
      selectionControls: "SOURCE_COMPONENT_TOGGLE_ONLY",
      successorCanvas: {
        task: "M09-T03",
        exactPublicReferenceRegistry: true,
        publisherBackedDraftOrOfficialFallback: true,
        designControlsDisabled: true,
        runControlsInteractiveAgainstSyntheticFixture: true,
        previewFrameEditorChromeRendered: false,
        unknownSurfaceSubstitution: false,
      },
      currentSelectionStatus: {
        task: "M09-T04",
        exactSourceIdentityOnly: true,
        publicDiagnosticIndexOnly: true,
        owner: "LEFT_AUTHORING_PANEL",
        outsideManagedCapabilitySubtree: true,
        previewFrameEditorChromeRendered: false,
        privateDomOrReactInspection: false,
      },
      currentDiagnosticStatus: {
        owner: "RIGHT_INSPECTOR",
        outsideManagedCapabilitySubtree: true,
        previewFrameDiagnosticPlaceholderRendered: false,
      },
      currentDragSession: {
        singlePanelSession: true,
        ownerIdentity: "OWNER_KIND_OWNER_ID_SLOT_JSON_TUPLE",
        epochFencedAnimationFrames: true,
        hitTestConfinedToExactSlotSurface: true,
        releaseDriftRetainsLastAcceptedProjection: true,
        coordinateLessFallbackRequiresSameAcceptedOwner: true,
        reactDomAuthoritySurrendered: true,
        dedicatedComponentDragHandle: true,
        dedicatedLayerDragHandle: true,
        componentPanelWideDropSurface: true,
      },
      successorSchemaInspector: {
        task: "M09-T05",
        controlsDerivedFromCatalogSchema: true,
        publicEditorCoreMutationOnly: true,
        publisherBackedSessionPreview: true,
        inspectorOutsideManagedCapabilitySubtree: true,
      },
    },
    tests: {
      command:
        "pnpm --filter @desen/app-web test:selection && node --test tests/desen-app-catalog-panel-layer-tree.test.mjs",
      registrations,
      positiveAndNegativeCoverage: true,
      failClosedCatalogSourceAndLimitCoverage: true,
      noSubstitutionCoverage: true,
      mutationAndPersistenceAbsenceCoverage: true,
      targetedReceipts: [
        receiptByPath.get(AUTHORING_TEST_PATH),
        {
          path: AUTHORING_SELECTION_TEST_PATH,
          bytes: files.get(AUTHORING_SELECTION_TEST_PATH).byteLength,
          sha256: sha256(files.get(AUTHORING_SELECTION_TEST_PATH)),
        },
        receiptByPath.get(APPLICATION_TEST_PATH),
      ],
    },
  });
}

async function readTrackedFiles(options) {
  const files = new Map();
  for (const relativePath of CURRENT_COMPATIBILITY_PATHS) {
    const override = options.fileOverrides.get(relativePath);
    const live = await readRegularAuthority(
      path.join(options.workspaceRoot, relativePath),
      relativePath,
    );
    if (
      override !== undefined &&
      SELF_RESEALED_PATHS.includes(relativePath) &&
      !isDeepStrictEqual(override, live)
    ) {
      fail("BOUNDARY_DRIFT", `${relativePath} cannot be substituted by a caller.`);
    }
    files.set(relativePath, override ?? live);
  }
  return files;
}

function receipts(files) {
  return TRACKED_PATHS.map((relativePath) => {
    const bytes = files.get(relativePath);
    return deepFreeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
  });
}

async function authenticateFrozenArtifact(workspaceRoot) {
  const artifactBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_PATH),
    "frozen M09-T02 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T02 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T02 proof artifact");
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-catalog-panel-layer-tree" ||
    artifact?.profile !== "desen.app.catalog-panel-layer-tree-proof.v1" ||
    artifact?.task !== "M09-T02" ||
    artifact?.result !== "PASS" ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.shellCompatibilityRetained !== true ||
    artifact?.claim?.catalogDrivenComponentPanelImplemented !== true ||
    artifact?.claim?.catalogDerivedLayerTreeImplemented !== true ||
    artifact?.claim?.realAdapterCanvasImplemented !== false ||
    artifact?.claim?.selectionOrInspectorImplemented !== false ||
    artifact?.claim?.sourceMutationOrHistoryImplemented !== false ||
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
      artifact?.evidence?.rootTestNames,
      DESEN_APP_CATALOG_PANEL_LAYER_TREE_ROOT_TEST_NAMES,
    ) ||
    artifact?.nonclaims?.[0] !==
      "No runtime-react or reference adapter execution and no real canvas."
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T02 artifact identity or retained claim drifted.");
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
      fail("BOUNDARY_DRIFT", `A retained M09-T02 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

function authenticateNamedSlotArtifact(bytes) {
  const pin = NAMED_SLOT_ARTIFACT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T07 named-slot artifact receipt drifted.");
  }
  const artifact = parseJson(bytes, NAMED_SLOT_ARTIFACT_PATH);
  if (
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.completeCatalogDeclaredSlotProjection !== true ||
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
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The M09-T07 named-slot artifact identity or claims drifted.",
    );
  }
  return pin;
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
  const bytes = files.get(FIXTURES_SCENARIOS_ARTIFACT_PATH);
  const pin = FIXTURES_SCENARIOS_ARTIFACT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T11 artifact receipt drifted.");
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
    artifact.claim?.s001Status !== "TESTED" ||
    artifact.claim?.pf028Status !== "CLOSED" ||
    artifact.tests?.focusedTestCases !== 86 ||
    artifact.tests?.testCaseCounts?.[ADAPTER_CANVAS_TEST_PATH] !== 10 ||
    artifact.tests?.testCaseCounts?.[APPLICATION_TEST_PATH] !== 40 ||
    !Array.isArray(trackedReceipts)
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T11 artifact identity or claims drifted.");
  }
  const receiptMap = reviewedSuccessorReceiptMap(trackedReceipts);
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
      fail("SUCCESSOR_POLICY_VIOLATION", `The live M09-T11 receipt drifted: ${relativePath}.`);
    }
  }
  return deepFreeze({
    task: pin.task,
    artifact: pin,
    exactDesignRunParent: true,
    scenariosEphemeral: true,
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
  const receiptMap = reviewedSuccessorReceiptMap(trackedReceipts);
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

/** Authenticates frozen M09-T02 evidence and exact additive M09-T07/T11 successors. */
export async function buildDesenAppCatalogPanelLayerTreeEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const [frozen, files, shellArtifactBytes, referenceArtifactBytes] = await Promise.all([
    authenticateFrozenArtifact(options.workspaceRoot),
    readTrackedFiles(options),
    options.shellArtifactBytes ??
      readRegularAuthority(options.shellArtifactPath, SHELL_ARTIFACT_PATH),
    options.referenceArtifactBytes ??
      readRegularAuthority(options.referenceArtifactPath, REFERENCE_ARTIFACT_PATH),
  ]);
  const prerequisites = [
    authenticateShellArtifact(shellArtifactBytes),
    authenticateReferenceArtifact(referenceArtifactBytes),
  ];
  const catalog = verifyCatalog(files.get(CATALOG_PATH));
  const source = verifySource(files.get(SOURCE_PATH));
  const packageContract = verifyPackage(files.get(APP_PACKAGE_PATH), files.get(ROOT_PACKAGE_PATH));
  const namedSlotArtifact = authenticateNamedSlotArtifact(files.get(NAMED_SLOT_ARTIFACT_PATH));
  const imports = inspectImportsAndExecutionBoundary(files);
  const implementation = verifyImplementationAndTests(files);
  const fixturesScenariosSuccessor = authenticateFixturesScenariosSuccessor(files);
  const sourcePersistenceSuccessor = authenticateSourcePersistenceSuccessor(files);
  const nodeLinkedDiagnosticsSuccessor = authenticateNodeLinkedDiagnosticsSuccessor(files);
  const publishActivationSuccessor = authenticatePublishActivationSuccessor(files);
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  if (options.fileOverrides.size !== 0) {
    fail("BOUNDARY_DRIFT", "Mutation overrides cannot issue current compatibility evidence.");
  }
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-catalog-panel-layer-tree",
    profile: "desen.app.catalog-panel-layer-tree-proof.v1",
    task: "M09-T02",
    result: "PASS",
    prerequisites,
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      shellCompatibilityRetained: frozen.artifact.claim.shellCompatibilityRetained,
      exactCatalogResolved: frozen.artifact.claim.exactCatalogResolved,
      catalogDrivenComponentPanelImplemented:
        frozen.artifact.claim.catalogDrivenComponentPanelImplemented,
      catalogDerivedLayerTreeImplemented: frozen.artifact.claim.catalogDerivedLayerTreeImplemented,
      cumulativeCatalogAndSourceValidationRequired:
        frozen.artifact.claim.cumulativeCatalogAndSourceValidationRequired,
      componentFilterMutatesSource: frozen.artifact.claim.componentFilterMutatesSource,
      unknownSurfaceSubstitutesSource: frozen.artifact.claim.unknownSurfaceSubstitutesSource,
    },
    authority: { catalog, source },
    application: {
      package: packageContract,
      projection: implementation.projection,
      ui: implementation.ui,
    },
    boundary: {
      imports,
      retainedHistoricalReceipts: RETAINED_HISTORICAL_PATHS.length,
      successorCompatibilityPaths: SUCCESSOR_COMPATIBILITY_PATHS.length,
      t11SuccessorReceipts: T11_LIVE_RECEIPT_PATHS.map((relativePath) => ({
        path: relativePath,
        bytes: files.get(relativePath).byteLength,
        sha256: sha256(files.get(relativePath)),
      })),
    },
    successor: {
      task: "M09-T07",
      artifact: namedSlotArtifact,
      realAdapterCanvasOwnedBySuccessor: true,
      historicalNoCanvasNonclaimAppliedToCurrentApp: false,
      exactPublicRuntimeAdapterPathAllowed: true,
      sourceIdentitySelectionStatusRehomedToAuthoringPanel: true,
      diagnosticStatusRehomedToRightInspector: true,
      previewFrameEditorChromeRendered: false,
      historicalNoSelectionNonclaimAppliedToCurrentApp: false,
      schemaDerivedPrimitiveAndEnumInspectorImplemented: true,
      publicEditorCorePropMutationImplemented: true,
      publisherBackedSessionPreviewImplemented: true,
      historicalNoInspectorOrSourceMutationNonclaimAppliedToCurrentApp: false,
      nestedObjectAndStructuredJsonEditingImplemented: true,
      completeNamedSlotProjectionImplemented: true,
      catalogAdmissionAndCardinalityPreflightImplemented: true,
      publicStableIdInsertMoveAndReorderImplemented: true,
      publicValidatedNodeDeletionImplemented: true,
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
      exactSlotSelectionAndEditCaptureImplemented: true,
      atomicPublisherBackedSlotEditsImplemented: true,
      dynamicEditingImplemented: false,
      currentPersistenceUiImplemented: true,
      currentDesignRunImplemented: true,
      currentPublishActivationImplemented: true,
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

function verifyProofDocument(proofDocument, artifactSha256) {
  const text = decodeUtf8(proofDocument, PROOF_DOCUMENT_PATH);
  if (
    exactTextCount(text, ARTIFACT_PATH) < 1 ||
    exactTextCount(text, `sha256:${artifactSha256}`) !== 1 ||
    exactTextCount(text, "[PENDING_FINAL_ARTIFACT_SHA256]") !== 0 ||
    exactTextCount(text, "M09-T02") < 1 ||
    !/(?:Status:\s*`?DONE`?|M09-T02\s*\|\s*DONE)/u.test(text)
  ) {
    fail("PROOF_PIN_DRIFT", "The visible M09-T02 proof path, digest, or DONE association drifted.");
  }
}

/** Verifies committed M09-T02 artifact bytes and their visible proof-document association. */
export async function verifyDesenAppCatalogPanelLayerTreeEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppCatalogPanelLayerTreeEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_CATALOG_PANEL_LAYER_TREE_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T02 artifact bytes differ from fresh evidence.");
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
    catalogComponents: built.artifact.authority.catalog.componentCount,
    sourceSurfaces: built.artifact.authority.source.surfaceCount,
    sourceNodes: built.artifact.authority.source.componentNodeCount,
    trackedFiles: built.artifact.boundary.trackedFiles,
  });
}

/** Atomically writes exact deterministic M09-T02 evidence. */
export async function writeDesenAppCatalogPanelLayerTreeEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_CATALOG_PANEL_LAYER_TREE_ARTIFACT_PATH,
  );
  const built = await buildDesenAppCatalogPanelLayerTreeEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T02 artifact write failed safely.", {
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
