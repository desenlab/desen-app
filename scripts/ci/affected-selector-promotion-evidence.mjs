import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { validateAffectedChangeBoundaryReceipt } from "./affected-change-boundary.mjs";
import {
  EXPECTED_AFFECTED_IMPACT_GRAPH_SHA256,
  createAffectedImpactClosure,
} from "./affected-impact-graph.mjs";
import { EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256 } from "./affected-observation-threshold.mjs";
import {
  AFFECTED_OWNERSHIP_CATEGORIES,
  AFFECTED_OWNERSHIP_DISPOSITIONS,
  EXPECTED_AFFECTED_PROOF_OWNED_PATH_COUNT,
  EXPECTED_AFFECTED_TRACKED_PATH_COUNT,
  EXPECTED_AFFECTED_TRACKED_PATH_SET_SHA256,
  EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256,
  calculateAffectedWorkloadOwnershipReview,
  createAffectedWorkloadOwnership,
} from "./affected-workload-ownership.mjs";
import {
  EXPECTED_SHADOW_AFFECTED_SELECTOR_SHA256,
  SHADOW_AFFECTED_COMPARISON_AUTHORITY_PATHS,
} from "./affected-workload-selector.mjs";
import {
  EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
  createExhaustiveWorkloadInventory,
} from "./exhaustive-workload-inventory.mjs";
import { verifyProofReaderCheckpoints } from "./proof-reader-checkpoints.mjs";
import { classifyProofPairState } from "./shared-state-authority.mjs";

export const AFFECTED_SELECTOR_PROMOTION_EVIDENCE_PROFILE =
  "desen.ci.affected-selector-promotion-evidence.v1";
export const AFFECTED_SELECTOR_PROMOTION_EVIDENCE_PATH =
  "docs/proof/baselines/i07-04-affected-selector-promotion.json";
const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../..");
const MAX_EVIDENCE_BYTES = 512 * 1024;
const MAX_SELECTOR_SOURCE_BYTES = 512 * 1024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const DIRECTORY_READ_FLAGS = READ_FLAGS | (fileConstants.O_DIRECTORY ?? 0);
const SHA256 = /^[0-9a-f]{64}$/u;
const REVISION = /^[0-9a-f]{40}$/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const EXPECTED_REPOSITORY = "desenlab/desen-app";
const EXPECTED_BASE_REVISION = "cba1dc6e7c0a2a3a54ccd3442870e63959f533b8";
const EXPECTED_THRESHOLD_SHA256 =
  "ca6ee4128f2dbc581d033ebabe8e437268c8f7c5b29d6fbc7f9e3fb031b6c23c";
const EXPECTED_CONTROLLER_STATE_SHA256 =
  "704482efcb318328a0890c33035583b5c8a1376ecb948a0c138303f56fe1deb8";
const EXPECTED_CONTROLLER_STATE_BYTES = 1_899_020;
const EXPECTED_CONTROLLER_SHA256 =
  "c533db85699cdd0fb5368caab549a6969cc7bcbe9718c063bbe132c243b44be9";
const EXPECTED_CONTROLLER_TEST_SHA256 =
  "499a74d6595de67b405602f23de0eae2105be31c2940dba1e4b35d766d9f9360";
const EXPECTED_LAUNCHER_SHA256 = "9faa7943792f0eccb69cbffe1d526056904291db151887f37e9f1ae47677ef12";
const EXPECTED_LAUNCHER_TEST_SHA256 =
  "199488f039a353331637d04444c96e053db7e78bb474a1d8df7442cd9f40968a";
const EXPECTED_RESERVATIONS_SHA256 =
  "a3f00054c0f030730b54643be8ef0a05e09ed23395e1e6fc09d87388265c4122";
const EXPECTED_HISTORICAL_CAMPAIGN_SHA256 =
  "5bfcea8ceff0019d1c189fa3a77a27cfb3e84c6793e878d7bf07b6d695ee634f";
const MEASURED_SELECTOR_SOURCE_SHA256 =
  "50195f49b42afbc2df126b4e733caf6598b713213adb5ffdb5a7f3d86124d2e9";
const MEASURED_RUNNER_PATH = "scripts/ci/run-shadow-affected-quality-gate.mjs";
const PROMOTED_RUNNER_PATH = "scripts/ci/run-required-affected-quality-gate.mjs";
const SELECTOR_SOURCE_PATH = "scripts/ci/affected-workload-selector.mjs";
const COMPARISON_AUTHORITY_PROFILE = "desen.ci.shadow-affected-comparison-authority.v1";
const SELECTION_EQUIVALENCE_PROFILE = "desen.ci.affected-selection-equivalence.v1";
const RUNNER_AUTHORITY_PROFILE = "desen.ci.required-affected-runner-authority.v1";
const MEASURED_COMPARISON_AUTHORITY_SHA256 =
  "59803fe195a0c99927f468ea6b2cab28afe0e4c058915005351825c3f5a51098";
const HISTORICAL_COMPARISON_SOURCES = Object.freeze(
  [
    [
      ".github/workflows/ci.yml",
      7918,
      "0c41ddc296b5d7606a5b6bbc9e3637b72c31d3d7b68cab11c6ba9174827468cc",
    ],
    [".node-version", 8, "204f09a46271f9788396f90cb21ea2897cafe7ecf49832b6d0e49bd3bc38000b"],
    ["package.json", 68073, "110ffffddf7677f6a578c44a0fba31fa15cc7bf08c8b66224cb0ef47e49b4d2b"],
    ["pnpm-lock.yaml", 126895, "060032f72e765663574f97d8cc2d82b97fc5758343025ba8005f132ab4075b2d"],
    [
      "pnpm-workspace.yaml",
      816,
      "6c693fc7e2b55dfc4b2e84a9e267aef0b6aeecb3160a04cdba67ce570f860be9",
    ],
    ["turbo.json", 4262, "2c77af7bd2277b422cbe1556f76c21834a1c62f4327d188b4bdf6fd449f84846"],
    [
      "dependency-cruiser.config.cjs",
      8599,
      "ce438849b71e483acab2952925a77f6dad8e0943a07619bf6c2721bf07be36bf",
    ],
    [
      "scripts/ci/affected-change-boundary.mjs",
      23904,
      "869c16ce7213a430223faece5c7f1b0c0a1409e4ecaaffc9fcaea5b2b452bb18",
    ],
    [
      "scripts/ci/affected-impact-graph.mjs",
      14515,
      "fdd416a6eff79c09c00def4fbc265faa792fe27fd62ab6c86f36c1f9d0d5461e",
    ],
    [
      "scripts/ci/affected-observation-threshold.json",
      1957,
      "86746034bfd70bda9567c657886bb226b3785f02cf59469880a585a06c8b15fd",
    ],
    [
      "scripts/ci/affected-observation-threshold.mjs",
      25439,
      "c704879a134a33578d5dc7207007b0d6e0c945f39b3a8bcc9c56e9dbab86fc8e",
    ],
    [
      "scripts/ci/affected-workload-ownership.mjs",
      26281,
      "db69054f74e32359cb40356378ae06f40203ee3fb9609e868b0534344371e167",
    ],
    [
      "scripts/ci/affected-workload-selector.mjs",
      25813,
      "50195f49b42afbc2df126b4e733caf6598b713213adb5ffdb5a7f3d86124d2e9",
    ],
    [
      "scripts/ci/exhaustive-gate-boundary.mjs",
      31966,
      "31e4e7b9791346d66a959ea071f91fda0692224f62a62dd3ef5942cbaeda7cfe",
    ],
    [
      "scripts/ci/exhaustive-workload-inventory.mjs",
      46705,
      "c290e7fbcf0adf9d56efa039209e140fb56e31a7a8e2b84e90b2e73330031805",
    ],
    [
      "scripts/ci/no-proof-listener.cjs",
      18717,
      "097c06f2c3b9222774db107a08c19ca1289d68bdcc5a9f52cc0977106a4ec082",
    ],
    [
      "scripts/ci/proof-filesystem-compatibility.cjs",
      27055,
      "0d7c8282468249525ebbc7c9b0fe302a65b58333e0f50fef66e6a6b150bf8d58",
    ],
    [
      "scripts/ci/run-required-exhaustive-quality-gate.mjs",
      73906,
      "5496f05175244251003a3943905fdcf90cb6819724568399e1763f289091b50b",
    ],
    [
      MEASURED_RUNNER_PATH,
      20821,
      "5349fd981369a8b46370d80b1ad820f49dcc08a85770e029058858d7e756e0b8",
    ],
    [
      "scripts/ci/shared-state-authority.mjs",
      51643,
      "4f17d0d68f742a6c56fc10e39dd1f47f0111ed03b0e2d45a5d75b5f07b804820",
    ],
  ].map(([sourcePath, byteLength, byteSha256]) =>
    Object.freeze({ path: sourcePath, mode: "100644", byteLength, byteSha256 }),
  ),
);
const UNCHANGED_SELECTION_SOURCE_PATHS = Object.freeze([
  "scripts/ci/affected-change-boundary.mjs",
  "scripts/ci/affected-impact-graph.mjs",
  "scripts/ci/affected-observation-threshold.json",
  "scripts/ci/affected-observation-threshold.mjs",
  "scripts/ci/exhaustive-gate-boundary.mjs",
]);
const CHANGED_COMPARISON_SOURCE_PATHS = Object.freeze([
  ".github/workflows/ci.yml",
  "package.json",
  "scripts/ci/affected-selector-promotion-evidence.mjs",
  "scripts/ci/affected-workload-ownership.mjs",
  "scripts/ci/affected-workload-selector.mjs",
  "scripts/ci/exhaustive-workload-inventory.mjs",
  "scripts/ci/run-required-affected-quality-gate.mjs",
  "scripts/ci/run-shadow-affected-quality-gate.mjs",
]);
const PROMOTION_ADDED_TRACKED_PATHS = Object.freeze([
  "docs/proof/baselines/i07-04-affected-selector-promotion.json",
  "scripts/ci/affected-selector-promotion-evidence.mjs",
  "scripts/ci/run-required-affected-quality-gate.mjs",
  "scripts/ci/test/affected-selector-promotion-evidence.test.mjs",
  "scripts/ci/test/required-affected-quality-gate.test.mjs",
  "scripts/ci/verify-affected-selector-promotion-evidence.mjs",
]);
const PROMOTION_REMOVED_TRACKED_PATHS = Object.freeze([
  "scripts/ci/run-shadow-affected-quality-gate.mjs",
  "scripts/ci/test/shadow-affected-quality-gate.test.mjs",
]);
const CURRENT_SUCCESSOR_ADDED_TRACKED_PATHS = Object.freeze([
  "docs/proof/EDITOR-CORE-SOURCE-DOCUMENT.md",
  "docs/proof/artifacts/editor-core-0.1.0-source-document.json",
  "packages/editor-core/src/source-document.ts",
  "packages/editor-core/test/public-package.mjs",
  "packages/editor-core/test/public-package.types.mts",
  "packages/editor-core/test/source-document.test.ts",
  "packages/editor-core/test/source-document.types.ts",
  "packages/editor-core/tsconfig.public-package.json",
  "scripts/generate-editor-core-source-document-proof.mjs",
  "scripts/lib/editor-core-source-document-proof.mjs",
  "scripts/verify-editor-core-source-document.mjs",
  "tests/editor-core-source-document.test.mjs",
  "docs/proof/EDITOR-CORE-STABLE-ID-INSERT.md",
  "docs/proof/artifacts/editor-core-0.1.0-stable-id-insert.json",
  "packages/editor-core/src/stable-id-insert.ts",
  "packages/editor-core/test/stable-id-insert.test.ts",
  "packages/editor-core/test/stable-id-insert.types.ts",
  "scripts/generate-editor-core-stable-id-insert-proof.mjs",
  "scripts/lib/editor-core-stable-id-insert-proof.mjs",
  "scripts/verify-editor-core-stable-id-insert.mjs",
  "tests/editor-core-stable-id-insert.test.mjs",
  "docs/proof/EDITOR-CORE-STRUCTURAL-EDITS.md",
  "docs/proof/artifacts/editor-core-0.1.0-structural-edits.json",
  "packages/editor-core/src/structural-edits.ts",
  "packages/editor-core/test/structural-edits.test.ts",
  "packages/editor-core/test/structural-edits.types.ts",
  "scripts/generate-editor-core-structural-edits-proof.mjs",
  "scripts/lib/editor-core-structural-edits-proof.mjs",
  "scripts/verify-editor-core-structural-edits.mjs",
  "tests/editor-core-structural-edits.test.mjs",
  "docs/proof/EDITOR-CORE-CONTENT-EDITS.md",
  "docs/proof/artifacts/editor-core-0.1.0-content-edits.json",
  "packages/editor-core/src/content-edits.ts",
  "packages/editor-core/test/content-edits.test.ts",
  "packages/editor-core/test/content-edits.types.ts",
  "scripts/generate-editor-core-content-edits-proof.mjs",
  "scripts/lib/editor-core-content-edits-proof.mjs",
  "scripts/verify-editor-core-content-edits.mjs",
  "tests/editor-core-content-edits.test.mjs",
  "docs/proof/EDITOR-CORE-STATE-BINDING-EDITS.md",
  "docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json",
  "packages/editor-core/src/state-binding-edits.ts",
  "packages/editor-core/test/state-binding-edits.test.ts",
  "packages/editor-core/test/state-binding-edits.types.ts",
  "scripts/generate-editor-core-state-binding-edits-proof.mjs",
  "scripts/lib/editor-core-state-binding-edits-proof.mjs",
  "scripts/verify-editor-core-state-binding-edits.mjs",
  "tests/editor-core-state-binding-edits.test.mjs",
  "docs/proof/EDITOR-CORE-EVENT-ACTION-EDITS.md",
  "docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json",
  "packages/editor-core/src/event-action-edits.ts",
  "packages/editor-core/test/event-action-edits.test.ts",
  "packages/editor-core/test/event-action-edits.types.ts",
  "scripts/generate-editor-core-event-action-edits-proof.mjs",
  "scripts/lib/editor-core-event-action-edits-proof.mjs",
  "scripts/verify-editor-core-event-action-edits.mjs",
  "tests/editor-core-event-action-edits.test.mjs",
  "docs/proof/EDITOR-CORE-AUTHORING-ROUND-TRIP.md",
  "docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json",
  "packages/editor-core/test/authoring-round-trip.test.ts",
  "packages/editor-core/test/authoring-round-trip.types.ts",
  "scripts/generate-editor-core-authoring-round-trip-proof.mjs",
  "scripts/lib/editor-core-authoring-round-trip-proof.mjs",
  "scripts/verify-editor-core-authoring-round-trip.mjs",
  "tests/editor-core-authoring-round-trip.test.mjs",
  "docs/proof/EDITOR-CORE-PERSISTENCE.md",
  "docs/proof/artifacts/editor-core-0.1.0-persistence.json",
  "packages/editor-core/src/persistence.ts",
  "packages/editor-core/test/persistence.test.ts",
  "packages/editor-core/test/persistence.types.ts",
  "packages/editor-web/src/local-source-json.ts",
  "packages/editor-web/src/local-source-persistence.ts",
  "packages/editor-web/test/local-source-persistence.test.ts",
  "packages/editor-web/test/public-package.mjs",
  "packages/editor-web/test/public-package.types.mts",
  "packages/editor-web/tsconfig.public-package.json",
  "scripts/generate-editor-core-persistence-proof.mjs",
  "scripts/lib/editor-core-persistence-proof.mjs",
  "scripts/verify-editor-core-persistence.mjs",
  "tests/editor-core-persistence.test.mjs",
  "docs/proof/EDITOR-CORE-CONTINUOUS-VALIDATION.md",
  "docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json",
  "packages/editor-core/src/continuous-validation.ts",
  "packages/editor-core/test/continuous-validation.test.ts",
  "packages/editor-core/test/continuous-validation.types.ts",
  "scripts/generate-editor-core-continuous-validation-proof.mjs",
  "scripts/lib/editor-core-continuous-validation-proof.mjs",
  "scripts/verify-editor-core-continuous-validation.mjs",
  "tests/editor-core-continuous-validation.test.mjs",
  "docs/proof/EDITOR-CORE-TERMINAL-INTEGRATION.md",
  "docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json",
  "packages/editor-core/test/terminal-integration.test.ts",
  "scripts/generate-editor-core-terminal-integration-proof.mjs",
  "scripts/lib/editor-core-terminal-integration-proof.mjs",
  "scripts/verify-editor-core-terminal-integration.mjs",
  "tests/editor-core-terminal-integration.test.mjs",
  "apps/desen-app/index.html",
  "apps/desen-app/src/assets/breadcrumb-separator.svg",
  "apps/desen-app/src/assets/desen-logo.svg",
  "apps/desen-app/src/assets/plus.svg",
  "apps/desen-app/src/assets/settings.svg",
  "apps/desen-app/src/assets/theme.svg",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/main.tsx",
  "apps/desen-app/src/project-data.ts",
  "apps/desen-app/src/project-navigation.ts",
  "apps/desen-app/src/styles.css",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/main-lifecycle.test.tsx",
  "apps/desen-app/test/project-navigation.test.ts",
  "docs/proof/DESEN-APP-SHELL-NAVIGATION.md",
  "docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json",
  "scripts/generate-desen-app-shell-navigation-proof.mjs",
  "scripts/lib/desen-app-shell-navigation-proof.mjs",
  "scripts/verify-desen-app-shell-navigation.mjs",
  "tests/desen-app-shell-navigation.test.mjs",
  "apps/desen-app/src/authoring-data.ts",
  "apps/desen-app/test/authoring-data.test.ts",
  "docs/proof/DESEN-APP-CATALOG-PANEL-LAYER-TREE.md",
  "docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json",
  "scripts/generate-desen-app-catalog-panel-layer-tree-proof.mjs",
  "scripts/lib/desen-app-catalog-panel-layer-tree-proof.mjs",
  "scripts/verify-desen-app-catalog-panel-layer-tree.mjs",
  "tests/desen-app-catalog-panel-layer-tree.test.mjs",
  "apps/desen-app/src/adapter-canvas.tsx",
  "apps/desen-app/test/adapter-canvas.test.tsx",
  "docs/proof/DESEN-APP-REAL-ADAPTER-CANVAS.md",
  "docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json",
  "scripts/generate-desen-app-real-adapter-canvas-proof.mjs",
  "scripts/lib/desen-app-real-adapter-canvas-proof.mjs",
  "scripts/verify-desen-app-real-adapter-canvas.mjs",
  "tests/desen-app-real-adapter-canvas.test.mjs",
  "apps/desen-app/src/authoring-selection.ts",
  "apps/desen-app/test/authoring-selection.test.ts",
  "docs/proof/DESEN-APP-SELECTION-OVERLAY.md",
  "docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json",
  "scripts/generate-desen-app-selection-overlay-proof.mjs",
  "scripts/lib/desen-app-selection-overlay-proof.mjs",
  "scripts/verify-desen-app-selection-overlay.mjs",
  "tests/desen-app-selection-overlay.test.mjs",
  "apps/desen-app/src/authoring-inspector.ts",
  "apps/desen-app/src/authoring-preview.ts",
  "apps/desen-app/src/inspector-panel.tsx",
  "apps/desen-app/test/authoring-inspector.test.ts",
  "apps/desen-app/test/authoring-preview.test.ts",
  "docs/proof/DESEN-APP-SCHEMA-INSPECTOR.md",
  "docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json",
  "scripts/generate-desen-app-schema-inspector-proof.mjs",
  "scripts/lib/desen-app-schema-inspector-proof.mjs",
  "scripts/verify-desen-app-schema-inspector.mjs",
  "tests/desen-app-schema-inspector.test.mjs",
  "apps/desen-app/src/structured-json.ts",
  "apps/desen-app/test/inspector-panel.test.tsx",
  "apps/desen-app/test/structured-json.test.ts",
  "docs/proof/DESEN-APP-STRUCTURED-INSPECTOR.md",
  "docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json",
  "scripts/generate-desen-app-structured-inspector-proof.mjs",
  "scripts/lib/desen-app-structured-inspector-proof.mjs",
  "scripts/verify-desen-app-structured-inspector.mjs",
  "tests/desen-app-structured-inspector.test.mjs",
  "apps/desen-app/src/authoring-slots.ts",
  "apps/desen-app/test/authoring-slots.test.ts",
  "docs/proof/DESEN-APP-NAMED-SLOT-AUTHORING.md",
  "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json",
  "scripts/generate-desen-app-named-slot-authoring-proof.mjs",
  "scripts/lib/desen-app-named-slot-authoring-proof.mjs",
  "scripts/verify-desen-app-named-slot-authoring.mjs",
  "tests/desen-app-named-slot-authoring.test.mjs",
  "apps/desen-app/src/authoring-state.ts",
  "apps/desen-app/src/state-panel.tsx",
  "apps/desen-app/test/authoring-state.test.ts",
  "apps/desen-app/test/state-panel.test.tsx",
  "docs/proof/DESEN-APP-STATE-BINDING-EDITOR.md",
  "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json",
  "scripts/generate-desen-app-state-binding-editor-proof.mjs",
  "scripts/lib/desen-app-state-binding-editor-proof.mjs",
  "scripts/verify-desen-app-state-binding-editor.mjs",
  "tests/desen-app-state-binding-editor.test.mjs",
  "apps/desen-app/src/authoring-event-actions.ts",
  "apps/desen-app/src/event-action-panel.tsx",
  "apps/desen-app/test/authoring-event-actions.test.ts",
  "apps/desen-app/test/event-action-panel.test.tsx",
  "docs/proof/DESEN-APP-EVENT-ACTION-EDITOR.md",
  "docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json",
  "scripts/generate-desen-app-event-action-editor-proof.mjs",
  "scripts/lib/desen-app-event-action-editor-proof.mjs",
  "scripts/verify-desen-app-event-action-editor.mjs",
  "tests/desen-app-event-action-editor.test.mjs",
  "docs/proof/DESEN-APP-DESIGN-RUN-MODES.md",
  "docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json",
  "scripts/generate-desen-app-design-run-modes-proof.mjs",
  "scripts/lib/desen-app-design-run-modes-proof.mjs",
  "scripts/verify-desen-app-design-run-modes.mjs",
  "tests/desen-app-design-run-modes.test.mjs",
  "apps/desen-app/src/authoring-fixtures.ts",
  "apps/desen-app/src/authoring-scenarios.ts",
  "apps/desen-app/src/preview-controls.tsx",
  "apps/desen-app/src/preview-fidelity.ts",
  "apps/desen-app/test/authoring-fixtures.test.ts",
  "apps/desen-app/test/authoring-scenarios.test.ts",
  "apps/desen-app/test/preview-controls.test.tsx",
  "apps/desen-app/test/preview-fidelity.test.ts",
  "docs/proof/DESEN-APP-FIXTURES-SCENARIOS-FIDELITY.md",
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json",
  "scripts/generate-desen-app-fixtures-scenarios-fidelity-proof.mjs",
  "scripts/lib/desen-app-fixtures-scenarios-fidelity-proof.mjs",
  "scripts/verify-desen-app-fixtures-scenarios-fidelity.mjs",
  "tests/desen-app-fixtures-scenarios-fidelity.test.mjs",
  "apps/desen-app/src/authoring-persistence.ts",
  "apps/desen-app/src/persistence-controls.tsx",
  "apps/desen-app/test/authoring-persistence.test.ts",
  "apps/desen-app/test/persistence-application.test.tsx",
  "apps/desen-app/test/persistence-controls.test.tsx",
  "docs/proof/DESEN-APP-SOURCE-PERSISTENCE.md",
  "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json",
  "scripts/generate-desen-app-source-persistence-proof.mjs",
  "scripts/lib/desen-app-source-persistence-proof.mjs",
  "scripts/verify-desen-app-source-persistence.mjs",
  "tests/desen-app-source-persistence.test.mjs",
  "apps/desen-app/src/authoring-diagnostics.ts",
  "apps/desen-app/src/diagnostics-panel.tsx",
  "apps/desen-app/test/authoring-diagnostics.test.ts",
  "apps/desen-app/test/diagnostics-panel.test.tsx",
  "docs/proof/DESEN-APP-NODE-LINKED-DIAGNOSTICS.md",
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json",
  "scripts/generate-desen-app-node-linked-diagnostics-proof.mjs",
  "scripts/lib/desen-app-node-linked-diagnostics-proof.mjs",
  "scripts/verify-desen-app-node-linked-diagnostics.mjs",
  "tests/desen-app-node-linked-diagnostics.test.mjs",
]);
const I07_04_PROMOTED_AUTHORITIES = Object.freeze({
  selectorSha256: "8b1a3e2751247660b6599459c54c2550cac280faa030ca239df6493883fc076e",
  ownershipSha256: "8a9904c93964f6b5e979bb1369e58bb84abaa110137e47b9b839222d8e82d7d8",
  impactGraphSha256: "47ef701b607f618e48692b33c99e0231705c1bccfdc8c3ff608587fee8e62940",
  thresholdSha256: "ca6ee4128f2dbc581d033ebabe8e437268c8f7c5b29d6fbc7f9e3fb031b6c23c",
  inventorySha256: "e0259cb3288fbaec7faccabf2186ecf1c921de29d5187de7e88f80a85b3abdb4",
});
const HISTORICAL_OWNERSHIP_REVIEW = Object.freeze({
  trackedPathCount: 1019,
  trackedPathSetSha256: "d752922fa22db81f3f76fc93d4562a17b65589e614f3281844287aa8d6656679",
  proofOwnedPathCount: 142,
  categoryCounts: Object.freeze({
    PROOF_UNIT: 142,
    CI_POLICY: 42,
    DEPENDENCY_POLICY: 31,
    FROZEN_INPUT: 114,
    PACKAGE_OR_APPLICATION: 393,
    SHARED_PROOF_INFRASTRUCTURE: 179,
    PROJECT_DOCUMENTATION: 107,
    REPOSITORY_POLICY: 11,
  }),
  ownershipSha256: "729b84436be134709db7bf8793e232bee4dab4a27efcb61e61cd0afeaed83ee8",
});
const PROMOTED_OWNERSHIP_REVIEW = Object.freeze({
  trackedPathCount: 1023,
  trackedPathSetSha256: "65fe59b176e8f0a7bbaef8fdd1b3c13d09057fff3a3019fd445bce9e9fb801c4",
  proofOwnedPathCount: 142,
  categoryCounts: Object.freeze({
    PROOF_UNIT: 142,
    CI_POLICY: 45,
    DEPENDENCY_POLICY: 31,
    FROZEN_INPUT: 115,
    PACKAGE_OR_APPLICATION: 393,
    SHARED_PROOF_INFRASTRUCTURE: 179,
    PROJECT_DOCUMENTATION: 107,
    REPOSITORY_POLICY: 11,
  }),
  ownershipSha256: I07_04_PROMOTED_AUTHORITIES.ownershipSha256,
});
const CURRENT_SUCCESSOR_OWNERSHIP_REVIEW = Object.freeze({
  trackedPathCount: EXPECTED_AFFECTED_TRACKED_PATH_COUNT,
  trackedPathSetSha256: EXPECTED_AFFECTED_TRACKED_PATH_SET_SHA256,
  proofOwnedPathCount: EXPECTED_AFFECTED_PROOF_OWNED_PATH_COUNT,
  categoryCounts: Object.freeze({
    PROOF_UNIT: 188,
    CI_POLICY: 45,
    DEPENDENCY_POLICY: 31,
    FROZEN_INPUT: 138,
    PACKAGE_OR_APPLICATION: 485,
    SHARED_PROOF_INFRASTRUCTURE: 225,
    PROJECT_DOCUMENTATION: 130,
    REPOSITORY_POLICY: 11,
  }),
  ownershipSha256: EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256,
});
const VERIFIED_PROMOTION_RECEIPTS = new WeakMap();
const VERIFIED_PROMOTION_BOUNDARIES = new WeakMap();
const PROMOTION_BOUNDARY_AUTHORITIES = Object.freeze({
  AFFECTED: "AFFECTED",
  EXHAUSTIVE_FALLBACK: "EXHAUSTIVE_FALLBACK",
});
const ROOT_KEYS = Object.freeze([
  "schemaVersion",
  "profile",
  "task",
  "date",
  "repository",
  "campaign",
  "authorities",
  "promotedAuthorities",
  "selectionSemanticsEquivalence",
  "runnerAuthority",
  "threshold",
  "controller",
  "historicalCampaignSha256",
  "observations",
  "decision",
  "cutover",
  "nonClaims",
]);
const CAMPAIGN_KEYS = Object.freeze([
  "frozenBaseRevision",
  "startedAt",
  "completedAt",
  "lanes",
  "pullRequests",
  "comparisonOrder",
]);
const AUTHORITY_KEYS = Object.freeze([
  "selectorSha256",
  "ownershipSha256",
  "impactGraphSha256",
  "thresholdSha256",
  "inventorySha256",
  "requiredPlanSha256",
  "requiredInventorySha256",
]);
const PROMOTED_AUTHORITY_KEYS = Object.freeze([
  "selectorSha256",
  "ownershipSha256",
  "impactGraphSha256",
  "thresholdSha256",
  "inventorySha256",
  "selectionEquivalenceSha256",
  "runnerAuthoritySha256",
]);
const SELECTION_EQUIVALENCE_KEYS = Object.freeze([
  "profile",
  "result",
  "measuredComparisonAuthoritySha256",
  "promotedComparisonAuthoritySha256",
  "measuredSources",
  "promotedSources",
  "unchangedSelectionSourcePaths",
  "changedComparisonSourcePaths",
  "ownershipDelta",
  "inventoryGraph",
  "selectorPatchCount",
  "equivalenceSha256",
]);
const SOURCE_RECEIPT_KEYS = Object.freeze(["path", "mode", "byteLength", "byteSha256"]);
const OWNERSHIP_DELTA_KEYS = Object.freeze([
  "historicalTrackedPathCount",
  "historicalTrackedPathSetSha256",
  "historicalOwnershipSha256",
  "promotedTrackedPathCount",
  "promotedTrackedPathSetSha256",
  "promotedOwnershipSha256",
  "netExpansion",
  "commonPathCount",
  "selectedProofOwnerDelta",
  "ciPolicyDelta",
  "frozenInputDelta",
  "addedPaths",
  "removedPaths",
  "addedPathAuthorities",
]);
const INVENTORY_GRAPH_KEYS = Object.freeze(["inventorySha256", "workloadCount", "proofUnitCount"]);
const ADDED_PATH_AUTHORITY_KEYS = Object.freeze(["path", "category", "disposition"]);
const RUNNER_AUTHORITY_KEYS = Object.freeze([
  "profile",
  "result",
  "sources",
  "workflowContract",
  "packageContract",
  "dispatcherContract",
  "authoritySha256",
]);
const RUNNER_WORKFLOW_CONTRACT = Object.freeze({
  eligibleSameRepositoryPullRequest: "REQUIRED_AFFECTED",
  untrustedOrUnknownPullRequest: "REQUIRED_EXHAUSTIVE",
  pushMainReleaseAndManual: "REQUIRED_EXHAUSTIVE",
  requiredRunnerCommand: "node scripts/ci/run-required-affected-quality-gate.mjs",
  processTimeout: "18m_TERM_30s_KILL",
  shadowCommandAllowed: false,
});
const RUNNER_PACKAGE_CONTRACT = Object.freeze({
  script: "ci:required",
  command: "node scripts/ci/run-required-affected-quality-gate.mjs",
  legacyRollbackRetained: true,
});
const RUNNER_DISPATCHER_CONTRACT = Object.freeze({
  requiredIdentityIsModulePrivate: true,
  injectedExecutionSeamsRemainTestAuthority: true,
  selectionNeverAuthorizesPassWithoutFreshExecution: true,
  ownershipOrPathSetDriftFallsBackExactlyOnce: true,
  unknownUnsafeAndIneligibleInputsFallBackExactlyOnce: true,
  closingGuardsAreTerminal: true,
  cancellationExitCodes: Object.freeze([130, 143]),
  softDeadlineMilliseconds: 17 * 60 * 1_000,
});
const RUNNER_SOURCE_PATHS = Object.freeze([
  ".github/workflows/ci.yml",
  "package.json",
  "scripts/ci/affected-selector-promotion-evidence.mjs",
  "scripts/ci/run-required-exhaustive-quality-gate.mjs",
  "scripts/ci/run-required-affected-quality-gate.mjs",
]);
const EXPECTED_ADDED_PATH_AUTHORITIES = Object.freeze([
  Object.freeze({
    path: PROMOTION_ADDED_TRACKED_PATHS[0],
    category: AFFECTED_OWNERSHIP_CATEGORIES.FROZEN_INPUT,
    disposition: AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE,
  }),
  ...PROMOTION_ADDED_TRACKED_PATHS.slice(1).map((trackedPath) =>
    Object.freeze({
      path: trackedPath,
      category: AFFECTED_OWNERSHIP_CATEGORIES.CI_POLICY,
      disposition: AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE,
    }),
  ),
]);
const EXPECTED_OWNERSHIP_DELTA = Object.freeze({
  historicalTrackedPathCount: 1019,
  historicalTrackedPathSetSha256: HISTORICAL_OWNERSHIP_REVIEW.trackedPathSetSha256,
  historicalOwnershipSha256: HISTORICAL_OWNERSHIP_REVIEW.ownershipSha256,
  promotedTrackedPathCount: PROMOTED_OWNERSHIP_REVIEW.trackedPathCount,
  promotedTrackedPathSetSha256: PROMOTED_OWNERSHIP_REVIEW.trackedPathSetSha256,
  promotedOwnershipSha256: PROMOTED_OWNERSHIP_REVIEW.ownershipSha256,
  netExpansion: 4,
  commonPathCount: 1017,
  selectedProofOwnerDelta: 0,
  ciPolicyDelta: 3,
  frozenInputDelta: 1,
  addedPaths: PROMOTION_ADDED_TRACKED_PATHS,
  removedPaths: PROMOTION_REMOVED_TRACKED_PATHS,
  addedPathAuthorities: EXPECTED_ADDED_PATH_AUTHORITIES,
});
const THRESHOLD_KEYS = Object.freeze([
  "minimumConsecutiveEligibleComparisons",
  "eligibleComparisons",
  "consecutiveEligibleComparisons",
  "falseNegatives",
  "ownershipCategoriesCovered",
  "decisionCategoriesCovered",
  "sameRevisionWithinComparison",
  "freshHostedExecution",
  "cachedSuccessAllowed",
  "satisfied",
]);
const CONTROLLER_KEYS = Object.freeze([
  "rawStatePath",
  "rawStateBytes",
  "rawStateSha256",
  "controllerSha256",
  "controllerTestSha256",
  "launcherSha256",
  "launcherTestSha256",
  "reservationsSha256",
  "controllerTests",
  "combinedTests",
  "independentCleanReviews",
]);
const OBSERVATION_KEYS = Object.freeze([
  "sequence",
  "lane",
  "branch",
  "pullRequest",
  "comparisonId",
  "runId",
  "runAttempt",
  "runUrl",
  "createdAt",
  "completedAt",
  "baseRevision",
  "headRevision",
  "mergeRevision",
  "quality",
  "affected",
]);
const QUALITY_KEYS = Object.freeze([
  "jobId",
  "jobUrl",
  "startedAt",
  "completedAt",
  "conclusion",
  "receiptSha256",
  "status",
  "authority",
  "scope",
  "revision",
  "planSha256",
  "inventorySha256",
  "observedClosedCount",
  "stepCount",
  "proofPairCount",
  "trackedFileCount",
  "trackedBytes",
  "workspaceUnchanged",
  "cleanInputStatus",
  "cleanInputRevision",
  "cleanInputRevisionMatches",
  "cleanInputClean",
]);
const AFFECTED_KEYS = Object.freeze([
  "jobId",
  "jobUrl",
  "startedAt",
  "completedAt",
  "conclusion",
  "receiptSha256",
  "status",
  "authority",
  "requestedScope",
  "effectiveScope",
  "decisionCategory",
  "reason",
  "executionRevision",
  "selectorSha256",
  "ownershipSha256",
  "impactGraphSha256",
  "thresholdSha256",
  "inventorySha256",
  "planSha256",
  "changeSetSha256",
  "strictSubset",
  "freshExecution",
  "cachedSuccessRead",
  "selectedWorkloadCount",
  "selectedProofUnitCount",
  "observedClosedCount",
]);
const DECISION_KEYS = Object.freeze([
  "status",
  "affectedPromotionAuthorized",
  "eligiblePullRequests",
  "unsafePullRequests",
  "main",
  "release",
  "manualAudit",
  "legacyRollbackRetained",
]);
const CUTOVER_KEYS = Object.freeze([
  "status",
  "cleanup",
  "main",
  "affectedCanary",
  "proofReaderCheckpoint",
  "infrastructureDebt",
]);
const CUTOVER_CLEANUP_KEYS = Object.freeze([
  "commitSha",
  "pullRequestNumber",
  "pullRequestUrl",
  "baseRevision",
  "headRevision",
  "pullRequestMergeRevision",
  "mergedMainRevision",
  "runId",
  "runAttempt",
  "runUrl",
  "jobId",
  "jobUrl",
  "receiptSha256",
  "receiptRevision",
  "authority",
  "scope",
  "status",
]);
const CUTOVER_MAIN_KEYS = Object.freeze([
  "commitSha",
  "runId",
  "runAttempt",
  "runUrl",
  "jobId",
  "jobUrl",
  "receiptSha256",
  "receiptRevision",
  "authority",
  "scope",
  "status",
]);
const CUTOVER_AFFECTED_CANARY_KEYS = Object.freeze([
  "pullRequestNumber",
  "pullRequestUrl",
  "baseRevision",
  "headRevision",
  "mergeRevision",
  "runId",
  "runAttempt",
  "runUrl",
  "jobId",
  "jobUrl",
  "receiptSha256",
  "executionRevision",
  "changedPaths",
  "authority",
  "requestedScope",
  "effectiveScope",
  "decisionCategory",
  "reason",
  "status",
  "strictSubset",
  "freshExecution",
  "cachedSuccessRead",
  "selectorSha256",
  "ownershipSha256",
  "impactGraphSha256",
  "thresholdSha256",
  "inventorySha256",
  "planSha256",
  "changeSetSha256",
  "selectedWorkloadCount",
  "selectedProofUnitCount",
  "observedClosedCount",
]);
const CUTOVER_CHANGED_PATH_KEYS = Object.freeze(["path", "status", "mode"]);
const CUTOVER_CHECKPOINT_KEYS = Object.freeze([
  "profile",
  "sequence",
  "headSha256",
  "frozenArtifactCount",
  "currentReaderCount",
  "liveVerification",
]);
const CUTOVER_DEBT_KEYS = Object.freeze([
  "profile",
  "entryIds",
  "zeroReferences",
  "status",
  "openCount",
  "removedPendingHostedProofCount",
  "closedCount",
  "liveVerification",
]);
const G07_CLOSURE_DEBT_IDS = Object.freeze([
  "DEBT-I07-001",
  "DEBT-I07-002",
  "DEBT-I07-003",
  "DEBT-I07-004",
  "DEBT-I07-005",
  "DEBT-I07-006",
  "DEBT-I07-009",
  "DEBT-I07-010",
  "DEBT-I07-011",
  "DEBT-I07-012",
  "DEBT-I07-013",
  "DEBT-I07-014",
  "DEBT-I07-015",
  "DEBT-I07-016",
  "DEBT-I07-017",
  "DEBT-I07-018",
  "DEBT-I07-019",
]);
const G07_PROOF_READER_CHECKPOINT = Object.freeze({
  profile: "desen.ci.proof-reader-checkpoints.v1",
  sequence: 28,
  headSha256: "2577962251a9e6fa86993bd0e8bda1ed901f850a3b93678486c0445aed035546",
  frozenArtifactCount: 25,
  currentReaderCount: 50,
  liveVerification: "PASS",
});
const M09_T13_PROOF_READER_CHECKPOINT = Object.freeze({
  profile: "desen.ci.proof-reader-checkpoints.v1",
  sequence: 52,
  headSha256: "23b31316ff0dd5dac53f66f110bb7362b9ae1f2af2bc483e4915b66bea48e07b",
  frozenArtifactCount: 48,
  currentReaderCount: 96,
  liveVerification: "PASS",
});
const EXPECTED_LANES = Object.freeze(["A", "B", "C", "D", "E", "F", "G", "H"]);
const EXPECTED_PULL_REQUESTS = Object.freeze([28, 29, 30, 31, 32, 33, 34, 35]);

export class AffectedSelectorPromotionEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AffectedSelectorPromotionEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new AffectedSelectorPromotionEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function historicalCampaignProjection(evidence) {
  return {
    schemaVersion: evidence.schemaVersion,
    profile: evidence.profile,
    task: evidence.task,
    date: evidence.date,
    repository: evidence.repository,
    campaign: evidence.campaign,
    authorities: evidence.authorities,
    threshold: evidence.threshold,
    controller: evidence.controller,
    observations: evidence.observations,
    decision: evidence.decision,
    nonClaims: evidence.nonClaims,
  };
}

export function calculateAffectedSelectorHistoricalCampaignSha256(evidence) {
  return sha256(JSON.stringify(historicalCampaignProjection(evidence)));
}

async function readBoundedHandle(handle, expectedSize, maximumBytes) {
  const capacity = Math.min(expectedSize, maximumBytes) + 1;
  const buffer = Buffer.alloc(capacity);
  let offset = 0;
  while (offset < capacity) {
    const { bytesRead } = await handle.read(buffer, offset, capacity - offset, null);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  if (offset > maximumBytes) {
    fail("AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID", "Authority exceeded its byte budget.");
  }
  return buffer.subarray(0, offset);
}

function sameDirectoryIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size
  );
}

async function openCanonicalDirectory(directoryPath, label) {
  let before;
  let canonical;
  let handle;
  try {
    before = await lstat(directoryPath);
    canonical = await realpath(directoryPath);
    if (!before.isDirectory() || before.isSymbolicLink() || canonical !== directoryPath) {
      fail(
        "AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID",
        `${label} must be one canonical non-symbolic directory.`,
      );
    }
    handle = await open(directoryPath, DIRECTORY_READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isDirectory() || !sameDirectoryIdentity(before, opened)) {
      fail("AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID", `${label} changed identity while opening.`);
    }
    return { path: directoryPath, handle, opened, label };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (error instanceof AffectedSelectorPromotionEvidenceError) throw error;
    fail("AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID", `${label} could not be opened safely.`);
  }
}

async function assertCanonicalDirectoryUnchanged(capture) {
  let handleAfter;
  let namedAfter;
  let canonicalAfter;
  try {
    [handleAfter, namedAfter, canonicalAfter] = await Promise.all([
      capture.handle.stat(),
      lstat(capture.path),
      realpath(capture.path),
    ]);
  } catch {
    fail(
      "AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID",
      `${capture.label} became unavailable during the authority read.`,
    );
  }
  if (
    !handleAfter.isDirectory() ||
    !sameDirectoryIdentity(capture.opened, handleAfter) ||
    !namedAfter.isDirectory() ||
    namedAfter.isSymbolicLink() ||
    !sameDirectoryIdentity(capture.opened, namedAfter) ||
    canonicalAfter !== capture.path
  ) {
    fail(
      "AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID",
      `${capture.label} changed identity or canonicality during the authority read.`,
    );
  }
}

async function readRegularAuthorityCapture(workspaceRoot, relativePath, maximumBytes, beforeOpen) {
  const resolvedRoot = path.resolve(workspaceRoot);
  let rootCapture;
  let parentCapture;
  let handle;
  try {
    rootCapture = await openCanonicalDirectory(resolvedRoot, "Authority workspace root");
    const absolutePath = path.resolve(resolvedRoot, relativePath);
    const relative = path.relative(resolvedRoot, absolutePath);
    if (
      relative === "" ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      fail("AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID", "Authority path escaped its root.");
    }
    parentCapture = await openCanonicalDirectory(
      path.dirname(absolutePath),
      "Authority parent directory",
    );
    let before;
    try {
      before = await lstat(absolutePath);
    } catch {
      fail("AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID", "Authority file is unavailable.");
    }
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.size <= 0 ||
      before.size > maximumBytes
    ) {
      fail("AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID", "Authority file identity is unsafe.");
    }
    await beforeOpen?.({ absolutePath, relativePath });
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.nlink !== 1 ||
      opened.size !== before.size ||
      opened.mode !== before.mode
    ) {
      fail("AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID", "Authority changed before open.");
    }
    const bytes = await readBoundedHandle(handle, opened.size, maximumBytes);
    const after = await handle.stat();
    const namedAfter = await lstat(absolutePath);
    if (
      !after.isFile() ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.nlink !== 1 ||
      after.size !== opened.size ||
      after.mode !== opened.mode ||
      bytes.byteLength !== after.size ||
      !namedAfter.isFile() ||
      namedAfter.isSymbolicLink() ||
      namedAfter.dev !== opened.dev ||
      namedAfter.ino !== opened.ino ||
      namedAfter.nlink !== 1 ||
      namedAfter.size !== opened.size ||
      namedAfter.mode !== opened.mode
    ) {
      fail("AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID", "Authority changed during read.");
    }
    await assertCanonicalDirectoryUnchanged(parentCapture);
    await assertCanonicalDirectoryUnchanged(rootCapture);
    const executableBits = after.mode & 0o111;
    if (executableBits !== 0 && executableBits !== 0o111) {
      fail("AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID", "Authority mode is ambiguous.");
    }
    return Object.freeze({
      bytes,
      mode: executableBits === 0 ? "100644" : "100755",
    });
  } catch (error) {
    if (error instanceof AffectedSelectorPromotionEvidenceError) throw error;
    fail("AFFECTED_PROMOTION_EVIDENCE_FILE_INVALID", "Authority could not be read safely.");
  } finally {
    await handle?.close().catch(() => undefined);
    await parentCapture?.handle.close().catch(() => undefined);
    await rootCapture?.handle.close().catch(() => undefined);
  }
}

async function readRegularAuthority(workspaceRoot, relativePath, maximumBytes, beforeOpen) {
  return (await readRegularAuthorityCapture(workspaceRoot, relativePath, maximumBytes, beforeOpen))
    .bytes;
}

function comparisonAuthoritySha256(sources) {
  return sha256(
    JSON.stringify({
      schemaVersion: 1,
      profile: COMPARISON_AUTHORITY_PROFILE,
      sources,
    }),
  );
}

async function captureCurrentComparisonAuthority(
  workspaceRoot = WORKSPACE_ROOT,
  beforeSourceOpen = undefined,
) {
  const captures = new Map();
  const sources = [];
  // Read in the declared authority order. Each path is opened exactly once, and the captured
  // bytes—not a later pathname read—own both its serialized receipt and every semantic check.
  for (const sourcePath of SHADOW_AFFECTED_COMPARISON_AUTHORITY_PATHS) {
    const maximumBytes = [
      SELECTOR_SOURCE_PATH,
      "scripts/ci/affected-workload-ownership.mjs",
    ].includes(sourcePath)
      ? MAX_SELECTOR_SOURCE_BYTES
      : 32 * 1024 * 1024;
    const capture = await readRegularAuthorityCapture(
      workspaceRoot,
      sourcePath,
      maximumBytes,
      beforeSourceOpen,
    );
    captures.set(sourcePath, capture);
    sources.push({
      path: sourcePath,
      mode: capture.mode,
      byteLength: capture.bytes.byteLength,
      byteSha256: sha256(capture.bytes),
    });
  }
  return { captures, sources };
}

function capturedSourceBytes(authority, sourcePath) {
  const capture = authority.captures.get(sourcePath);
  if (!capture) {
    fail(
      "AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT",
      `Comparison authority omitted ${sourcePath}.`,
    );
  }
  return capture.bytes;
}

function inverseExactPatch(source, patches, expectedSha256, label) {
  let reconstructed = source;
  for (const [measured, promoted] of patches) {
    const count = reconstructed.split(promoted).length - 1;
    if (count !== 1 || reconstructed.includes(measured)) {
      fail(
        "AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT",
        `${label} lost one exact conservative successor patch.`,
        { count },
      );
    }
    reconstructed = reconstructed.replace(promoted, measured);
  }
  if (sha256(reconstructed) !== expectedSha256) {
    fail(
      "AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT",
      `${label} differs from the measured source outside its reviewed patch set.`,
    );
  }
  return patches.length;
}

const SELECTOR_EQUIVALENCE_PATCHES = Object.freeze([
  ["  readFileSync,", "  readSync,"],
  [MEASURED_RUNNER_PATH, PROMOTED_RUNNER_PATH],
  [
    '  "scripts/ci/affected-change-boundary.mjs",\n  "scripts/ci/affected-impact-graph.mjs",',
    '  "scripts/ci/affected-change-boundary.mjs",\n  "scripts/ci/affected-selector-promotion-evidence.mjs",\n  "scripts/ci/affected-impact-graph.mjs",',
  ],
  [
    "if (!pathBefore.isFile() || pathBefore.isSymbolicLink()) {",
    "if (!pathBefore.isFile() || pathBefore.isSymbolicLink() || pathBefore.nlink !== 1n) {",
  ],
  [
    "if (!before.isFile() || !sameSourceStat(pathBefore, before)) {",
    "if (!before.isFile() || before.nlink !== 1n || !sameSourceStat(pathBefore, before)) {",
  ],
  [
    "    const bytes = readFileSync(descriptor);",
    '    const capacity = Number(before.size) + 1;\n    const bounded = Buffer.alloc(capacity);\n    let offset = 0;\n    while (offset < capacity) {\n      const bytesRead = readSync(descriptor, bounded, offset, capacity - offset, null);\n      if (bytesRead === 0) break;\n      offset += bytesRead;\n    }\n    if (offset > MAXIMUM_COMPARISON_SOURCE_BYTES) {\n      fail(\n        "AFFECTED_SELECTOR_SOURCE_LIMIT",\n        `Comparison-authority source "${relativePath}" exceeded the byte limit while reading.`,\n      );\n    }\n    const bytes = bounded.subarray(0, offset);',
  ],
  [
    "      pathAfter.isSymbolicLink() ||\n      !sameSourceStat(before, after) ||\n      !sameSourceStat(after, pathAfter) ||\n      BigInt(bytes.byteLength) !== after.size",
    "      pathAfter.isSymbolicLink() ||\n      after.nlink !== 1n ||\n      pathAfter.nlink !== 1n ||\n      !sameSourceStat(before, after) ||\n      !sameSourceStat(after, pathAfter) ||\n      BigInt(bytes.byteLength) !== after.size ||\n      bytes.byteLength > MAXIMUM_COMPARISON_SOURCE_BYTES",
  ],
]);

const OWNERSHIP_EQUIVALENCE_PATCHES = Object.freeze([
  [
    "/** Reviewed count of tracked paths after the M07-T11 proof unit joined the selector authority. */\nexport const EXPECTED_AFFECTED_TRACKED_PATH_COUNT = 1019;",
    "/** Reviewed count after the I07-04 promotion evidence authority joined the tracked tree. */\nexport const EXPECTED_AFFECTED_TRACKED_PATH_COUNT = 1023;",
  ],
  [
    '  "d752922fa22db81f3f76fc93d4562a17b65589e614f3281844287aa8d6656679";',
    '  "65fe59b176e8f0a7bbaef8fdd1b3c13d09057fff3a3019fd445bce9e9fb801c4";',
  ],
  [
    '  "729b84436be134709db7bf8793e232bee4dab4a27efcb61e61cd0afeaed83ee8";',
    '  "8a9904c93964f6b5e979bb1369e58bb84abaa110137e47b9b839222d8e82d7d8";',
  ],
]);

function selectionEquivalenceProjection(value) {
  return {
    profile: value.profile,
    result: value.result,
    measuredComparisonAuthoritySha256: value.measuredComparisonAuthoritySha256,
    promotedComparisonAuthoritySha256: value.promotedComparisonAuthoritySha256,
    measuredSources: value.measuredSources,
    promotedSources: value.promotedSources,
    unchangedSelectionSourcePaths: value.unchangedSelectionSourcePaths,
    changedComparisonSourcePaths: value.changedComparisonSourcePaths,
    ownershipDelta: value.ownershipDelta,
    inventoryGraph: value.inventoryGraph,
    selectorPatchCount: value.selectorPatchCount,
  };
}

function calculateSelectionEquivalenceSha256(value) {
  return sha256(JSON.stringify(selectionEquivalenceProjection(value)));
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function ownershipReviewProjection(authority) {
  return {
    trackedPathCount: authority.trackedPathCount,
    trackedPathSetSha256: authority.trackedPathSetSha256,
    proofOwnedPathCount: authority.proofOwnedPathCount,
    categoryCounts: authority.categoryCounts,
    ownershipSha256: authority.ownershipSha256,
  };
}

function createBoundaryOwnershipDelta(rawBoundary) {
  const boundary = validateAffectedChangeBoundaryReceipt(rawBoundary);
  if (boundary.selection === "EXHAUSTIVE") return null;
  if (boundary.selection !== "AFFECTED") {
    fail("AFFECTED_PROMOTION_BOUNDARY_REQUIRED", "Promotion boundary selection is unknown.");
  }
  const successorAuthority = createAffectedWorkloadOwnership(boundary.trackedPaths);
  const successorReview = ownershipReviewProjection(successorAuthority);
  if (!isDeepStrictEqual(successorReview, CURRENT_SUCCESSOR_OWNERSHIP_REVIEW)) {
    fail(
      "AFFECTED_PROMOTION_OWNERSHIP_EQUIVALENCE_DRIFT",
      "The authenticated boundary does not reproduce the reviewed current ownership successor.",
    );
  }
  const successorPaths = successorAuthority.entries.map(({ path: trackedPath }) => trackedPath);
  for (const trackedPath of CURRENT_SUCCESSOR_ADDED_TRACKED_PATHS) {
    if (!successorPaths.includes(trackedPath)) {
      fail(
        "AFFECTED_PROMOTION_OWNERSHIP_EQUIVALENCE_DRIFT",
        "The authenticated boundary omitted one exact current successor path.",
        { path: trackedPath },
      );
    }
  }
  const promotedPaths = successorPaths.filter(
    (trackedPath) => !CURRENT_SUCCESSOR_ADDED_TRACKED_PATHS.includes(trackedPath),
  );
  const promotedReview = calculateAffectedWorkloadOwnershipReview(promotedPaths);
  if (!isDeepStrictEqual(promotedReview, PROMOTED_OWNERSHIP_REVIEW)) {
    fail(
      "AFFECTED_PROMOTION_OWNERSHIP_EQUIVALENCE_DRIFT",
      "Removing the exact current successor append does not reproduce the promoted I07-04 ownership authority.",
    );
  }
  for (const trackedPath of PROMOTION_ADDED_TRACKED_PATHS) {
    if (!promotedPaths.includes(trackedPath)) {
      fail(
        "AFFECTED_PROMOTION_OWNERSHIP_EQUIVALENCE_DRIFT",
        "The authenticated boundary omitted one exact promotion authority path.",
        { path: trackedPath },
      );
    }
  }
  if (PROMOTION_REMOVED_TRACKED_PATHS.some((trackedPath) => promotedPaths.includes(trackedPath))) {
    fail(
      "AFFECTED_PROMOTION_OWNERSHIP_EQUIVALENCE_DRIFT",
      "The authenticated boundary retained one removed shadow authority path.",
    );
  }
  const historicalPaths = promotedPaths
    .filter((trackedPath) => !PROMOTION_ADDED_TRACKED_PATHS.includes(trackedPath))
    .concat(PROMOTION_REMOVED_TRACKED_PATHS)
    .sort(compareUtf8);
  const historicalReview = calculateAffectedWorkloadOwnershipReview(historicalPaths);
  if (!isDeepStrictEqual(historicalReview, HISTORICAL_OWNERSHIP_REVIEW)) {
    fail(
      "AFFECTED_PROMOTION_OWNERSHIP_EQUIVALENCE_DRIFT",
      "The reviewed inverse path delta does not reproduce the hosted ownership authority.",
    );
  }
  const addedPathAuthorities = PROMOTION_ADDED_TRACKED_PATHS.map((trackedPath) => {
    const entry = successorAuthority.entries.find(
      ({ path: candidate }) => candidate === trackedPath,
    );
    if (
      !entry ||
      entry.disposition !== AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE ||
      ![
        AFFECTED_OWNERSHIP_CATEGORIES.CI_POLICY,
        AFFECTED_OWNERSHIP_CATEGORIES.FROZEN_INPUT,
      ].includes(entry.category)
    ) {
      fail(
        "AFFECTED_PROMOTION_OWNERSHIP_EQUIVALENCE_DRIFT",
        "A promotion-only path acquired selected proof authority.",
        { path: trackedPath },
      );
    }
    return { path: trackedPath, category: entry.category, disposition: entry.disposition };
  });
  const commonPathCount = promotedPaths.filter(
    (trackedPath) => !PROMOTION_ADDED_TRACKED_PATHS.includes(trackedPath),
  ).length;
  return Object.freeze({
    historicalTrackedPathCount: historicalReview.trackedPathCount,
    historicalTrackedPathSetSha256: historicalReview.trackedPathSetSha256,
    historicalOwnershipSha256: historicalReview.ownershipSha256,
    promotedTrackedPathCount: promotedReview.trackedPathCount,
    promotedTrackedPathSetSha256: promotedReview.trackedPathSetSha256,
    promotedOwnershipSha256: promotedReview.ownershipSha256,
    netExpansion: promotedReview.trackedPathCount - historicalReview.trackedPathCount,
    commonPathCount,
    selectedProofOwnerDelta:
      promotedReview.proofOwnedPathCount - historicalReview.proofOwnedPathCount,
    ciPolicyDelta:
      promotedReview.categoryCounts.CI_POLICY - historicalReview.categoryCounts.CI_POLICY,
    frozenInputDelta:
      promotedReview.categoryCounts.FROZEN_INPUT - historicalReview.categoryCounts.FROZEN_INPUT,
    addedPaths: [...PROMOTION_ADDED_TRACKED_PATHS],
    removedPaths: [...PROMOTION_REMOVED_TRACKED_PATHS],
    addedPathAuthorities,
  });
}

async function createSelectionSemanticsEquivalence(
  workspaceRoot = WORKSPACE_ROOT,
  currentAuthority = undefined,
) {
  const measuredSources = HISTORICAL_COMPARISON_SOURCES.map((source) => ({ ...source }));
  if (comparisonAuthoritySha256(measuredSources) !== MEASURED_COMPARISON_AUTHORITY_SHA256) {
    fail(
      "AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT",
      "Historical comparison-source receipts no longer reproduce the hosted authority.",
    );
  }
  const authority = currentAuthority ?? (await captureCurrentComparisonAuthority(workspaceRoot));
  const promotedSources = authority.sources;
  const promotedComparisonAuthoritySha256 = comparisonAuthoritySha256(promotedSources);
  if (promotedComparisonAuthoritySha256 !== EXPECTED_SHADOW_AFFECTED_SELECTOR_SHA256) {
    fail(
      "AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT",
      "Current comparison-source receipts do not reproduce the promoted authority.",
    );
  }
  const measuredByPath = new Map(measuredSources.map((source) => [source.path, source]));
  const promotedByPath = new Map(promotedSources.map((source) => [source.path, source]));
  for (const sourcePath of UNCHANGED_SELECTION_SOURCE_PATHS) {
    if (!isDeepStrictEqual(measuredByPath.get(sourcePath), promotedByPath.get(sourcePath))) {
      fail(
        "AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT",
        `Selection-decision source ${sourcePath} changed from the measured campaign.`,
      );
    }
  }
  const observedChanged = [...new Set([...measuredByPath.keys(), ...promotedByPath.keys()])]
    .filter(
      (sourcePath) =>
        !isDeepStrictEqual(measuredByPath.get(sourcePath), promotedByPath.get(sourcePath)),
    )
    .sort(compareUtf8);
  if (!isDeepStrictEqual(observedChanged, CHANGED_COMPARISON_SOURCE_PATHS)) {
    fail(
      "AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT",
      "The measured-to-promoted comparison-source partition drifted.",
      { observedChanged },
    );
  }
  const selectorBytes = capturedSourceBytes(authority, SELECTOR_SOURCE_PATH);
  if (selectorBytes.byteLength > MAX_SELECTOR_SOURCE_BYTES) {
    fail(
      "AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT",
      "Promoted selector exceeds its semantic-review byte budget.",
    );
  }
  const selectorSource = selectorBytes.toString("utf8");
  const selectorPatchCount = inverseExactPatch(
    selectorSource,
    SELECTOR_EQUIVALENCE_PATCHES,
    MEASURED_SELECTOR_SOURCE_SHA256,
    "Promoted selector",
  );
  const ownershipBytes = capturedSourceBytes(
    authority,
    "scripts/ci/affected-workload-ownership.mjs",
  );
  if (ownershipBytes.byteLength > MAX_SELECTOR_SOURCE_BYTES) {
    fail(
      "AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT",
      "Promoted ownership authority exceeds its semantic-review byte budget.",
    );
  }
  const ownershipSource = ownershipBytes.toString("utf8");
  inverseExactPatch(
    ownershipSource,
    OWNERSHIP_EQUIVALENCE_PATCHES,
    measuredSources[11].byteSha256,
    "Promoted ownership authority",
  );
  const inventory = createExhaustiveWorkloadInventory();
  const base = {
    profile: SELECTION_EQUIVALENCE_PROFILE,
    result: "CONSERVATIVE_EQUIVALENT",
    measuredComparisonAuthoritySha256: MEASURED_COMPARISON_AUTHORITY_SHA256,
    promotedComparisonAuthoritySha256,
    measuredSources,
    promotedSources,
    unchangedSelectionSourcePaths: [...UNCHANGED_SELECTION_SOURCE_PATHS],
    changedComparisonSourcePaths: [...CHANGED_COMPARISON_SOURCE_PATHS],
    ownershipDelta: EXPECTED_OWNERSHIP_DELTA,
    inventoryGraph: {
      inventorySha256: inventory.inventorySha256,
      workloadCount: inventory.workloadCount,
      proofUnitCount: inventory.proofUnitCount,
    },
    selectorPatchCount,
  };
  return Object.freeze({
    ...base,
    equivalenceSha256: calculateSelectionEquivalenceSha256(base),
  });
}

function runnerAuthorityProjection(value) {
  return {
    profile: value.profile,
    result: value.result,
    sources: value.sources,
    workflowContract: value.workflowContract,
    packageContract: value.packageContract,
    dispatcherContract: value.dispatcherContract,
  };
}

function calculateRunnerAuthoritySha256(value) {
  return sha256(JSON.stringify(runnerAuthorityProjection(value)));
}

async function createRunnerAuthority(workspaceRoot = WORKSPACE_ROOT, currentAuthority = undefined) {
  const authority = currentAuthority ?? (await captureCurrentComparisonAuthority(workspaceRoot));
  const sourceReceiptsByPath = new Map(
    authority.sources.map((sourceReceipt) => [sourceReceipt.path, sourceReceipt]),
  );
  const sources = RUNNER_SOURCE_PATHS.map((sourcePath) => sourceReceiptsByPath.get(sourcePath));
  if (
    !isDeepStrictEqual(
      sources.map(({ path: sourcePath }) => sourcePath),
      RUNNER_SOURCE_PATHS,
    )
  ) {
    fail("AFFECTED_PROMOTION_RUNNER_AUTHORITY_DRIFT", "Required runner source partition drifted.");
  }
  const [workflowSource, packageSource, , , dispatcherSource] = RUNNER_SOURCE_PATHS.map(
    (sourcePath) => capturedSourceBytes(authority, sourcePath).toString("utf8"),
  );
  const exactOccurrence = (source, fragment) => source.split(fragment).length - 1;
  const workflowFragments = [
    "pull_request:",
    "push:",
    "workflow_dispatch:",
    "fetch-depth: 0",
    "DESEN_REQUIRED_BASE_REVISION: ${{ github.event.pull_request.base.sha || '' }}",
    "DESEN_REQUIRED_HEAD_REVISION: ${{ github.event.pull_request.head.sha || '' }}",
    "github.event.pull_request.head.repo.full_name == github.repository",
    "timeout --signal=TERM --kill-after=30s 18m node scripts/ci/run-required-affected-quality-gate.mjs",
  ];
  if (
    workflowFragments.some((fragment) =>
      fragment === "github.event.pull_request.head.repo.full_name == github.repository"
        ? exactOccurrence(workflowSource, fragment) !== 2
        : exactOccurrence(workflowSource, fragment) !== 1,
    ) ||
    workflowSource.includes("run-shadow-affected-quality-gate.mjs") ||
    !workflowSource.includes(
      "github.event_name != 'workflow_dispatch' || inputs.mode == 'required'",
    )
  ) {
    fail("AFFECTED_PROMOTION_RUNNER_AUTHORITY_DRIFT", "Required workflow contract drifted.");
  }
  let packageJson;
  try {
    packageJson = JSON.parse(packageSource);
  } catch {
    fail("AFFECTED_PROMOTION_RUNNER_AUTHORITY_DRIFT", "Required package contract is not JSON.");
  }
  if (
    packageJson?.scripts?.[RUNNER_PACKAGE_CONTRACT.script] !== RUNNER_PACKAGE_CONTRACT.command ||
    Object.values(packageJson?.scripts ?? {}).some(
      (command) =>
        typeof command === "string" && command.includes("run-shadow-affected-quality-gate.mjs"),
    )
  ) {
    fail("AFFECTED_PROMOTION_RUNNER_AUTHORITY_DRIFT", "Required package command drifted.");
  }
  const dispatcherFragments = [
    "const REQUIRED_EXECUTION_TOKEN = Object.freeze",
    "const AUTHENTIC_REQUIRED_GATE_RESULTS = new WeakSet()",
    "const AUTHENTIC_AFFECTED_CLOSE_OBSERVATIONS = new WeakSet()",
    'testConfiguration ? "TEST" : "REQUIRED"',
    "REQUIRED_AFFECTED_GATE_TIMEOUT_MS = 17 * 60 * 1_000",
    "VALID_TERMINAL_EXIT_CODES = Object.freeze([130, 143])",
    "validateAffectedSelectorPromotionBoundary(promotion, boundary)",
    "validateAffectedSelectorPromotedSelection(",
  ];
  if (dispatcherFragments.some((fragment) => !dispatcherSource.includes(fragment))) {
    fail("AFFECTED_PROMOTION_RUNNER_AUTHORITY_DRIFT", "Required dispatcher contract drifted.");
  }
  const base = {
    profile: RUNNER_AUTHORITY_PROFILE,
    result: "EXACT_REQUIRED_FAIL_CLOSED",
    sources,
    workflowContract: RUNNER_WORKFLOW_CONTRACT,
    packageContract: RUNNER_PACKAGE_CONTRACT,
    dispatcherContract: RUNNER_DISPATCHER_CONTRACT,
  };
  return Object.freeze({ ...base, authoritySha256: calculateRunnerAuthoritySha256(base) });
}

function validateSelectorPatchSet(sourceBytes) {
  const source = sourceBytes.toString("utf8");
  const occurrences = source.split(PROMOTED_RUNNER_PATH).length - 1;
  if (occurrences !== 1 || source.includes(MEASURED_RUNNER_PATH)) {
    fail(
      "AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT",
      "Promoted selector does not contain the one reviewed authority-path substitution.",
      { occurrences },
    );
  }
  inverseExactPatch(
    source,
    SELECTOR_EQUIVALENCE_PATCHES,
    MEASURED_SELECTOR_SOURCE_SHA256,
    "Promoted selector",
  );
  return Object.freeze({
    promotedSelectorSourceSha256: sha256(sourceBytes),
    measuredSelectorSourceSha256: MEASURED_SELECTOR_SOURCE_SHA256,
    selectorPatchCount: SELECTOR_EQUIVALENCE_PATCHES.length,
  });
}

function exactRecord(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("AFFECTED_PROMOTION_EVIDENCE_INVALID", `${label} must be one ordinary record.`);
  }
  const actual = Object.keys(value);
  if (!isDeepStrictEqual(actual, keys)) {
    fail("AFFECTED_PROMOTION_EVIDENCE_INVALID", `${label} fields drifted.`, {
      expected: keys,
      actual,
    });
  }
  return value;
}

function exactArray(value, length, label) {
  if (!Array.isArray(value) || value.length !== length || Object.keys(value).length !== length) {
    fail("AFFECTED_PROMOTION_EVIDENCE_INVALID", `${label} must be one exact dense array.`, {
      expected: length,
      actual: Array.isArray(value) ? value.length : null,
    });
  }
  return value;
}

function exactString(value, expected, label) {
  if (value !== expected) {
    fail("AFFECTED_PROMOTION_EVIDENCE_DRIFT", `${label} drifted.`, { expected, actual: value });
  }
}

function assertSha(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) {
    fail("AFFECTED_PROMOTION_EVIDENCE_INVALID", `${label} must be one SHA-256 digest.`);
  }
}

function assertRevision(value, label) {
  if (typeof value !== "string" || !REVISION.test(value)) {
    fail("AFFECTED_PROMOTION_EVIDENCE_INVALID", `${label} must be one full Git revision.`);
  }
}

function assertTimestamp(value, label) {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value) || Number.isNaN(Date.parse(value))) {
    fail("AFFECTED_PROMOTION_EVIDENCE_INVALID", `${label} must be one ISO timestamp.`);
  }
}

function assertRunUrl(value, runId, label) {
  exactString(value, `https://github.com/${EXPECTED_REPOSITORY}/actions/runs/${runId}`, label);
}

function assertJobUrl(value, runId, jobId, label) {
  exactString(
    value,
    `https://github.com/${EXPECTED_REPOSITORY}/actions/runs/${runId}/job/${jobId}`,
    label,
  );
}

function assertCutover(condition, message, details = {}) {
  if (!condition) fail("AFFECTED_PROMOTION_CUTOVER_DRIFT", message, details);
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isRevision(value) {
  return typeof value === "string" && REVISION.test(value);
}

function isSha256(value) {
  return typeof value === "string" && SHA256.test(value);
}

function expectedPullRequestUrl(pullRequestNumber) {
  return `https://github.com/${EXPECTED_REPOSITORY}/pull/${pullRequestNumber}`;
}

function expectedRunUrl(runId) {
  return `https://github.com/${EXPECTED_REPOSITORY}/actions/runs/${runId}`;
}

function expectedJobUrl(runId, jobId) {
  return `${expectedRunUrl(runId)}/job/${jobId}`;
}

function validateCleanupCutover(rawCleanup) {
  const cleanup = exactRecord(rawCleanup, CUTOVER_CLEANUP_KEYS, "cutover.cleanup");
  assertCutover(
    isRevision(cleanup.commitSha) &&
      isRevision(cleanup.baseRevision) &&
      isRevision(cleanup.headRevision) &&
      isRevision(cleanup.pullRequestMergeRevision) &&
      isRevision(cleanup.mergedMainRevision) &&
      cleanup.commitSha === cleanup.headRevision &&
      cleanup.baseRevision === EXPECTED_BASE_REVISION &&
      cleanup.mergedMainRevision !== cleanup.baseRevision &&
      new Set([cleanup.baseRevision, cleanup.headRevision, cleanup.pullRequestMergeRevision])
        .size === 3,
    "Cleanup pull-request revisions are incomplete, replayed, or inconsistent.",
  );
  assertCutover(
    isPositiveInteger(cleanup.pullRequestNumber) &&
      cleanup.pullRequestNumber > EXPECTED_PULL_REQUESTS.at(-1) &&
      cleanup.pullRequestUrl === expectedPullRequestUrl(cleanup.pullRequestNumber) &&
      isPositiveInteger(cleanup.runId) &&
      cleanup.runAttempt === 1 &&
      cleanup.runUrl === expectedRunUrl(cleanup.runId) &&
      isPositiveInteger(cleanup.jobId) &&
      cleanup.jobUrl === expectedJobUrl(cleanup.runId, cleanup.jobId),
    "Cleanup pull-request hosted identity is invalid.",
  );
  assertCutover(
    isSha256(cleanup.receiptSha256) &&
      cleanup.receiptRevision === cleanup.pullRequestMergeRevision &&
      cleanup.authority === "REQUIRED" &&
      cleanup.scope === "EXHAUSTIVE" &&
      cleanup.status === "PASS",
    "Cleanup pull request did not prove one REQUIRED + EXHAUSTIVE pass.",
  );
  return cleanup;
}

function validateMainCutover(rawMain, cleanup) {
  const main = exactRecord(rawMain, CUTOVER_MAIN_KEYS, "cutover.main");
  assertCutover(
    isRevision(main.commitSha) &&
      main.commitSha === cleanup.mergedMainRevision &&
      isPositiveInteger(main.runId) &&
      main.runAttempt === 1 &&
      main.runUrl === expectedRunUrl(main.runId) &&
      isPositiveInteger(main.jobId) &&
      main.jobUrl === expectedJobUrl(main.runId, main.jobId),
    "Post-merge main hosted identity is invalid.",
  );
  assertCutover(
    isSha256(main.receiptSha256) &&
      main.receiptRevision === main.commitSha &&
      main.authority === "REQUIRED" &&
      main.scope === "EXHAUSTIVE" &&
      main.status === "PASS",
    "Post-merge main did not prove one REQUIRED + EXHAUSTIVE pass.",
  );
  return main;
}

function validateAffectedCanaryCutover(rawCanary, main, promotedAuthorities) {
  const canary = exactRecord(rawCanary, CUTOVER_AFFECTED_CANARY_KEYS, "cutover.affectedCanary");
  assertCutover(
    isRevision(canary.baseRevision) &&
      isRevision(canary.headRevision) &&
      isRevision(canary.mergeRevision) &&
      canary.baseRevision === main.commitSha &&
      new Set([canary.baseRevision, canary.headRevision, canary.mergeRevision]).size === 3,
    "Affected canary revisions are incomplete, replayed, or not based on verified main.",
  );
  assertCutover(
    isPositiveInteger(canary.pullRequestNumber) &&
      canary.pullRequestUrl === expectedPullRequestUrl(canary.pullRequestNumber) &&
      isPositiveInteger(canary.runId) &&
      canary.runAttempt === 1 &&
      canary.runUrl === expectedRunUrl(canary.runId) &&
      isPositiveInteger(canary.jobId) &&
      canary.jobUrl === expectedJobUrl(canary.runId, canary.jobId) &&
      canary.executionRevision === canary.mergeRevision,
    "Affected canary hosted identity is invalid.",
  );
  const changedPaths = exactArray(canary.changedPaths, 1, "cutover.affectedCanary.changedPaths");
  const changedPath = exactRecord(
    changedPaths[0],
    CUTOVER_CHANGED_PATH_KEYS,
    "cutover.affectedCanary.changedPaths[0]",
  );
  assertCutover(
    isDeepStrictEqual(changedPath, {
      path: "scripts/verify-protocol-types.mjs",
      status: "M",
      mode: "100644",
    }),
    "Affected canary must contain only the reviewed inert protocol-types verifier edit.",
  );
  assertCutover(
    canary.authority === "REQUIRED" &&
      canary.requestedScope === "AFFECTED" &&
      canary.effectiveScope === "AFFECTED" &&
      canary.decisionCategory === "AFFECTED" &&
      canary.reason === "ELIGIBLE_PROOF_UNIT_CLOSURE" &&
      canary.status === "PASS" &&
      canary.strictSubset === true &&
      canary.freshExecution === true &&
      canary.cachedSuccessRead === false &&
      canary.selectedWorkloadCount === 10 &&
      canary.selectedProofUnitCount === 1 &&
      canary.observedClosedCount === 10,
    "Affected canary did not prove one fresh complete strict subset.",
  );
  for (const key of [
    "selectorSha256",
    "ownershipSha256",
    "impactGraphSha256",
    "thresholdSha256",
    "inventorySha256",
  ]) {
    assertCutover(
      canary[key] === promotedAuthorities[key],
      `Affected canary ${key} differs from the promoted authority.`,
    );
  }
  assertCutover(
    isSha256(canary.receiptSha256) &&
      isSha256(canary.planSha256) &&
      isSha256(canary.changeSetSha256),
    "Affected canary receipt, plan, or change-set identity is invalid.",
  );
  return canary;
}

function validateCutoverCheckpoint(rawCheckpoint) {
  const checkpoint = exactRecord(
    rawCheckpoint,
    CUTOVER_CHECKPOINT_KEYS,
    "cutover.proofReaderCheckpoint",
  );
  assertCutover(
    isDeepStrictEqual(checkpoint, G07_PROOF_READER_CHECKPOINT),
    "G07 closure does not bind the exact reviewed proof-reader checkpoint.",
  );
  return checkpoint;
}

function expectedCutoverDebt(status) {
  const verified = status === "CLOSED";
  return {
    profile: "desen.ci.infrastructure-debt.v1",
    entryIds: [...G07_CLOSURE_DEBT_IDS],
    zeroReferences: "PASS",
    status,
    openCount: 1,
    removedPendingHostedProofCount: verified ? 0 : 17,
    closedCount: verified ? 18 : 1,
    liveVerification: "PASS",
  };
}

function validateCutoverDebt(rawDebt, status) {
  const debt = exactRecord(rawDebt, CUTOVER_DEBT_KEYS, "cutover.infrastructureDebt");
  const expectedStatus =
    status === "HOSTED_CUTOVER_VERIFIED" ? "CLOSED" : "REMOVED_PENDING_HOSTED_PROOF";
  assertCutover(
    isDeepStrictEqual(debt, expectedCutoverDebt(expectedStatus)),
    "G07 closure-debt set, lifecycle, or counts drifted.",
  );
  return debt;
}

function validateCutover(rawCutover, promotedAuthorities) {
  const cutover = exactRecord(rawCutover, CUTOVER_KEYS, "cutover");
  assertCutover(
    ["PENDING_HOSTED_CUTOVER", "HOSTED_CUTOVER_VERIFIED"].includes(cutover.status),
    "Cutover lifecycle status is unsupported.",
  );
  validateCutoverCheckpoint(cutover.proofReaderCheckpoint);
  validateCutoverDebt(cutover.infrastructureDebt, cutover.status);
  if (cutover.status === "PENDING_HOSTED_CUTOVER") {
    assertCutover(
      cutover.cleanup === null && cutover.main === null && cutover.affectedCanary === null,
      "Pending cutover evidence may not contain an unearned hosted identity.",
    );
    return cutover;
  }
  assertCutover(
    cutover.cleanup !== null && cutover.main !== null && cutover.affectedCanary !== null,
    "Verified cutover evidence must contain all three hosted authorities.",
  );
  const cleanup = validateCleanupCutover(cutover.cleanup);
  const main = validateMainCutover(cutover.main, cleanup);
  const canary = validateAffectedCanaryCutover(cutover.affectedCanary, main, promotedAuthorities);
  assertCutover(
    cleanup.pullRequestNumber < canary.pullRequestNumber &&
      cleanup.runId < main.runId &&
      main.runId < canary.runId &&
      new Set([cleanup.runId, main.runId, canary.runId]).size === 3 &&
      new Set([cleanup.jobId, main.jobId, canary.jobId]).size === 3 &&
      cleanup.pullRequestNumber !== canary.pullRequestNumber,
    "Cutover authorities replay or reorder one hosted run, job, or pull request.",
  );
  return cutover;
}

function validateQuality(rawQuality, observation, authorities, label) {
  const quality = exactRecord(rawQuality, QUALITY_KEYS, label);
  if (!Number.isSafeInteger(quality.jobId) || quality.jobId < 1) {
    fail("AFFECTED_PROMOTION_EVIDENCE_INVALID", `${label}.jobId is invalid.`);
  }
  assertJobUrl(quality.jobUrl, observation.runId, quality.jobId, `${label}.jobUrl`);
  assertTimestamp(quality.startedAt, `${label}.startedAt`);
  assertTimestamp(quality.completedAt, `${label}.completedAt`);
  assertSha(quality.receiptSha256, `${label}.receiptSha256`);
  exactString(quality.conclusion, "success", `${label}.conclusion`);
  exactString(quality.status, "PASS", `${label}.status`);
  exactString(quality.authority, "REQUIRED", `${label}.authority`);
  exactString(quality.scope, "EXHAUSTIVE", `${label}.scope`);
  exactString(quality.revision, observation.mergeRevision, `${label}.revision`);
  exactString(quality.planSha256, authorities.requiredPlanSha256, `${label}.planSha256`);
  exactString(quality.inventorySha256, authorities.inventorySha256, `${label}.inventorySha256`);
  if (
    quality.observedClosedCount !== 150 ||
    quality.stepCount !== 150 ||
    quality.proofPairCount !== 71 ||
    quality.trackedFileCount !== 1019 ||
    !Number.isSafeInteger(quality.trackedBytes) ||
    quality.trackedBytes < 1 ||
    quality.trackedBytes > 32 * 1024 * 1024 ||
    quality.workspaceUnchanged !== true ||
    quality.cleanInputStatus !== "PASS" ||
    quality.cleanInputRevision !== observation.mergeRevision ||
    quality.cleanInputRevisionMatches !== true ||
    quality.cleanInputClean !== true
  ) {
    fail("AFFECTED_PROMOTION_REQUIRED_MISMATCH", `${label} did not prove one full clean oracle.`);
  }
}

function validateAffected(rawAffected, observation, authorities, label) {
  const affected = exactRecord(rawAffected, AFFECTED_KEYS, label);
  if (!Number.isSafeInteger(affected.jobId) || affected.jobId < 1) {
    fail("AFFECTED_PROMOTION_EVIDENCE_INVALID", `${label}.jobId is invalid.`);
  }
  assertJobUrl(affected.jobUrl, observation.runId, affected.jobId, `${label}.jobUrl`);
  assertTimestamp(affected.startedAt, `${label}.startedAt`);
  assertTimestamp(affected.completedAt, `${label}.completedAt`);
  assertSha(affected.receiptSha256, `${label}.receiptSha256`);
  assertSha(affected.planSha256, `${label}.planSha256`);
  assertSha(affected.changeSetSha256, `${label}.changeSetSha256`);
  exactString(affected.conclusion, "success", `${label}.conclusion`);
  exactString(affected.status, "PASS", `${label}.status`);
  exactString(affected.authority, "SHADOW", `${label}.authority`);
  exactString(affected.requestedScope, "AFFECTED", `${label}.requestedScope`);
  exactString(affected.effectiveScope, "AFFECTED", `${label}.effectiveScope`);
  exactString(affected.decisionCategory, "AFFECTED", `${label}.decisionCategory`);
  exactString(affected.reason, "ELIGIBLE_PROOF_UNIT_CLOSURE", `${label}.reason`);
  exactString(affected.executionRevision, observation.mergeRevision, `${label}.executionRevision`);
  for (const key of [
    "selectorSha256",
    "ownershipSha256",
    "impactGraphSha256",
    "thresholdSha256",
    "inventorySha256",
  ]) {
    exactString(affected[key], authorities[key], `${label}.${key}`);
  }
  if (
    affected.strictSubset !== true ||
    affected.freshExecution !== true ||
    affected.cachedSuccessRead !== false ||
    affected.selectedWorkloadCount !== 10 ||
    affected.selectedProofUnitCount !== 1 ||
    affected.observedClosedCount !== 10
  ) {
    fail("AFFECTED_PROMOTION_SUBSET_MISMATCH", `${label} is not one fresh complete strict subset.`);
  }
}

function validateObservation(rawObservation, index, authorities, seen, previousCreatedAt) {
  const label = `observations[${index}]`;
  const observation = exactRecord(rawObservation, OBSERVATION_KEYS, label);
  const sequence = index + 1;
  if (
    observation.sequence !== sequence ||
    !EXPECTED_LANES.includes(observation.lane) ||
    !EXPECTED_PULL_REQUESTS.includes(observation.pullRequest) ||
    !Number.isSafeInteger(observation.runId) ||
    observation.runId < 1 ||
    observation.runAttempt !== 1 ||
    observation.comparisonId !== `github:${observation.runId}:attempt:1`
  ) {
    fail("AFFECTED_PROMOTION_SEQUENCE_DRIFT", `${label} identity or order drifted.`);
  }
  if (
    seen.runIds.has(observation.runId) ||
    seen.comparisonIds.has(observation.comparisonId) ||
    seen.qualityJobIds.has(observation.quality.jobId) ||
    seen.affectedJobIds.has(observation.affected.jobId) ||
    seen.headRevisions.has(observation.headRevision) ||
    seen.mergeRevisions.has(observation.mergeRevision) ||
    seen.changeSets.has(observation.affected.changeSetSha256)
  ) {
    fail("AFFECTED_PROMOTION_REPLAY", `${label} replays a prior comparison authority.`);
  }
  exactString(observation.baseRevision, EXPECTED_BASE_REVISION, `${label}.baseRevision`);
  assertRevision(observation.headRevision, `${label}.headRevision`);
  assertRevision(observation.mergeRevision, `${label}.mergeRevision`);
  assertTimestamp(observation.createdAt, `${label}.createdAt`);
  assertTimestamp(observation.completedAt, `${label}.completedAt`);
  if (
    Date.parse(observation.createdAt) < previousCreatedAt ||
    Date.parse(observation.completedAt) < Date.parse(observation.createdAt)
  ) {
    fail("AFFECTED_PROMOTION_CHRONOLOGY_DRIFT", `${label} chronology drifted.`);
  }
  assertRunUrl(observation.runUrl, observation.runId, `${label}.runUrl`);
  exactString(
    observation.branch,
    observation.lane === "A"
      ? "agent/i07-04-hosted-observations"
      : `agent/i07-04-hosted-lane-${observation.lane.toLowerCase()}`,
    `${label}.branch`,
  );
  validateQuality(observation.quality, observation, authorities, `${label}.quality`);
  validateAffected(observation.affected, observation, authorities, `${label}.affected`);
  if (observation.quality.jobId === observation.affected.jobId) {
    fail("AFFECTED_PROMOTION_REPLAY", `${label} reuses one job for both executions.`);
  }
  seen.runIds.add(observation.runId);
  seen.comparisonIds.add(observation.comparisonId);
  seen.qualityJobIds.add(observation.quality.jobId);
  seen.affectedJobIds.add(observation.affected.jobId);
  seen.headRevisions.add(observation.headRevision);
  seen.mergeRevisions.add(observation.mergeRevision);
  seen.changeSets.add(observation.affected.changeSetSha256);
  return Date.parse(observation.createdAt);
}

export function validateAffectedSelectorPromotionEvidence(rawEvidence) {
  const evidence = exactRecord(rawEvidence, ROOT_KEYS, "promotion evidence");
  if (
    evidence.schemaVersion !== 1 ||
    evidence.profile !== AFFECTED_SELECTOR_PROMOTION_EVIDENCE_PROFILE ||
    evidence.task !== "I07-04" ||
    evidence.date !== "2026-08-12" ||
    evidence.repository !== `https://github.com/${EXPECTED_REPOSITORY}`
  ) {
    fail("AFFECTED_PROMOTION_EVIDENCE_DRIFT", "Promotion evidence identity drifted.");
  }
  const campaign = exactRecord(evidence.campaign, CAMPAIGN_KEYS, "campaign");
  exactString(campaign.frozenBaseRevision, EXPECTED_BASE_REVISION, "campaign.frozenBaseRevision");
  assertTimestamp(campaign.startedAt, "campaign.startedAt");
  assertTimestamp(campaign.completedAt, "campaign.completedAt");
  if (
    !isDeepStrictEqual(campaign.lanes, EXPECTED_LANES) ||
    !isDeepStrictEqual(campaign.pullRequests, EXPECTED_PULL_REQUESTS) ||
    campaign.comparisonOrder !== "GITHUB_CREATED_AT_THEN_RUN_ID"
  ) {
    fail("AFFECTED_PROMOTION_CAMPAIGN_DRIFT", "Campaign topology drifted.");
  }
  const authorities = exactRecord(evidence.authorities, AUTHORITY_KEYS, "authorities");
  for (const [key, value] of Object.entries(authorities)) assertSha(value, `authorities.${key}`);
  exactString(
    authorities.thresholdSha256,
    EXPECTED_THRESHOLD_SHA256,
    "authorities.thresholdSha256",
  );
  exactString(
    authorities.inventorySha256,
    authorities.requiredInventorySha256,
    "authorities inventory parity",
  );
  const promotedAuthorities = exactRecord(
    evidence.promotedAuthorities,
    PROMOTED_AUTHORITY_KEYS,
    "promotedAuthorities",
  );
  for (const [key, expected] of [
    ["selectorSha256", I07_04_PROMOTED_AUTHORITIES.selectorSha256],
    ["ownershipSha256", I07_04_PROMOTED_AUTHORITIES.ownershipSha256],
    ["impactGraphSha256", I07_04_PROMOTED_AUTHORITIES.impactGraphSha256],
    ["thresholdSha256", I07_04_PROMOTED_AUTHORITIES.thresholdSha256],
    ["inventorySha256", I07_04_PROMOTED_AUTHORITIES.inventorySha256],
  ]) {
    exactString(promotedAuthorities[key], expected, `promotedAuthorities.${key}`);
  }
  assertSha(
    promotedAuthorities.selectionEquivalenceSha256,
    "promotedAuthorities.selectionEquivalenceSha256",
  );
  assertSha(promotedAuthorities.runnerAuthoritySha256, "promotedAuthorities.runnerAuthoritySha256");
  const selectionEquivalence = exactRecord(
    evidence.selectionSemanticsEquivalence,
    SELECTION_EQUIVALENCE_KEYS,
    "selectionSemanticsEquivalence",
  );
  exactString(
    selectionEquivalence.profile,
    SELECTION_EQUIVALENCE_PROFILE,
    "selectionSemanticsEquivalence.profile",
  );
  exactString(
    selectionEquivalence.result,
    "CONSERVATIVE_EQUIVALENT",
    "selectionSemanticsEquivalence.result",
  );
  exactString(
    selectionEquivalence.measuredComparisonAuthoritySha256,
    MEASURED_COMPARISON_AUTHORITY_SHA256,
    "selectionSemanticsEquivalence.measuredComparisonAuthoritySha256",
  );
  exactString(
    selectionEquivalence.promotedComparisonAuthoritySha256,
    I07_04_PROMOTED_AUTHORITIES.selectorSha256,
    "selectionSemanticsEquivalence.promotedComparisonAuthoritySha256",
  );
  const measuredSources = exactArray(
    selectionEquivalence.measuredSources,
    20,
    "selectionSemanticsEquivalence.measuredSources",
  ).map((source, index) => exactRecord(source, SOURCE_RECEIPT_KEYS, `measured source ${index}`));
  const promotedSources = exactArray(
    selectionEquivalence.promotedSources,
    21,
    "selectionSemanticsEquivalence.promotedSources",
  ).map((source, index) => exactRecord(source, SOURCE_RECEIPT_KEYS, `promoted source ${index}`));
  if (
    !isDeepStrictEqual(measuredSources, HISTORICAL_COMPARISON_SOURCES) ||
    comparisonAuthoritySha256(measuredSources) !== MEASURED_COMPARISON_AUTHORITY_SHA256 ||
    comparisonAuthoritySha256(promotedSources) !== I07_04_PROMOTED_AUTHORITIES.selectorSha256 ||
    !isDeepStrictEqual(
      selectionEquivalence.unchangedSelectionSourcePaths,
      UNCHANGED_SELECTION_SOURCE_PATHS,
    ) ||
    !isDeepStrictEqual(
      selectionEquivalence.changedComparisonSourcePaths,
      CHANGED_COMPARISON_SOURCE_PATHS,
    )
  ) {
    fail(
      "AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT",
      "Selection-equivalence source receipts or partition drifted.",
    );
  }
  const ownershipDelta = exactRecord(
    selectionEquivalence.ownershipDelta,
    OWNERSHIP_DELTA_KEYS,
    "selectionSemanticsEquivalence.ownershipDelta",
  );
  exactArray(ownershipDelta.addedPaths, 6, "selectionSemanticsEquivalence.addedPaths");
  exactArray(ownershipDelta.removedPaths, 2, "selectionSemanticsEquivalence.removedPaths");
  exactArray(
    ownershipDelta.addedPathAuthorities,
    6,
    "selectionSemanticsEquivalence.addedPathAuthorities",
  ).forEach((authority, index) =>
    exactRecord(authority, ADDED_PATH_AUTHORITY_KEYS, `addedPathAuthorities[${index}]`),
  );
  if (!isDeepStrictEqual(ownershipDelta, EXPECTED_OWNERSHIP_DELTA)) {
    fail("AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT", "Ownership delta widened.");
  }
  const inventoryGraph = exactRecord(
    selectionEquivalence.inventoryGraph,
    INVENTORY_GRAPH_KEYS,
    "selectionSemanticsEquivalence.inventoryGraph",
  );
  if (
    !isDeepStrictEqual(inventoryGraph, {
      inventorySha256: I07_04_PROMOTED_AUTHORITIES.inventorySha256,
      workloadCount: 150,
      proofUnitCount: 71,
    }) ||
    selectionEquivalence.selectorPatchCount !== SELECTOR_EQUIVALENCE_PATCHES.length ||
    selectionEquivalence.equivalenceSha256 !==
      calculateSelectionEquivalenceSha256(selectionEquivalence)
  ) {
    fail(
      "AFFECTED_PROMOTION_ALGORITHM_EQUIVALENCE_DRIFT",
      "Selection-equivalence projection drifted.",
    );
  }
  exactString(
    promotedAuthorities.selectionEquivalenceSha256,
    selectionEquivalence.equivalenceSha256,
    "promotedAuthorities.selectionEquivalenceSha256",
  );
  const runnerAuthority = exactRecord(
    evidence.runnerAuthority,
    RUNNER_AUTHORITY_KEYS,
    "runnerAuthority",
  );
  exactString(runnerAuthority.profile, RUNNER_AUTHORITY_PROFILE, "runnerAuthority.profile");
  exactString(runnerAuthority.result, "EXACT_REQUIRED_FAIL_CLOSED", "runnerAuthority.result");
  exactArray(runnerAuthority.sources, 5, "runnerAuthority.sources").forEach((source, index) =>
    exactRecord(source, SOURCE_RECEIPT_KEYS, `runnerAuthority.sources[${index}]`),
  );
  if (
    !isDeepStrictEqual(runnerAuthority.workflowContract, RUNNER_WORKFLOW_CONTRACT) ||
    !isDeepStrictEqual(runnerAuthority.packageContract, RUNNER_PACKAGE_CONTRACT) ||
    !isDeepStrictEqual(runnerAuthority.dispatcherContract, RUNNER_DISPATCHER_CONTRACT) ||
    runnerAuthority.authoritySha256 !== calculateRunnerAuthoritySha256(runnerAuthority)
  ) {
    fail("AFFECTED_PROMOTION_RUNNER_AUTHORITY_DRIFT", "Required runner authority drifted.");
  }
  exactString(
    promotedAuthorities.runnerAuthoritySha256,
    runnerAuthority.authoritySha256,
    "promotedAuthorities.runnerAuthoritySha256",
  );
  const threshold = exactRecord(evidence.threshold, THRESHOLD_KEYS, "threshold");
  if (
    threshold.minimumConsecutiveEligibleComparisons !== 20 ||
    threshold.eligibleComparisons !== 20 ||
    threshold.consecutiveEligibleComparisons !== 20 ||
    threshold.falseNegatives !== 0 ||
    threshold.ownershipCategoriesCovered !== 8 ||
    threshold.decisionCategoriesCovered !== 8 ||
    threshold.sameRevisionWithinComparison !== true ||
    threshold.freshHostedExecution !== true ||
    threshold.cachedSuccessAllowed !== false ||
    threshold.satisfied !== true
  ) {
    fail("AFFECTED_PROMOTION_THRESHOLD_UNSATISFIED", "Frozen Gate D threshold is not satisfied.");
  }
  const controller = exactRecord(evidence.controller, CONTROLLER_KEYS, "controller");
  exactString(controller.rawStatePath, ".i07-04/controller-state.json", "controller.rawStatePath");
  if (controller.rawStateBytes !== EXPECTED_CONTROLLER_STATE_BYTES) {
    fail("AFFECTED_PROMOTION_CONTROLLER_DRIFT", "Controller state byte count drifted.");
  }
  for (const [value, expected, label] of [
    [controller.rawStateSha256, EXPECTED_CONTROLLER_STATE_SHA256, "rawStateSha256"],
    [controller.controllerSha256, EXPECTED_CONTROLLER_SHA256, "controllerSha256"],
    [controller.controllerTestSha256, EXPECTED_CONTROLLER_TEST_SHA256, "controllerTestSha256"],
    [controller.launcherSha256, EXPECTED_LAUNCHER_SHA256, "launcherSha256"],
    [controller.launcherTestSha256, EXPECTED_LAUNCHER_TEST_SHA256, "launcherTestSha256"],
    [controller.reservationsSha256, EXPECTED_RESERVATIONS_SHA256, "reservationsSha256"],
  ]) {
    exactString(value, expected, `controller.${label}`);
  }
  if (
    controller.controllerTests !== 16 ||
    controller.combinedTests !== 33 ||
    controller.independentCleanReviews !== 2
  ) {
    fail("AFFECTED_PROMOTION_CONTROLLER_DRIFT", "Controller review evidence drifted.");
  }
  exactString(
    evidence.historicalCampaignSha256,
    EXPECTED_HISTORICAL_CAMPAIGN_SHA256,
    "historicalCampaignSha256",
  );
  const observations = exactArray(evidence.observations, 20, "observations");
  const seen = {
    runIds: new Set(),
    comparisonIds: new Set(),
    qualityJobIds: new Set(),
    affectedJobIds: new Set(),
    headRevisions: new Set(),
    mergeRevisions: new Set(),
    changeSets: new Set(),
  };
  let previousCreatedAt = -Infinity;
  for (let index = 0; index < observations.length; index += 1) {
    previousCreatedAt = validateObservation(
      observations[index],
      index,
      authorities,
      seen,
      previousCreatedAt,
    );
  }
  exactString(campaign.startedAt, observations[0].createdAt, "campaign.startedAt");
  exactString(campaign.completedAt, observations.at(-1).completedAt, "campaign.completedAt");
  const decision = exactRecord(evidence.decision, DECISION_KEYS, "decision");
  if (
    decision.status !== "PROMOTION_AUTHORIZED" ||
    decision.affectedPromotionAuthorized !== true ||
    decision.eligiblePullRequests !== "REQUIRED_AFFECTED" ||
    decision.unsafePullRequests !== "REQUIRED_EXHAUSTIVE" ||
    decision.main !== "REQUIRED_EXHAUSTIVE" ||
    decision.release !== "REQUIRED_EXHAUSTIVE" ||
    decision.manualAudit !== "REQUIRED_EXHAUSTIVE" ||
    decision.legacyRollbackRetained !== true
  ) {
    fail("AFFECTED_PROMOTION_DECISION_DRIFT", "Promotion decision widened authority.");
  }
  const cutover = validateCutover(evidence.cutover, promotedAuthorities);
  const nonClaims = exactArray(evidence.nonClaims, 5, "nonClaims");
  if (nonClaims.some((value) => typeof value !== "string" || value.length === 0)) {
    fail("AFFECTED_PROMOTION_EVIDENCE_INVALID", "Every non-claim must be explicit text.");
  }
  exactString(
    calculateAffectedSelectorHistoricalCampaignSha256(evidence),
    EXPECTED_HISTORICAL_CAMPAIGN_SHA256,
    "historical campaign projection",
  );
  return Object.freeze({
    status: "PASS",
    profile: evidence.profile,
    observations: observations.length,
    falseNegatives: threshold.falseNegatives,
    promotionAuthorized: decision.affectedPromotionAuthorized,
    cutoverStatus: cutover.status,
    hostedCutoverVerified: cutover.status === "HOSTED_CUTOVER_VERIFIED",
    rawStateSha256: controller.rawStateSha256,
    promotedAuthorities: Object.freeze({ ...promotedAuthorities }),
  });
}

export async function readAffectedSelectorPromotionEvidence(
  workspaceRoot = WORKSPACE_ROOT,
  relativePath = AFFECTED_SELECTOR_PROMOTION_EVIDENCE_PATH,
  beforeOpen = undefined,
) {
  const bytes = await readRegularAuthority(
    workspaceRoot,
    relativePath,
    MAX_EVIDENCE_BYTES,
    beforeOpen,
  );
  let evidence;
  try {
    evidence = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("AFFECTED_PROMOTION_EVIDENCE_JSON_INVALID", "Promotion evidence is not JSON.");
  }
  const canonicalBytes = Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`);
  if (!bytes.equals(canonicalBytes)) {
    fail(
      "AFFECTED_PROMOTION_EVIDENCE_FILE_DRIFT",
      "Promotion evidence must retain its exact canonical JSON byte encoding.",
    );
  }
  return { evidence, bytes };
}

export async function verifyAffectedSelectorPromotionEvidence(options = {}) {
  const { evidence, bytes } = await readAffectedSelectorPromotionEvidence(
    options.workspaceRoot,
    options.relativePath,
    options.beforeEvidenceOpen,
  );
  const receipt = validateAffectedSelectorPromotionEvidence(evidence);
  const workspaceRoot = options.workspaceRoot ?? WORKSPACE_ROOT;
  const currentAuthority = await captureCurrentComparisonAuthority(
    workspaceRoot,
    async (source) => {
      if (source.relativePath === SELECTOR_SOURCE_PATH) {
        await options.beforeSelectorOpen?.(source);
      }
      await options.beforeComparisonSourceOpen?.(source);
    },
  );
  if (
    comparisonAuthoritySha256(currentAuthority.sources) !== EXPECTED_SHADOW_AFFECTED_SELECTOR_SHA256
  ) {
    fail(
      "AFFECTED_PROMOTION_SUCCESSOR_AUTHORITY_DRIFT",
      "Current comparison-source receipts do not reproduce the reviewed M09-T13 successor.",
    );
  }
  const selectorBytes = capturedSourceBytes(currentAuthority, SELECTOR_SOURCE_PATH);
  validateSelectorPatchSet(selectorBytes);
  const currentInventory = createExhaustiveWorkloadInventory();
  if (
    currentInventory.inventorySha256 !== EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256 ||
    currentInventory.workloadCount !== 198 ||
    currentInventory.proofUnitCount !== 94
  ) {
    fail(
      "AFFECTED_PROMOTION_SUCCESSOR_AUTHORITY_DRIFT",
      "The current workload graph is not the exact reviewed M09-T13 append-only successor.",
    );
  }
  const currentProofPairClasses = currentInventory.proofUnits.reduce(
    (counts, { id }) => {
      counts[classifyProofPairState(id).barrier ? "barrier" : "ordinary"] += 1;
      return counts;
    },
    { ordinary: 0, barrier: 0 },
  );
  if (currentProofPairClasses.ordinary !== 83 || currentProofPairClasses.barrier !== 11) {
    fail(
      "AFFECTED_PROMOTION_SUCCESSOR_AUTHORITY_DRIFT",
      "The current M09-T13 proof-pair authority is not exactly 83 ordinary and 11 barrier pairs.",
    );
  }
  const diagnosticsClosure = createAffectedImpactClosure(["desen-app-node-linked-diagnostics"]);
  if (
    !isDeepStrictEqual(diagnosticsClosure.ownerProofUnitIds, [
      "desen-app-node-linked-diagnostics",
    ]) ||
    diagnosticsClosure.proofUnitCount !== 62 ||
    diagnosticsClosure.workloadCount !== 134 ||
    diagnosticsClosure.impactSha256 !==
      "9cb1af988b5a6c400ebe8e2123bb9c1bbbac3ac529621cee697ce3f93a0bea9d"
  ) {
    fail(
      "AFFECTED_PROMOTION_SUCCESSOR_AUTHORITY_DRIFT",
      "The current M09-T13 affected closure is not exactly 62 proof units and 134 workloads.",
    );
  }
  const liveRunnerAuthority = await createRunnerAuthority(workspaceRoot, currentAuthority);
  const liveProofReaderCheckpoint = await verifyProofReaderCheckpoints({ workspaceRoot });
  validateAffectedSelectorPromotionLiveCheckpoint(liveProofReaderCheckpoint);
  const currentPromotedAuthorities = Object.freeze({
    selectorSha256: EXPECTED_SHADOW_AFFECTED_SELECTOR_SHA256,
    ownershipSha256: EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256,
    impactGraphSha256: EXPECTED_AFFECTED_IMPACT_GRAPH_SHA256,
    thresholdSha256: EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256,
    inventorySha256: EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
    selectionEquivalenceSha256: receipt.promotedAuthorities.selectionEquivalenceSha256,
    runnerAuthoritySha256: liveRunnerAuthority.authoritySha256,
  });
  const verified = Object.freeze({
    ...receipt,
    promotedAuthorities: currentPromotedAuthorities,
    bytes: bytes.length,
    sha256: sha256(bytes),
  });
  VERIFIED_PROMOTION_RECEIPTS.set(
    verified,
    Object.freeze({
      ownershipDelta: evidence.selectionSemanticsEquivalence.ownershipDelta,
    }),
  );
  return verified;
}

/**
 * Projects the independently authenticated live checkpoint receipt into the exact cutover schema.
 * Production always obtains this receipt directly from verifyProofReaderCheckpoints; callers
 * cannot inject a replacement through verifyAffectedSelectorPromotionEvidence options.
 */
export function validateAffectedSelectorPromotionLiveCheckpoint(liveReceipt) {
  const projection =
    liveReceipt !== null && typeof liveReceipt === "object" && !Array.isArray(liveReceipt)
      ? {
          profile: liveReceipt.profile,
          sequence: liveReceipt.checkpoints,
          headSha256: liveReceipt.headSha256,
          frozenArtifactCount: liveReceipt.frozenArtifacts,
          currentReaderCount: liveReceipt.currentReaders,
          liveVerification: liveReceipt.status,
        }
      : null;
  if (!isDeepStrictEqual(projection, M09_T13_PROOF_READER_CHECKPOINT)) {
    fail(
      "AFFECTED_PROMOTION_CUTOVER_DRIFT",
      "Promotion evidence does not match the live proof-reader checkpoint authority.",
      { expected: M09_T13_PROOF_READER_CHECKPOINT, actual: projection },
    );
  }
  return liveReceipt;
}

/**
 * Binds the authenticated promotion evidence to the exact live Git boundary before REQUIRED
 * selection can be minted. The evidence file alone cannot assert a tracked-tree delta.
 */
export function validateAffectedSelectorPromotionBoundary(promotionReceipt, rawBoundary) {
  const verified = VERIFIED_PROMOTION_RECEIPTS.get(promotionReceipt);
  if (!verified) {
    fail(
      "AFFECTED_PROMOTION_RECEIPT_UNTRUSTED",
      "Promotion applicability requires the process-local verified evidence receipt.",
    );
  }
  // Authenticity is checked outside the fallback classification. A caller-created or cloned
  // boundary must never gain even fallback authority.
  const boundary = validateAffectedChangeBoundaryReceipt(rawBoundary);
  let authority = PROMOTION_BOUNDARY_AUTHORITIES.EXHAUSTIVE_FALLBACK;
  if (boundary.selection === "AFFECTED") {
    try {
      const observed = createBoundaryOwnershipDelta(boundary);
      if (isDeepStrictEqual(observed, verified.ownershipDelta)) {
        authority = PROMOTION_BOUNDARY_AUTHORITIES.AFFECTED;
      }
    } catch {
      // A newly added, removed, or recategorized tracked path invalidates only the strict-subset
      // authority. The authenticated Git boundary remains suitable for a fail-closed exhaustive
      // fallback; the promoted selector must prove that outcome before any work can run.
      authority = PROMOTION_BOUNDARY_AUTHORITIES.EXHAUSTIVE_FALLBACK;
    }
  }
  VERIFIED_PROMOTION_BOUNDARIES.set(boundary, Object.freeze({ promotionReceipt, authority }));
  return boundary;
}

/** Admits only the exact boundary object bound to the exact verified promotion receipt. */
export function validateAffectedSelectorPromotedBoundary(rawBoundary, promotionReceipt) {
  const binding = VERIFIED_PROMOTION_BOUNDARIES.get(rawBoundary);
  if (binding?.promotionReceipt !== promotionReceipt) {
    fail(
      "AFFECTED_PROMOTION_BOUNDARY_UNTRUSTED",
      "Required selection refused an unbound or substituted affected boundary.",
    );
  }
  return rawBoundary;
}

/**
 * Closes the fallback binding after selection: ownership/path-set drift may produce only one
 * inert EXHAUSTIVE plan, never a REQUIRED affected subset.
 */
export function validateAffectedSelectorPromotedSelection(
  rawBoundary,
  promotionReceipt,
  rawSelection,
) {
  const binding = VERIFIED_PROMOTION_BOUNDARIES.get(rawBoundary);
  if (binding?.promotionReceipt !== promotionReceipt) {
    fail(
      "AFFECTED_PROMOTION_BOUNDARY_UNTRUSTED",
      "Required selection refused an unbound or substituted affected boundary.",
    );
  }
  if (
    binding.authority === PROMOTION_BOUNDARY_AUTHORITIES.EXHAUSTIVE_FALLBACK &&
    rawSelection?.effectiveScope !== "EXHAUSTIVE"
  ) {
    fail(
      "AFFECTED_PROMOTION_FALLBACK_WIDENED",
      "A drifted promotion boundary may authorize only exhaustive fallback.",
    );
  }
  return rawSelection;
}

export async function buildAffectedSelectorPromotionEvidence(controllerState) {
  if (
    controllerState?.profile !== "desen.ci.i07-04-multilane-controller.v1" ||
    controllerState?.repository !== EXPECTED_REPOSITORY ||
    controllerState?.frozenBaseRevision !== EXPECTED_BASE_REVISION ||
    controllerState?.target !== 20 ||
    controllerState?.halted !== null ||
    !Array.isArray(controllerState.ledger) ||
    controllerState.ledger.length !== 20 ||
    !Array.isArray(controllerState.slots) ||
    controllerState.slots.some(({ status }) => status !== "CAPTURED")
  ) {
    fail(
      "AFFECTED_PROMOTION_CONTROLLER_STATE_INVALID",
      "Controller state is not final 20/20 evidence.",
    );
  }
  const slotBySequence = new Map(controllerState.slots.map((slot) => [slot.sequence, slot]));
  const observations = controllerState.ledger.map((observation) => {
    const slot = slotBySequence.get(observation.sequence);
    const qualityReceipt = observation.qualityJob.receipt;
    const affectedReceipt = observation.shadowJob.receipt;
    return {
      sequence: observation.sequence,
      lane: observation.lane,
      branch: slot.branch,
      pullRequest: observation.pullRequest,
      comparisonId: observation.comparisonId,
      runId: observation.runId,
      runAttempt: observation.runAttempt,
      runUrl: observation.runUrl,
      createdAt: observation.createdAt,
      completedAt: observation.completedAt,
      baseRevision: observation.pullRequestBaseRevision,
      headRevision: observation.pullRequestHeadRevision,
      mergeRevision: observation.mergeRevision,
      quality: {
        jobId: observation.qualityJob.jobId,
        jobUrl: observation.qualityJob.jobUrl,
        startedAt: observation.qualityJob.startedAt,
        completedAt: observation.qualityJob.completedAt,
        conclusion: observation.qualityJob.conclusion,
        receiptSha256: sha256(JSON.stringify(qualityReceipt)),
        status: qualityReceipt.status,
        authority: qualityReceipt.authority,
        scope: qualityReceipt.scope,
        revision: qualityReceipt.revision,
        planSha256: qualityReceipt.planSha256,
        inventorySha256: qualityReceipt.inventorySha256,
        observedClosedCount: qualityReceipt.observedClosedCount,
        stepCount: qualityReceipt.stepCount,
        proofPairCount: qualityReceipt.proofPairCount,
        trackedFileCount: qualityReceipt.workspace.trackedFileCount,
        trackedBytes: qualityReceipt.workspace.trackedBytes,
        workspaceUnchanged: qualityReceipt.workspace.unchanged,
        cleanInputStatus: qualityReceipt.cleanInput.status,
        cleanInputRevision: qualityReceipt.cleanInput.revision,
        cleanInputRevisionMatches: qualityReceipt.cleanInput.revisionMatches,
        cleanInputClean: qualityReceipt.cleanInput.clean,
      },
      affected: {
        jobId: observation.shadowJob.jobId,
        jobUrl: observation.shadowJob.jobUrl,
        startedAt: observation.shadowJob.startedAt,
        completedAt: observation.shadowJob.completedAt,
        conclusion: observation.shadowJob.conclusion,
        receiptSha256: sha256(JSON.stringify(affectedReceipt)),
        status: affectedReceipt.status,
        authority: affectedReceipt.authority,
        requestedScope: affectedReceipt.requestedScope,
        effectiveScope: affectedReceipt.effectiveScope,
        decisionCategory: affectedReceipt.decisionCategory,
        reason: affectedReceipt.reason,
        executionRevision: affectedReceipt.executionRevision,
        selectorSha256: affectedReceipt.selectorSha256,
        ownershipSha256: affectedReceipt.ownershipSha256,
        impactGraphSha256: affectedReceipt.impactGraphSha256,
        thresholdSha256: affectedReceipt.thresholdSha256,
        inventorySha256: affectedReceipt.inventorySha256,
        planSha256: affectedReceipt.planSha256,
        changeSetSha256: affectedReceipt.changeSetSha256,
        strictSubset: affectedReceipt.strictSubset,
        freshExecution: affectedReceipt.freshExecution,
        cachedSuccessRead: affectedReceipt.cachedSuccessRead,
        selectedWorkloadCount: affectedReceipt.selectedWorkloadCount,
        selectedProofUnitCount: affectedReceipt.selectedProofUnitCount,
        observedClosedCount: affectedReceipt.observedClosedCount,
      },
    };
  });
  const authorities = controllerState.authorities;
  const currentAuthority = await captureCurrentComparisonAuthority(WORKSPACE_ROOT);
  const selectionSemanticsEquivalence = await createSelectionSemanticsEquivalence(
    WORKSPACE_ROOT,
    currentAuthority,
  );
  const runnerAuthority = await createRunnerAuthority(WORKSPACE_ROOT, currentAuthority);
  const evidence = {
    schemaVersion: 1,
    profile: AFFECTED_SELECTOR_PROMOTION_EVIDENCE_PROFILE,
    task: "I07-04",
    date: "2026-08-12",
    repository: `https://github.com/${EXPECTED_REPOSITORY}`,
    campaign: {
      frozenBaseRevision: EXPECTED_BASE_REVISION,
      startedAt: observations[0].createdAt,
      completedAt: observations.at(-1).completedAt,
      lanes: [...EXPECTED_LANES],
      pullRequests: [...EXPECTED_PULL_REQUESTS],
      comparisonOrder: "GITHUB_CREATED_AT_THEN_RUN_ID",
    },
    authorities: {
      selectorSha256: authorities.selectorSha256,
      ownershipSha256: authorities.ownershipSha256,
      impactGraphSha256: authorities.impactGraphSha256,
      thresholdSha256: authorities.thresholdSha256,
      inventorySha256: authorities.inventorySha256,
      requiredPlanSha256: authorities.requiredPlanSha256,
      requiredInventorySha256: authorities.requiredInventorySha256,
    },
    promotedAuthorities: {
      selectorSha256: EXPECTED_SHADOW_AFFECTED_SELECTOR_SHA256,
      ownershipSha256: EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256,
      impactGraphSha256: EXPECTED_AFFECTED_IMPACT_GRAPH_SHA256,
      thresholdSha256: EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256,
      inventorySha256: EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
      selectionEquivalenceSha256: selectionSemanticsEquivalence.equivalenceSha256,
      runnerAuthoritySha256: runnerAuthority.authoritySha256,
    },
    selectionSemanticsEquivalence,
    runnerAuthority,
    threshold: {
      minimumConsecutiveEligibleComparisons: 20,
      eligibleComparisons: 20,
      consecutiveEligibleComparisons: 20,
      falseNegatives: 0,
      ownershipCategoriesCovered: 8,
      decisionCategoriesCovered: 8,
      sameRevisionWithinComparison: true,
      freshHostedExecution: true,
      cachedSuccessAllowed: false,
      satisfied: true,
    },
    controller: {
      rawStatePath: ".i07-04/controller-state.json",
      rawStateBytes: EXPECTED_CONTROLLER_STATE_BYTES,
      rawStateSha256: EXPECTED_CONTROLLER_STATE_SHA256,
      controllerSha256: EXPECTED_CONTROLLER_SHA256,
      controllerTestSha256: EXPECTED_CONTROLLER_TEST_SHA256,
      launcherSha256: EXPECTED_LAUNCHER_SHA256,
      launcherTestSha256: EXPECTED_LAUNCHER_TEST_SHA256,
      reservationsSha256: EXPECTED_RESERVATIONS_SHA256,
      controllerTests: 16,
      combinedTests: 33,
      independentCleanReviews: 2,
    },
    historicalCampaignSha256: EXPECTED_HISTORICAL_CAMPAIGN_SHA256,
    observations,
    decision: {
      status: "PROMOTION_AUTHORIZED",
      affectedPromotionAuthorized: true,
      eligiblePullRequests: "REQUIRED_AFFECTED",
      unsafePullRequests: "REQUIRED_EXHAUSTIVE",
      main: "REQUIRED_EXHAUSTIVE",
      release: "REQUIRED_EXHAUSTIVE",
      manualAudit: "REQUIRED_EXHAUSTIVE",
      legacyRollbackRetained: true,
    },
    cutover: {
      status: "PENDING_HOSTED_CUTOVER",
      cleanup: null,
      main: null,
      affectedCanary: null,
      proofReaderCheckpoint: { ...G07_PROOF_READER_CHECKPOINT },
      infrastructureDebt: expectedCutoverDebt("REMOVED_PENDING_HOSTED_PROOF"),
    },
    nonClaims: [
      "The historical I07-03 SHADOW receipts do not become REQUIRED receipts retroactively.",
      "This evidence does not authorize affected execution for forks or unsafe change classes.",
      "Main, release, and manual-audit execution remain fresh REQUIRED + EXHAUSTIVE.",
      "The retained legacy rollback is not removed before I07-05 and Gate E.",
      "G07 and I07-04 remain open until cutover, debt cleanup, and hosted closure evidence pass.",
    ],
  };
  exactString(
    calculateAffectedSelectorHistoricalCampaignSha256(evidence),
    EXPECTED_HISTORICAL_CAMPAIGN_SHA256,
    "built historical campaign projection",
  );
  return evidence;
}
