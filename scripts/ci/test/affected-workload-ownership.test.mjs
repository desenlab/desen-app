import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  AFFECTED_OWNERSHIP_CATEGORIES,
  AFFECTED_OWNERSHIP_DISPOSITIONS,
  EXPECTED_AFFECTED_PROOF_OWNED_PATH_COUNT,
  EXPECTED_AFFECTED_TRACKED_PATH_COUNT,
  EXPECTED_AFFECTED_TRACKED_PATH_SET_SHA256,
  EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256,
  AffectedWorkloadOwnershipError,
  calculateAffectedTrackedPathSetSha256,
  calculateAffectedWorkloadOwnershipReview as calculateAffectedWorkloadOwnershipReviewRaw,
  calculateAffectedWorkloadOwnershipSha256,
  createAffectedWorkloadOwnership,
  resolveAffectedWorkloadOwner,
  validateAffectedWorkloadOwnership,
} from "../affected-workload-ownership.mjs";
import { createExhaustiveWorkloadInventory } from "../exhaustive-workload-inventory.mjs";

const EXEC_FILE = promisify(execFileCallback);
const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../..");
const CI_04_CATEGORY_COUNTS = Object.freeze({
  PROOF_UNIT: 210,
  CI_POLICY: 48,
  DEPENDENCY_POLICY: 32,
  FROZEN_INPUT: 154,
  PACKAGE_OR_APPLICATION: 556,
  SHARED_PROOF_INFRASTRUCTURE: 292,
  PROJECT_DOCUMENTATION: 149,
  REPOSITORY_POLICY: 11,
});
const EXPECTED_CATEGORY_COUNTS = Object.freeze({
  ...CI_04_CATEGORY_COUNTS,
  PROOF_UNIT: 246,
  CI_POLICY: 50,
  DEPENDENCY_POLICY: 39,
  FROZEN_INPUT: 172,
  PACKAGE_OR_APPLICATION: 805,
  SHARED_PROOF_INFRASTRUCTURE: 420,
  PROJECT_DOCUMENTATION: 177,
});
const M10A_T16_SUCCESSOR_PATHS = Object.freeze([
  "apps/desen-app/test/authoring-variants.test.ts",
  "apps/desen-app/test/authoring-visual-styles.test.ts",
  "docs/proof/M10A-T16.md",
  "scripts/lib/m10a-t16-legacy-input-receipts.mjs",
]);
const M10A_T17_SUCCESSOR_PATHS = Object.freeze([
  "apps/desen-app/src/design-system-explorer.ts",
  "apps/desen-app/test/design-system-explorer.test.ts",
  "docs/proof/M10A-T17.md",
  "scripts/lib/m10a-t17-legacy-input-receipts.mjs",
]);
const SEC_01_SUCCESSOR_PATHS = Object.freeze([
  "apps/control-plane-api/test/dependency-security.test.ts",
  "docs/proof/SEC-01-DEPENDENCY-SECURITY.md",
]);
const SEC_02_SUCCESSOR_PATH = "docs/proof/SEC-02-DEVELOPMENT-DEPENDENCY-SECURITY.md";
const CI_04_SUCCESSOR_PATHS = Object.freeze([
  "scripts/ci/run-required-sharded-quality-gate.mjs",
  "scripts/ci/sharded-quality-gate-authority.mjs",
  "scripts/ci/test/sharded-quality-gate.test.mjs",
]);
const T06_SUCCESSOR_PATHS = Object.freeze([
  "apps/desen-app-browser-e2e/invalid-publication-playwright.config.ts",
  "apps/desen-app-browser-e2e/invalid-publication.pw.ts",
  "apps/desen-app/src/authoring-source-draft.ts",
  "apps/desen-app/src/source-draft-controls.tsx",
  "apps/desen-app/test/authoring-source-draft.test.ts",
  "apps/desen-app/test/source-draft-application.test.tsx",
  "docs/adr/0021-invalid-source-draft-publication-boundary.md",
  "docs/proof/DESEN-APP-INVALID-PUBLICATION.md",
  "docs/proof/artifacts/desen-app-0.1.0-invalid-publication.json",
  "scripts/generate-desen-app-invalid-publication-proof.mjs",
  "scripts/lib/desen-app-invalid-publication-proof.mjs",
  "scripts/verify-desen-app-invalid-publication.mjs",
  "tests/desen-app-invalid-publication.test.mjs",
]);

const T07_SUCCESSOR_PATHS = Object.freeze([
  "apps/desen-app-browser-e2e/restart-recovery-playwright.config.ts",
  "apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
  "apps/desen-app-browser-e2e/restart-recovery.pw.ts",
  "docs/proof/DESEN-APP-LAST-KNOWN-GOOD-RECOVERY.md",
  "docs/proof/artifacts/desen-app-0.1.0-last-known-good-recovery.json",
  "scripts/generate-desen-app-last-known-good-recovery-proof.mjs",
  "scripts/lib/desen-app-last-known-good-recovery-proof.mjs",
  "scripts/verify-desen-app-last-known-good-recovery.mjs",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-recovery-server-reviewed-roots/apps/control-plane-api/dist/index.js",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-recovery-server-reviewed-roots/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-recovery-server-reviewed-roots/apps/desen-app/dev/local-publication-host.mjs",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-recovery-server-reviewed-roots/apps/reference-host-web-server/dist/index.js",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-recovery-server-reviewed-roots/packages/protocol/dist/index.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-non-recovery-server-imports-protocol/apps/desen-app-browser-e2e/proof-application.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-non-recovery-server-imports-protocol/packages/protocol/dist/index.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-app-source/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-app-source/apps/desen-app/src/application.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-control-plane-private/apps/control-plane-api/dist/runtime-activation-sqlite-internal.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-control-plane-private/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-protocol-private/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-protocol-private/packages/protocol/dist/private.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-publisher/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-publisher/packages/publisher/src/index.ts",
  "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-reference-host-private/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-reference-host-private/apps/reference-host-web-server/dist/private.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-unreviewed-dev-module/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-unreviewed-dev-module/apps/desen-app/dev/local-publication-private.mjs",
  "tests/desen-app-last-known-good-recovery.test.mjs",
]);

const T09_SUCCESSOR_PATHS = Object.freeze([
  "scripts/lib/runtime-core-baseline-proof.mjs",
  "scripts/generate-runtime-core-baseline.mjs",
  "scripts/verify-runtime-core-baseline.mjs",
  "tests/runtime-core-baseline.test.mjs",
  "docs/proof/artifacts/runtime-core-baseline.json",
  "docs/proof/RUNTIME-CORE-BASELINE.md",
]);

const G10_SUCCESSOR_PATHS = Object.freeze([
  "docs/proof/DESEN-APP-M10-GATE.md",
  "docs/proof/artifacts/desen-app-0.1.0-m10-gate.json",
  "scripts/generate-m10-gate-proof.mjs",
  "scripts/lib/m10-gate-proof.mjs",
  "scripts/verify-m10-gate.mjs",
  "tests/m10-gate.test.mjs",
]);

const M10A_T01_SUCCESSOR_PATHS = Object.freeze([
  "apps/starter-catalog-web-proof/README.md",
  "apps/starter-catalog-web-proof/authoring.html",
  "apps/starter-catalog-web-proof/host.html",
  "apps/starter-catalog-web-proof/package.json",
  "apps/starter-catalog-web-proof/playwright.config.ts",
  "apps/starter-catalog-web-proof/proof-contract.ts",
  "apps/starter-catalog-web-proof/proof-reporter.ts",
  "apps/starter-catalog-web-proof/scripts/serve-proof.mjs",
  "apps/starter-catalog-web-proof/src/application.css",
  "apps/starter-catalog-web-proof/src/authoring/index.tsx",
  "apps/starter-catalog-web-proof/src/authoring/publications.ts",
  "apps/starter-catalog-web-proof/src/authoring/source-fixtures.ts",
  "apps/starter-catalog-web-proof/src/host/index.tsx",
  "apps/starter-catalog-web-proof/src/shared/proof-channel.ts",
  "apps/starter-catalog-web-proof/src/shared/runtime-surface.tsx",
  "apps/starter-catalog-web-proof/starter-catalog-web.pw.ts",
  "apps/starter-catalog-web-proof/tsconfig.json",
  "apps/starter-catalog-web-proof/vite.config.ts",
  "docs/adr/0023-design-first-authoring-and-design-system-workbench.md",
  "docs/plan/DESIGN-SYSTEM-WORKBENCH.md",
  "docs/plan/M10A-IMPLEMENTATION-PLAN.md",
  "docs/plan/M10A-TASK-CONTRACTS.md",
  "docs/proof/M10A-T01.md",
  "docs/proof/artifacts/m10a-t01.json",
  "packages/editor-core/test/subtree-insert.test.ts",
  "packages/editor-core/test/subtree-insert.types.ts",
  "packages/starter-catalog-web/README.md",
  "packages/starter-catalog-web/catalog.json",
  "packages/starter-catalog-web/package.json",
  "packages/starter-catalog-web/scripts/copy-styles.mjs",
  "packages/starter-catalog-web/src/contracts.ts",
  "packages/starter-catalog-web/src/index.ts",
  "packages/starter-catalog-web/src/neutral.module.css",
  "packages/starter-catalog-web/src/react-adapters.tsx",
  "packages/starter-catalog-web/src/styles.d.ts",
  "packages/starter-catalog-web/src/templates.ts",
  "packages/starter-catalog-web/test/contracts.test.ts",
  "packages/starter-catalog-web/test/contracts.types.ts",
  "packages/starter-catalog-web/test/public-api.types.ts",
  "packages/starter-catalog-web/test/react-adapters.test.tsx",
  "packages/starter-catalog-web/tsconfig.build.json",
  "packages/starter-catalog-web/tsconfig.json",
  "scripts/generate-m10a-t01-proof.mjs",
  "scripts/lib/m10a-t01-proof.mjs",
  "scripts/verify-m10a-t01.mjs",
  "tests/boundaries/fixtures/allowed-starter-runtime-react/packages/runtime-react/src/index.ts",
  "tests/boundaries/fixtures/allowed-starter-runtime-react/packages/starter-catalog-web/src/index.ts",
  "tests/boundaries/fixtures/neutral-imports-starter/packages/editor-core/src/index.ts",
  "tests/boundaries/fixtures/neutral-imports-starter/packages/starter-catalog-web/src/index.ts",
  "tests/boundaries/fixtures/starter-imports-app/apps/desen-app/src/index.ts",
  "tests/boundaries/fixtures/starter-imports-app/packages/starter-catalog-web/src/index.ts",
  "tests/boundaries/fixtures/starter-imports-editor-core/packages/editor-core/src/index.ts",
  "tests/boundaries/fixtures/starter-imports-editor-core/packages/starter-catalog-web/src/index.ts",
  "tests/boundaries/fixtures/starter-proof-host-imports-publisher/apps/starter-catalog-web-proof/src/host/index.ts",
  "tests/boundaries/fixtures/starter-proof-host-imports-publisher/packages/publisher/src/index.ts",
  "tests/boundaries/fixtures/starter-proof-imports-app/apps/desen-app/src/index.ts",
  "tests/boundaries/fixtures/starter-proof-imports-app/apps/starter-catalog-web-proof/src/authoring/index.ts",
  "tests/m10a-t01.test.mjs",
]);

const M10A_T02_SUCCESSOR_PATHS = Object.freeze([
  "docs/proof/M10A-T02.md",
  "docs/proof/artifacts/m10a-t02.json",
  "packages/design-system-core/README.md",
  "packages/design-system-core/package.json",
  "packages/design-system-core/src/diagnostics.ts",
  "packages/design-system-core/src/index.ts",
  "packages/design-system-core/src/inert-json.ts",
  "packages/design-system-core/src/project-migrations.ts",
  "packages/design-system-core/src/project-record.ts",
  "packages/design-system-core/src/token-document.ts",
  "packages/design-system-core/src/token-resolver.ts",
  "packages/design-system-core/src/token-types.ts",
  "packages/design-system-core/test/project-migrations.test.ts",
  "packages/design-system-core/test/project-migrations.types.ts",
  "packages/design-system-core/test/project-record.test.ts",
  "packages/design-system-core/test/project-record.types.ts",
  "packages/design-system-core/test/public-package.mjs",
  "packages/design-system-core/test/public-package.types.mts",
  "packages/design-system-core/test/token-document.test.ts",
  "packages/design-system-core/test/token-document.types.ts",
  "packages/design-system-core/test/token-resolver.test.ts",
  "packages/design-system-core/test/token-resolver.types.ts",
  "packages/design-system-core/tsconfig.build.json",
  "packages/design-system-core/tsconfig.json",
  "packages/design-system-core/tsconfig.public-package.json",
  "scripts/generate-m10a-t02-proof.mjs",
  "scripts/lib/m10a-t02-proof.mjs",
  "scripts/verify-m10a-t02.mjs",
  "tests/boundaries/fixtures/allowed-design-system-editor-core/packages/design-system-core/src/index.ts",
  "tests/boundaries/fixtures/allowed-design-system-editor-core/packages/editor-core/src/index.ts",
  "tests/boundaries/fixtures/design-system-imports-node/packages/design-system-core/src/index.ts",
  "tests/boundaries/fixtures/design-system-imports-runtime-core/packages/design-system-core/src/index.ts",
  "tests/boundaries/fixtures/design-system-imports-runtime-core/packages/runtime-core/src/index.ts",
  "tests/boundaries/fixtures/design-system-imports-validator/packages/design-system-core/src/index.ts",
  "tests/boundaries/fixtures/design-system-imports-validator/packages/validator/src/index.ts",
  "tests/boundaries/fixtures/runtime-core-imports-design-system/packages/design-system-core/src/index.ts",
  "tests/boundaries/fixtures/runtime-core-imports-design-system/packages/runtime-core/src/index.ts",
  "tests/m10a-t02.test.mjs",
]);

const M10A_T03_SUCCESSOR_PATHS = Object.freeze([
  "apps/design-system-workbench-proof/README.md",
  "apps/design-system-workbench-proof/design-system-workbench.pw.ts",
  "apps/design-system-workbench-proof/index.html",
  "apps/design-system-workbench-proof/package.json",
  "apps/design-system-workbench-proof/playwright.config.ts",
  "apps/design-system-workbench-proof/proof-contract.ts",
  "apps/design-system-workbench-proof/proof-reporter.ts",
  "apps/design-system-workbench-proof/src/main.tsx",
  "apps/design-system-workbench-proof/src/workbench-application.tsx",
  "apps/design-system-workbench-proof/src/workbench.css",
  "apps/design-system-workbench-proof/tsconfig.json",
  "apps/design-system-workbench-proof/vite.config.ts",
  "docs/proof/M10A-T03.md",
  "docs/proof/artifacts/m10a-t03.json",
  "packages/design-system-authoring/README.md",
  "packages/design-system-authoring/package.json",
  "packages/design-system-authoring/src/reviewed-dtcg-compatibility.ts",
  "packages/design-system-authoring/src/index.ts",
  "packages/design-system-authoring/src/inert-json.ts",
  "packages/design-system-authoring/src/neutral-theme.ts",
  "packages/design-system-authoring/src/theme-authoring.ts",
  "packages/design-system-authoring/test/public-package.mjs",
  "packages/design-system-authoring/test/public-package.types.mts",
  "packages/design-system-authoring/test/theme-authoring.test.ts",
  "packages/design-system-authoring/tsconfig.build.json",
  "packages/design-system-authoring/tsconfig.json",
  "packages/design-system-authoring/tsconfig.public-package.json",
  "scripts/generate-m10a-t03-proof.mjs",
  "scripts/lib/m10a-t03-proof.mjs",
  "scripts/verify-m10a-t03.mjs",
  "tests/boundaries/fixtures/allowed-design-system-authoring-foundations/packages/design-system-authoring/src/index.ts",
  "tests/boundaries/fixtures/allowed-design-system-authoring-foundations/packages/design-system-core/src/index.ts",
  "tests/boundaries/fixtures/allowed-design-system-authoring-foundations/packages/protocol/src/index.ts",
  "tests/boundaries/fixtures/allowed-design-system-workbench-authoring/apps/design-system-workbench-proof/src/index.ts",
  "tests/boundaries/fixtures/allowed-design-system-workbench-authoring/packages/design-system-authoring/src/index.ts",
  "tests/boundaries/fixtures/design-system-authoring-imports-node/packages/design-system-authoring/src/index.ts",
  "tests/boundaries/fixtures/design-system-authoring-imports-runtime-core/packages/design-system-authoring/src/index.ts",
  "tests/boundaries/fixtures/design-system-authoring-imports-runtime-core/packages/runtime-core/src/index.ts",
  "tests/boundaries/fixtures/design-system-workbench-imports-app/apps/desen-app/src/index.ts",
  "tests/boundaries/fixtures/design-system-workbench-imports-app/apps/design-system-workbench-proof/src/index.ts",
  "tests/boundaries/fixtures/design-system-workbench-imports-core/apps/design-system-workbench-proof/src/index.ts",
  "tests/boundaries/fixtures/design-system-workbench-imports-core/packages/design-system-core/src/index.ts",
  "tests/m10a-t03.test.mjs",
]);
const M10A_T04_SUCCESSOR_PATHS = Object.freeze([
  "docs/proof/M10A-T04.md",
  "docs/proof/artifacts/m10a-t04.json",
  "packages/design-system-release/README.md",
  "packages/design-system-release/package.json",
  "packages/design-system-release/src/index.ts",
  "packages/design-system-release/src/release.ts",
  "packages/design-system-release/test/public-package.mjs",
  "packages/design-system-release/test/public-package.types.mts",
  "packages/design-system-release/test/release.test.ts",
  "packages/design-system-release/tsconfig.build.json",
  "packages/design-system-release/tsconfig.json",
  "packages/design-system-release/tsconfig.public-package.json",
  "scripts/generate-m10a-t04-proof.mjs",
  "scripts/lib/m10a-t04-proof.mjs",
  "scripts/verify-m10a-t04.mjs",
  "tests/boundaries/fixtures/allowed-design-system-release-foundations/packages/design-system-core/src/index.ts",
  "tests/boundaries/fixtures/allowed-design-system-release-foundations/packages/design-system-release/src/index.ts",
  "tests/boundaries/fixtures/allowed-design-system-release-foundations/packages/protocol/src/index.ts",
  "tests/boundaries/fixtures/design-system-release-imports-node/packages/design-system-release/src/index.ts",
  "tests/boundaries/fixtures/design-system-release-imports-runtime-core/packages/design-system-release/src/index.ts",
  "tests/boundaries/fixtures/design-system-release-imports-runtime-core/packages/runtime-core/src/index.ts",
  "tests/m10a-t04.test.mjs",
]);
const M10A_T05_SUCCESSOR_PATHS = Object.freeze([
  "docs/proof/M10A-T05.md",
  "docs/proof/artifacts/m10a-t05.json",
  "packages/starter-catalog-web/src/layout-content-contracts.ts",
  "packages/starter-catalog-web/test/layout-content-adapters.test.tsx",
  "packages/starter-catalog-web/test/public-package.mjs",
  "packages/starter-catalog-web/test/public-package.types.mts",
  "packages/starter-catalog-web/tsconfig.public-package.json",
  "scripts/generate-m10a-t05-proof.mjs",
  "scripts/lib/m10a-t05-proof.mjs",
  "scripts/verify-m10a-t05.mjs",
  "tests/m10a-t05.test.mjs",
]);
const M10A_T06_SUCCESSOR_PATHS = Object.freeze([
  "apps/starter-catalog-web-proof/.gitignore",
  "apps/starter-catalog-web-proof/scripts/serve-t06-proof.mjs",
  "apps/starter-catalog-web-proof/src/t06-application.css",
  "apps/starter-catalog-web-proof/src/t06-authoring/index.tsx",
  "apps/starter-catalog-web-proof/src/t06-authoring/publications.ts",
  "apps/starter-catalog-web-proof/src/t06-authoring/source-fixtures.ts",
  "apps/starter-catalog-web-proof/src/t06-host/index.tsx",
  "apps/starter-catalog-web-proof/src/t06-shared/proof-channel.ts",
  "apps/starter-catalog-web-proof/starter-catalog-web-t06.pw.ts",
  "apps/starter-catalog-web-proof/t06-authoring.html",
  "apps/starter-catalog-web-proof/t06-host.html",
  "apps/starter-catalog-web-proof/t06-playwright.config.ts",
  "apps/starter-catalog-web-proof/t06-proof-contract.ts",
  "apps/starter-catalog-web-proof/t06-proof-reporter.ts",
  "apps/starter-catalog-web-proof/t06-vite.config.ts",
  "docs/proof/M10A-T06.md",
  "docs/proof/artifacts/m10a-t06.json",
  "packages/starter-catalog-web/src/form-control-contracts.ts",
  "packages/starter-catalog-web/test/form-control-adapters.test.tsx",
  "scripts/generate-m10a-t06-proof.mjs",
  "scripts/lib/m10a-t06-proof.mjs",
  "scripts/verify-m10a-t06.mjs",
  "scripts/write-starter-catalog.mjs",
  "tests/m10a-t06.test.mjs",
]);
const M10A_T07_SUCCESSOR_PATHS = Object.freeze([
  "apps/starter-catalog-web-proof/scripts/serve-t07-proof.mjs",
  "apps/starter-catalog-web-proof/src/t07-application.css",
  "apps/starter-catalog-web-proof/src/t07-authoring/index.tsx",
  "apps/starter-catalog-web-proof/src/t07-authoring/publications.ts",
  "apps/starter-catalog-web-proof/src/t07-authoring/source-fixtures.ts",
  "apps/starter-catalog-web-proof/src/t07-host/index.tsx",
  "apps/starter-catalog-web-proof/src/t07-shared/proof-channel.ts",
  "apps/starter-catalog-web-proof/starter-catalog-web-t07.pw.ts",
  "apps/starter-catalog-web-proof/t07-authoring.html",
  "apps/starter-catalog-web-proof/t07-host.html",
  "apps/starter-catalog-web-proof/t07-playwright.config.ts",
  "apps/starter-catalog-web-proof/t07-proof-contract.ts",
  "apps/starter-catalog-web-proof/t07-proof-reporter.ts",
  "apps/starter-catalog-web-proof/t07-vite.config.ts",
  "docs/proof/M10A-T07.md",
  "docs/proof/artifacts/m10a-t07.json",
  "packages/starter-catalog-web/src/selection-numeric-contracts.ts",
  "packages/starter-catalog-web/test/selection-numeric-adapters.test.tsx",
  "scripts/generate-m10a-t07-proof.mjs",
  "scripts/lib/m10a-t07-proof.mjs",
  "scripts/verify-m10a-t07.mjs",
  "tests/m10a-t07.test.mjs",
]);

const T08_SUCCESSOR_PATHS = Object.freeze([
  "apps/desen-app-browser-e2e/repeatable-demo-authoring.ts",
  "apps/desen-app-browser-e2e/repeatable-demo-playwright.config.ts",
  "apps/desen-app-browser-e2e/repeatable-demo-proof-server.mjs",
  "apps/desen-app-browser-e2e/repeatable-demo.pw.ts",
  "apps/desen-app/dev/local-demo-host.mjs",
  "apps/desen-app/dev/local-demo-host.test.mjs",
  "apps/desen-app/dev/local-demo.mjs",
  "docs/adr/0022-repeatable-local-demo-composition.md",
  "docs/proof/DESEN-APP-REPEATABLE-DEMO.md",
  "docs/proof/artifacts/desen-app-0.1.0-repeatable-demo.json",
  "scripts/generate-desen-app-repeatable-demo-proof.mjs",
  "scripts/lib/desen-app-repeatable-demo-proof.mjs",
  "scripts/verify-desen-app-repeatable-demo.mjs",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-repeatable-demo-normal-launcher/apps/desen-app-browser-e2e/repeatable-demo-proof-server.mjs",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-repeatable-demo-normal-launcher/apps/desen-app/dev/local-demo-host.mjs",
  "tests/boundaries/fixtures/allowed-desen-app-browser-repeatable-authoring-protocol-root/apps/desen-app-browser-e2e/repeatable-demo-authoring.ts",
  "tests/boundaries/fixtures/allowed-desen-app-browser-repeatable-authoring-protocol-root/packages/protocol/dist/index.js",
  "tests/boundaries/fixtures/allowed-reference-host-sign-in-test-protocol-root/apps/reference-host-web/test/official-sign-in.test.tsx",
  "tests/boundaries/fixtures/allowed-reference-host-sign-in-test-protocol-root/packages/protocol/dist/index.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-non-repeatable-demo-imports-normal-launcher/apps/desen-app-browser-e2e/ordinary-proof.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-non-repeatable-demo-imports-normal-launcher/apps/desen-app/dev/local-demo-host.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-app-source/apps/desen-app-browser-e2e/repeatable-demo-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-app-source/apps/desen-app/src/application.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-control-plane-root/apps/control-plane-api/dist/index.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-control-plane-root/apps/desen-app-browser-e2e/repeatable-demo-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-editor-core/apps/desen-app-browser-e2e/repeatable-demo-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-editor-core/packages/editor-core/src/index.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-unreviewed-dev-module/apps/desen-app-browser-e2e/repeatable-demo-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-unreviewed-dev-module/apps/desen-app/dev/local-dev-host.mjs",
  "tests/boundaries/fixtures/desen-app-browser-non-repeatable-authoring-imports-protocol/apps/desen-app-browser-e2e/another-authoring.ts",
  "tests/boundaries/fixtures/desen-app-browser-non-repeatable-authoring-imports-protocol/packages/protocol/dist/index.js",
  "tests/boundaries/fixtures/desen-app-browser-repeatable-authoring-imports-editor-core/apps/desen-app-browser-e2e/repeatable-demo-authoring.ts",
  "tests/boundaries/fixtures/desen-app-browser-repeatable-authoring-imports-editor-core/packages/editor-core/src/index.js",
  "tests/boundaries/fixtures/desen-app-browser-repeatable-authoring-imports-protocol-private/apps/desen-app-browser-e2e/repeatable-demo-authoring.ts",
  "tests/boundaries/fixtures/desen-app-browser-repeatable-authoring-imports-protocol-private/packages/protocol/dist/private.js",
  "tests/boundaries/fixtures/reference-host-other-test-imports-protocol/apps/reference-host-web/test/another.test.tsx",
  "tests/boundaries/fixtures/reference-host-other-test-imports-protocol/packages/protocol/dist/index.js",
  "tests/boundaries/fixtures/reference-host-sign-in-test-imports-protocol-private/apps/reference-host-web/test/official-sign-in.test.tsx",
  "tests/boundaries/fixtures/reference-host-sign-in-test-imports-protocol-private/packages/protocol/dist/private.js",
  "tests/boundaries/fixtures/reference-host-sign-in-test-imports-publisher/apps/reference-host-web/test/official-sign-in.test.tsx",
  "tests/boundaries/fixtures/reference-host-sign-in-test-imports-publisher/packages/publisher/src/index.js",
  "tests/desen-app-repeatable-demo.test.mjs",
]);
const M10A_T08_SUCCESSOR_PATHS = Object.freeze([
  "apps/starter-catalog-web-proof/scripts/serve-t08-proof.mjs",
  "apps/starter-catalog-web-proof/src/t08-application.css",
  "apps/starter-catalog-web-proof/src/t08-authoring/index.tsx",
  "apps/starter-catalog-web-proof/src/t08-host/index.tsx",
  "apps/starter-catalog-web-proof/src/t08-shared/surface.tsx",
  "apps/starter-catalog-web-proof/starter-catalog-web-t08.pw.ts",
  "apps/starter-catalog-web-proof/t08-authoring.html",
  "apps/starter-catalog-web-proof/t08-host.html",
  "apps/starter-catalog-web-proof/t08-playwright.config.ts",
  "apps/starter-catalog-web-proof/t08-proof-contract.ts",
  "apps/starter-catalog-web-proof/t08-proof-reporter.ts",
  "apps/starter-catalog-web-proof/t08-vite.config.ts",
  "docs/proof/M10A-T08.md",
  "docs/proof/artifacts/m10a-t08.json",
  "packages/starter-catalog-web/src/overlay-disclosure-contracts.ts",
  "packages/starter-catalog-web/test/overlay-disclosure-adapters.test.tsx",
  "scripts/generate-m10a-t08-proof.mjs",
  "scripts/lib/m10a-t08-proof.mjs",
  "scripts/verify-m10a-t08.mjs",
  "tests/m10a-t08.test.mjs",
]);
const M10A_T09_SUCCESSOR_PATHS = Object.freeze([
  "apps/starter-catalog-web-proof/scripts/serve-t09-proof.mjs",
  "apps/starter-catalog-web-proof/src/t09-application.css",
  "apps/starter-catalog-web-proof/src/t09-authoring/index.tsx",
  "apps/starter-catalog-web-proof/src/t09-host/index.tsx",
  "apps/starter-catalog-web-proof/src/t09-shared/surface.tsx",
  "apps/starter-catalog-web-proof/starter-catalog-web-t09.pw.ts",
  "apps/starter-catalog-web-proof/t09-authoring.html",
  "apps/starter-catalog-web-proof/t09-host.html",
  "apps/starter-catalog-web-proof/t09-playwright.config.ts",
  "apps/starter-catalog-web-proof/t09-proof-contract.ts",
  "apps/starter-catalog-web-proof/t09-proof-reporter.ts",
  "apps/starter-catalog-web-proof/t09-vite.config.ts",
  "docs/proof/M10A-T09.md",
  "docs/proof/artifacts/m10a-t09.json",
  "packages/starter-catalog-web/src/data-display-feedback-contracts.ts",
  "packages/starter-catalog-web/test/data-display-feedback-adapters.test.tsx",
  "scripts/generate-m10a-t09-proof.mjs",
  "scripts/lib/m10a-t09-proof.mjs",
  "scripts/verify-m10a-t09.mjs",
  "tests/m10a-t09.test.mjs",
]);
const M10A_T10_SUCCESSOR_PATHS = Object.freeze([
  "apps/desen-app/src/project-lifecycle-navigation.ts",
  "apps/desen-app/src/project-lifecycle.ts",
  "apps/desen-app/src/starter-project.ts",
  "apps/desen-app/test/project-lifecycle-navigation.test.ts",
  "apps/desen-app/test/project-lifecycle.test.ts",
  "apps/desen-app/test/starter-project.test.ts",
  "docs/proof/M10A-T10.md",
]);
const M10A_T11_SUCCESSOR_PATHS = Object.freeze([
  "apps/desen-app/src/authoring-direct-manipulation.ts",
  "apps/desen-app/src/canvas-manipulation-controls.tsx",
  "apps/desen-app/test/authoring-direct-manipulation.test.ts",
  "apps/desen-app/test/canvas-manipulation-controls.test.tsx",
  "docs/proof/M10A-T11.md",
]);
const M10A_T12_SUCCESSOR_PATHS = Object.freeze([
  "apps/desen-app-browser-e2e/t12-playwright.config.ts",
  "apps/desen-app-browser-e2e/t12-rich-styling.pw.ts",
  "apps/desen-app/src/authoring-design-tokens.ts",
  "apps/desen-app/src/authoring-style-preview-runtime.ts",
  "apps/desen-app/src/authoring-styles.ts",
  "apps/desen-app/src/local-project-workspace-persistence.ts",
  "apps/desen-app/src/project-workspace-authoring-persistence.ts",
  "apps/desen-app/src/starter-neutral-workspace-profile.ts",
  "apps/desen-app/src/starter-workspace-product.tsx",
  "apps/desen-app/src/style-panel.tsx",
  "apps/desen-app/test/authoring-design-tokens.test.ts",
  "apps/desen-app/test/authoring-style-preview-runtime.test.ts",
  "apps/desen-app/test/authoring-styles.test.ts",
  "apps/desen-app/test/local-project-workspace-persistence.test.ts",
  "apps/desen-app/test/project-workspace-authoring-persistence.test.ts",
  "apps/desen-app/test/starter-neutral-workspace-profile.test.ts",
  "apps/desen-app/test/style-panel.test.tsx",
  "docs/proof/M10A-T12.md",
  "docs/proof/artifacts/m10a-t12.json",
  "packages/starter-catalog-web/src/visual-style-profile.ts",
  "scripts/generate-m10a-t12-proof.mjs",
  "scripts/lib/m10a-t12-proof.mjs",
  "scripts/verify-m10a-t12.mjs",
  "tests/m10a-t12.test.mjs",
]);
const M10A_T13_SUCCESSOR_PATHS = Object.freeze([
  "apps/desen-app/src/design-system-asset-storage.ts",
  "docs/proof/M10A-T13.md",
  "docs/proof/artifacts/m10a-t13.json",
  "packages/design-system-assets/README.md",
  "packages/design-system-assets/package.json",
  "packages/design-system-assets/src/asset-admission.ts",
  "packages/design-system-assets/src/asset-store.ts",
  "packages/design-system-assets/src/image-presentation.ts",
  "packages/design-system-assets/src/index.ts",
  "packages/design-system-assets/test/asset-admission.test.ts",
  "packages/design-system-assets/tsconfig.build.json",
  "packages/design-system-assets/tsconfig.json",
  "scripts/generate-m10a-t13-proof.mjs",
  "scripts/lib/m10a-t13-proof.mjs",
  "scripts/verify-m10a-t13.mjs",
  "tests/m10a-t13.test.mjs",
]);
const M10A_T14_SUCCESSOR_PATHS = Object.freeze([
  "docs/proof/M10A-T14.md",
  "docs/proof/artifacts/m10a-t14.json",
  "packages/editor-core/src/history.ts",
  "packages/editor-core/test/history.test.ts",
  "scripts/generate-m10a-t14-proof.mjs",
  "scripts/lib/m10a-t14-proof.mjs",
  "scripts/verify-m10a-t14.mjs",
  "tests/m10a-t14.test.mjs",
]);
const LOCAL_PREFLIGHT_SUCCESSOR_PATHS = Object.freeze([
  "scripts/ci/local-preflight.mjs",
  "scripts/ci/test/local-preflight.test.mjs",
]);
const M10A_T15_SUCCESSOR_PATHS = Object.freeze([
  "apps/desen-app-browser-e2e/t15-masters-instances.pw.ts",
  "apps/desen-app-browser-e2e/t15-playwright.config.ts",
  "apps/desen-app/src/authoring-persistence-types.ts",
  "apps/desen-app/src/master-draft-banner.module.css",
  "apps/desen-app/src/master-draft-banner.tsx",
  "apps/desen-app/src/master-instance-panel.module.css",
  "apps/desen-app/src/master-instance-panel.tsx",
  "apps/desen-app/src/project-authoring-context.tsx",
  "apps/desen-app/src/project-authoring-controller.ts",
  "apps/desen-app/src/project-authoring-session.ts",
  "apps/desen-app/src/project-authoring-source-controller.ts",
  "apps/desen-app/src/project-master-draft-controller.ts",
  "apps/desen-app/test/project-authoring-application.test.tsx",
  "apps/desen-app/test/project-authoring-controller.test.ts",
  "apps/desen-app/test/project-authoring-fixture.ts",
  "apps/desen-app/test/project-authoring-source-controller.test.ts",
  "apps/desen-app/test/project-lifecycle-admission.test.ts",
  "apps/desen-app/test/project-master-draft-application.test.tsx",
  "apps/desen-app/test/project-master-draft-controller.test.ts",
  "docs/proof/M10A-T15.md",
  "docs/proof/artifacts/m10a-t15.json",
  "packages/design-system-core/src/master-edit-types.ts",
  "packages/design-system-core/src/master-edit.ts",
  "packages/design-system-core/src/master-instance-materialization.ts",
  "packages/design-system-core/src/master-instance-types.ts",
  "packages/design-system-core/src/project-history.ts",
  "packages/design-system-core/src/recipe-capture.ts",
  "packages/design-system-core/src/recipe-graph.ts",
  "packages/design-system-core/src/recipe-source-edits.ts",
  "packages/design-system-core/src/recipe-source.ts",
  "packages/design-system-core/src/recipe-transaction-types.ts",
  "packages/design-system-core/src/recipe-transactions.ts",
  "packages/design-system-core/test/master-edit.test.ts",
  "packages/design-system-core/test/master-instance-materialization.test.ts",
  "packages/design-system-core/test/project-history.test.ts",
  "packages/design-system-core/test/recipe-graph.test.ts",
  "packages/design-system-core/test/recipe-source-edits.test.ts",
  "packages/design-system-core/test/recipe-transactions.test.ts",
  "scripts/generate-m10a-t15-proof.mjs",
  "scripts/lib/m10a-t15-execution.mjs",
  "scripts/lib/m10a-t15-legacy-input-receipts.mjs",
  "scripts/lib/m10a-t15-proof.mjs",
  "scripts/lib/m10a-t15-workloads.mjs",
  "scripts/verify-m10a-t15.mjs",
  "tests/m10a-t15.test.mjs",
]);

async function currentTrackedPaths() {
  const { stdout } = await EXEC_FILE(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: WORKSPACE_ROOT,
      encoding: "buffer",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    },
  );
  return stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

function calculateAffectedWorkloadOwnershipReview(rawPaths) {
  const withoutT17 = rawPaths.filter((candidate) => !M10A_T17_SUCCESSOR_PATHS.includes(candidate));
  const current = withoutT17.filter((candidate) => !M10A_T16_SUCCESSOR_PATHS.includes(candidate));
  const withoutT15 = current.filter((candidate) => !M10A_T15_SUCCESSOR_PATHS.includes(candidate));
  const paths =
    rawPaths.length === EXPECTED_AFFECTED_TRACKED_PATH_COUNT
      ? rawPaths
      : current.length === 1912
        ? current
        : withoutT15.length === 1867 || withoutT15.length === 1865
          ? withoutT15
          : withoutT15.filter(
              (candidate) =>
                !LOCAL_PREFLIGHT_SUCCESSOR_PATHS.includes(candidate) &&
                !M10A_T14_SUCCESSOR_PATHS.includes(candidate) &&
                !M10A_T13_SUCCESSOR_PATHS.includes(candidate),
            );
  return calculateAffectedWorkloadOwnershipReviewRaw(paths);
}

function calculateAffectedWorkloadOwnershipReviewBase(rawPaths) {
  return calculateAffectedWorkloadOwnershipReviewRaw(
    rawPaths.filter(
      (candidate) =>
        !M10A_T17_SUCCESSOR_PATHS.includes(candidate) &&
        !M10A_T16_SUCCESSOR_PATHS.includes(candidate),
    ),
  );
}

async function currentAuthority() {
  return createAffectedWorkloadOwnership(await currentTrackedPaths());
}

function calculateM10AT04AndEarlierOwnershipReview(paths) {
  return calculateAffectedWorkloadOwnershipReview(
    paths.filter(
      (candidate) =>
        !M10A_T12_SUCCESSOR_PATHS.includes(candidate) &&
        !M10A_T11_SUCCESSOR_PATHS.includes(candidate) &&
        !M10A_T10_SUCCESSOR_PATHS.includes(candidate) &&
        !M10A_T09_SUCCESSOR_PATHS.includes(candidate) &&
        !M10A_T08_SUCCESSOR_PATHS.includes(candidate) &&
        !M10A_T07_SUCCESSOR_PATHS.includes(candidate) &&
        !M10A_T06_SUCCESSOR_PATHS.includes(candidate) &&
        !M10A_T05_SUCCESSOR_PATHS.includes(candidate),
    ),
  );
}

function expectCode(code) {
  return (error) => {
    assert.ok(error instanceof AffectedWorkloadOwnershipError);
    assert.equal(error.code, code);
    return true;
  };
}

function assertDeepFrozen(value, visited = new Set()) {
  if (value === null || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const key of Reflect.ownKeys(value)) assertDeepFrozen(value[key], visited);
}

test("freezes exact-one ownership for all 1920 reviewed tracked paths", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);

  assert.equal(paths.length, EXPECTED_AFFECTED_TRACKED_PATH_COUNT);
  assert.equal(authority.schemaVersion, 1);
  assert.equal(authority.profile, "desen.ci.affected-workload-ownership.v1");
  assert.equal(authority.trackedPathCount, EXPECTED_AFFECTED_TRACKED_PATH_COUNT);
  assert.equal(authority.entries.length, EXPECTED_AFFECTED_TRACKED_PATH_COUNT);
  assert.equal(authority.proofOwnedPathCount, EXPECTED_AFFECTED_PROOF_OWNED_PATH_COUNT);
  assert.equal(authority.trackedPathSetSha256, EXPECTED_AFFECTED_TRACKED_PATH_SET_SHA256);
  assert.equal(authority.ownershipSha256, EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256);
  assert.equal(calculateAffectedTrackedPathSetSha256(paths), authority.trackedPathSetSha256);
  assert.equal(calculateAffectedWorkloadOwnershipSha256(authority), authority.ownershipSha256);
  assert.deepEqual(authority.categoryCounts, EXPECTED_CATEGORY_COUNTS);
  assert.deepEqual(calculateAffectedWorkloadOwnershipReview(paths), {
    trackedPathCount: EXPECTED_AFFECTED_TRACKED_PATH_COUNT,
    trackedPathSetSha256: EXPECTED_AFFECTED_TRACKED_PATH_SET_SHA256,
    proofOwnedPathCount: EXPECTED_AFFECTED_PROOF_OWNED_PATH_COUNT,
    categoryCounts: EXPECTED_CATEGORY_COUNTS,
    ownershipSha256: EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256,
  });
  assert.equal(
    new Set(authority.entries.map(({ path: trackedPath }) => trackedPath)).size,
    EXPECTED_AFFECTED_TRACKED_PATH_COUNT,
  );
  assert.deepEqual(
    authority.entries.map(({ path: trackedPath }) => trackedPath),
    paths,
  );
  assertDeepFrozen(authority);
});

test("T15 adds only its 45 reviewed paths and reconstructs the exact pre-T15 ownership", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(M10A_T15_SUCCESSOR_PATHS.length, 45);
  assert.equal(new Set(M10A_T15_SUCCESSOR_PATHS).size, 45);
  for (const relativePath of M10A_T15_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-m10a-t15.mjs" || relativePath === "tests/m10a-t15.test.mjs";
    assert.equal(owner.proofUnitId, proofInput ? "m10a-t15" : null);
    assert.equal(owner.disposition, proofInput ? "SELECT_PROOF_UNIT" : "FORCE_EXHAUSTIVE");
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateAffectedWorkloadOwnershipReviewBase(
      paths.filter((candidate) => !M10A_T15_SUCCESSOR_PATHS.includes(candidate)),
    ),
    {
      trackedPathCount: 1867,
      trackedPathSetSha256: "96e708713b3e175b162a651f3b78223f50ada76426c7718834211b9014ce73bc",
      proofOwnedPathCount: 244,
      categoryCounts: {
        PROOF_UNIT: 244,
        CI_POLICY: 50,
        DEPENDENCY_POLICY: 39,
        FROZEN_INPUT: 171,
        PACKAGE_OR_APPLICATION: 765,
        SHARED_PROOF_INFRASTRUCTURE: 413,
        PROJECT_DOCUMENTATION: 174,
        REPOSITORY_POLICY: 11,
      },
      ownershipSha256: "229cf86ef50580fb35b87ed07e540bec3a9727a55cee768c29d6285ec6ec8c31",
    },
  );
});

test("the local-preflight successor preserves T14 and adds exactly two exhaustive CI-policy paths", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(LOCAL_PREFLIGHT_SUCCESSOR_PATHS.length, 2);
  assert.equal(new Set(LOCAL_PREFLIGHT_SUCCESSOR_PATHS).size, 2);
  for (const relativePath of LOCAL_PREFLIGHT_SUCCESSOR_PATHS) {
    assert.deepEqual(resolveAffectedWorkloadOwner(authority, relativePath), {
      path: relativePath,
      category: AFFECTED_OWNERSHIP_CATEGORIES.CI_POLICY,
      disposition: AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE,
      proofUnitId: null,
      verifierNodeId: null,
      rootTestNodeId: null,
    });
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateAffectedWorkloadOwnershipReviewBase(
      paths.filter(
        (candidate) =>
          !LOCAL_PREFLIGHT_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T15_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1865,
      trackedPathSetSha256: "eb150d25cfc68bb0ce5ce406f1b880a9286c3ed8e96e263d2cffdd6c5f4de085",
      proofOwnedPathCount: 244,
      categoryCounts: {
        PROOF_UNIT: 244,
        CI_POLICY: 48,
        DEPENDENCY_POLICY: 39,
        FROZEN_INPUT: 171,
        PACKAGE_OR_APPLICATION: 765,
        SHARED_PROOF_INFRASTRUCTURE: 413,
        PROJECT_DOCUMENTATION: 174,
        REPOSITORY_POLICY: 11,
      },
      ownershipSha256: "7a89ddd897643ea7b20d8c684e46c0153b00422d8cc377c9145119dd471d4585",
    },
  );
});

test("the M10A-T12 successor preserves M10A-T11 ownership and adds its exact rich-styling closure", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(M10A_T12_SUCCESSOR_PATHS.length, 24);
  assert.equal(new Set(M10A_T12_SUCCESSOR_PATHS).size, 24);
  for (const relativePath of M10A_T12_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-m10a-t12.mjs" || relativePath === "tests/m10a-t12.test.mjs";
    assert.equal(
      owner.category,
      relativePath === "docs/proof/M10A-T12.md"
        ? AFFECTED_OWNERSHIP_CATEGORIES.PROJECT_DOCUMENTATION
        : relativePath === "docs/proof/artifacts/m10a-t12.json"
          ? AFFECTED_OWNERSHIP_CATEGORIES.FROZEN_INPUT
          : proofInput
            ? AFFECTED_OWNERSHIP_CATEGORIES.PROOF_UNIT
            : relativePath === "scripts/generate-m10a-t12-proof.mjs" ||
                relativePath === "scripts/lib/m10a-t12-proof.mjs"
              ? AFFECTED_OWNERSHIP_CATEGORIES.SHARED_PROOF_INFRASTRUCTURE
              : AFFECTED_OWNERSHIP_CATEGORIES.PACKAGE_OR_APPLICATION,
    );
    assert.equal(
      owner.disposition,
      proofInput
        ? AFFECTED_OWNERSHIP_DISPOSITIONS.SELECT_PROOF_UNIT
        : AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE,
    );
    assert.equal(owner.proofUnitId, proofInput ? "m10a-t12" : null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateAffectedWorkloadOwnershipReview(
      paths.filter((candidate) => !M10A_T12_SUCCESSOR_PATHS.includes(candidate)),
    ),
    {
      trackedPathCount: 1817,
      trackedPathSetSha256: "593589457710d124f0dd9a34517ceec6888912e1627320b58c5bfcc25604f378",
      proofOwnedPathCount: 238,
      categoryCounts: {
        PROOF_UNIT: 238,
        CI_POLICY: 48,
        DEPENDENCY_POLICY: 38,
        FROZEN_INPUT: 168,
        PACKAGE_OR_APPLICATION: 736,
        SHARED_PROOF_INFRASTRUCTURE: 407,
        PROJECT_DOCUMENTATION: 171,
        REPOSITORY_POLICY: 11,
      },
      ownershipSha256: "a6f13b4582b3ef9f3e5b83497c43f04a7906332509e30df3c0340b37cd1041f4",
    },
  );
});

test("the M10A-T11 successor preserves M10A-T10 ownership and adds direct-manipulation paths plus its closure record", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(M10A_T11_SUCCESSOR_PATHS.length, 5);
  assert.equal(new Set(M10A_T11_SUCCESSOR_PATHS).size, 5);
  for (const relativePath of M10A_T11_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    assert.equal(
      owner.category,
      relativePath === "docs/proof/M10A-T11.md"
        ? AFFECTED_OWNERSHIP_CATEGORIES.PROJECT_DOCUMENTATION
        : AFFECTED_OWNERSHIP_CATEGORIES.PACKAGE_OR_APPLICATION,
    );
    assert.equal(owner.disposition, AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE);
    assert.equal(owner.proofUnitId, null);
  }
  assert.deepEqual(
    calculateAffectedWorkloadOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T12_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T11_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1812,
      trackedPathSetSha256: "83a48d64619ec98d32302e73adb2efec027236923fe77a7080f85867c287b7ac",
      proofOwnedPathCount: 238,
      categoryCounts: {
        PROOF_UNIT: 238,
        CI_POLICY: 48,
        DEPENDENCY_POLICY: 38,
        FROZEN_INPUT: 168,
        PACKAGE_OR_APPLICATION: 732,
        SHARED_PROOF_INFRASTRUCTURE: 407,
        PROJECT_DOCUMENTATION: 170,
        REPOSITORY_POLICY: 11,
      },
      ownershipSha256: "6cb2badc702a8b2f5760b442dd680f6c081aebb8b58518d6ad29e20e6b18d752",
    },
  );
});

test("the M10A-T10 successor preserves M10A-T09 ownership and adds six lifecycle paths plus its closure record", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(M10A_T10_SUCCESSOR_PATHS.length, 7);
  assert.equal(new Set(M10A_T10_SUCCESSOR_PATHS).size, 7);
  for (const relativePath of M10A_T10_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    assert.equal(
      owner.category,
      relativePath === "docs/proof/M10A-T10.md"
        ? AFFECTED_OWNERSHIP_CATEGORIES.PROJECT_DOCUMENTATION
        : AFFECTED_OWNERSHIP_CATEGORIES.PACKAGE_OR_APPLICATION,
    );
    assert.equal(owner.disposition, AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE);
    assert.equal(owner.proofUnitId, null);
  }
  assert.deepEqual(
    calculateAffectedWorkloadOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T12_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T11_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T10_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1805,
      trackedPathSetSha256: "ea588a1bc21ea9f85e86edaeea4394abab3c5081b8d315e5236c017ad13f9848",
      proofOwnedPathCount: 238,
      categoryCounts: {
        PROOF_UNIT: 238,
        CI_POLICY: 48,
        DEPENDENCY_POLICY: 38,
        FROZEN_INPUT: 168,
        PACKAGE_OR_APPLICATION: 726,
        SHARED_PROOF_INFRASTRUCTURE: 407,
        PROJECT_DOCUMENTATION: 169,
        REPOSITORY_POLICY: 11,
      },
      ownershipSha256: "910c68f82a8084ef909e3c4bc1304ae7b748d4ba9b4cefed2902b978080fd10e",
    },
  );
});

test("the M10A-T07 successor preserves historical T06 ownership and adds exactly 22 reviewed paths", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(M10A_T07_SUCCESSOR_PATHS.length, 22);
  assert.equal(new Set(M10A_T07_SUCCESSOR_PATHS).size, 22);
  for (const relativePath of M10A_T07_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-m10a-t07.mjs" || relativePath === "tests/m10a-t07.test.mjs";
    assert.equal(
      owner.disposition,
      proofInput
        ? AFFECTED_OWNERSHIP_DISPOSITIONS.SELECT_PROOF_UNIT
        : AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE,
    );
    assert.equal(owner.proofUnitId, proofInput ? "m10a-t07" : null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateAffectedWorkloadOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T12_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T11_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T10_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T09_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T08_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T07_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1743,
      trackedPathSetSha256: "29701d2656202ba88ea22fca18850b8e16905ec2daba54e337c2534437ac8a6d",
      proofOwnedPathCount: 232,
      categoryCounts: {
        ...CI_04_CATEGORY_COUNTS,
        PROOF_UNIT: 232,
        DEPENDENCY_POLICY: 38,
        FROZEN_INPUT: 165,
        PACKAGE_OR_APPLICATION: 682,
        SHARED_PROOF_INFRASTRUCTURE: 401,
        PROJECT_DOCUMENTATION: 166,
      },
      ownershipSha256: "7306d12e38a21b46d4c1503afc178c115857f90d68603ee8b66496c70edcb44b",
    },
  );
});

test("the M10A-T06 successor preserves historical T05 ownership and adds exactly 24 reviewed paths", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(M10A_T06_SUCCESSOR_PATHS.length, 24);
  assert.equal(new Set(M10A_T06_SUCCESSOR_PATHS).size, 24);
  for (const relativePath of M10A_T06_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-m10a-t06.mjs" || relativePath === "tests/m10a-t06.test.mjs";
    assert.equal(
      owner.disposition,
      proofInput
        ? AFFECTED_OWNERSHIP_DISPOSITIONS.SELECT_PROOF_UNIT
        : AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE,
    );
    assert.equal(owner.proofUnitId, proofInput ? "m10a-t06" : null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateAffectedWorkloadOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T12_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T11_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T10_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T09_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T08_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T07_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T06_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1719,
      trackedPathSetSha256: "3d30caadb3dc9699f370bc1a35cf075259d699d88f62294dd0f4a7bdc3905a4e",
      proofOwnedPathCount: 230,
      categoryCounts: {
        ...CI_04_CATEGORY_COUNTS,
        PROOF_UNIT: 230,
        DEPENDENCY_POLICY: 38,
        FROZEN_INPUT: 164,
        PACKAGE_OR_APPLICATION: 665,
        SHARED_PROOF_INFRASTRUCTURE: 398,
        PROJECT_DOCUMENTATION: 165,
      },
      ownershipSha256: "65154c422e54b8557699885f505c0ed00a9e3b24fa99390788e412c9e7c71e7f",
    },
  );
});

test("the M10A-T05 successor preserves T04 ownership and adds exactly 11 reviewed paths", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(M10A_T05_SUCCESSOR_PATHS.length, 11);
  assert.equal(new Set(M10A_T05_SUCCESSOR_PATHS).size, 11);
  for (const relativePath of M10A_T05_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-m10a-t05.mjs" || relativePath === "tests/m10a-t05.test.mjs";
    assert.equal(
      owner.disposition,
      proofInput
        ? AFFECTED_OWNERSHIP_DISPOSITIONS.SELECT_PROOF_UNIT
        : AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE,
    );
    assert.equal(owner.proofUnitId, proofInput ? "m10a-t05" : null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateAffectedWorkloadOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T12_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T11_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T10_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T09_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T08_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T06_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T07_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T05_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1708,
      trackedPathSetSha256: "fe0c2ffc5af86959bbe074e9aea8dcfbbc29701e372c3ebc81c9e7ef065eb29c",
      proofOwnedPathCount: 228,
      categoryCounts: {
        ...CI_04_CATEGORY_COUNTS,
        PROOF_UNIT: 228,
        DEPENDENCY_POLICY: 38,
        FROZEN_INPUT: 163,
        PACKAGE_OR_APPLICATION: 660,
        SHARED_PROOF_INFRASTRUCTURE: 396,
        PROJECT_DOCUMENTATION: 164,
      },
      ownershipSha256: "266601f9d7744dc95bfd686093c7fa2baf3f113df57400c3b100482c7211f5b9",
    },
  );
});

test("the M10A-T04 successor preserves T03 ownership and adds exactly 22 reviewed paths", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(M10A_T04_SUCCESSOR_PATHS.length, 22);
  for (const relativePath of M10A_T04_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-m10a-t04.mjs" || relativePath === "tests/m10a-t04.test.mjs";
    assert.equal(owner.disposition, proofInput ? "SELECT_PROOF_UNIT" : "FORCE_EXHAUSTIVE");
    assert.equal(owner.proofUnitId, proofInput ? "m10a-t04" : null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateM10AT04AndEarlierOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T05_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T04_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1686,
      trackedPathSetSha256: "2a9542af3099a6ef834e01d893c186f3e89b02747b8cbd592108faf681f3ba10",
      proofOwnedPathCount: 226,
      categoryCounts: {
        ...CI_04_CATEGORY_COUNTS,
        PROOF_UNIT: 226,
        DEPENDENCY_POLICY: 37,
        FROZEN_INPUT: 162,
        PACKAGE_OR_APPLICATION: 651,
        SHARED_PROOF_INFRASTRUCTURE: 388,
        PROJECT_DOCUMENTATION: 163,
      },
      ownershipSha256: "ae88676325b4fda7f2d51cc152a7260025ffc6a590db9ef87dfeeee3ba318d6d",
    },
  );
});

test("the M10A-T03 successor preserves T02 ownership and adds exactly 43 reviewed paths", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(M10A_T03_SUCCESSOR_PATHS.length, 43);
  for (const relativePath of M10A_T03_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-m10a-t03.mjs" || relativePath === "tests/m10a-t03.test.mjs";
    assert.equal(owner.disposition, proofInput ? "SELECT_PROOF_UNIT" : "FORCE_EXHAUSTIVE");
    assert.equal(owner.proofUnitId, proofInput ? "m10a-t03" : null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateM10AT04AndEarlierOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T04_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T03_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1643,
      trackedPathSetSha256: "ee83c9d63a5b71e3097dab67a757ea4df5fe892ffbc4a7a9320a94d3adb1ab5d",
      proofOwnedPathCount: 224,
      categoryCounts: {
        ...CI_04_CATEGORY_COUNTS,
        PROOF_UNIT: 224,
        DEPENDENCY_POLICY: 35,
        FROZEN_INPUT: 161,
        PACKAGE_OR_APPLICATION: 628,
        SHARED_PROOF_INFRASTRUCTURE: 374,
        PROJECT_DOCUMENTATION: 162,
      },
      ownershipSha256: "bd1811900519d9cd02ebaa2ea6caab38ccd24c66b5729bb1449a0898d6c8abd8",
    },
  );
});

test("the M10A-T02 successor preserves T01 ownership and adds exactly 38 reviewed paths", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(M10A_T02_SUCCESSOR_PATHS.length, 38);
  for (const relativePath of M10A_T02_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-m10a-t02.mjs" || relativePath === "tests/m10a-t02.test.mjs";
    assert.equal(owner.disposition, proofInput ? "SELECT_PROOF_UNIT" : "FORCE_EXHAUSTIVE");
    assert.equal(owner.proofUnitId, proofInput ? "m10a-t02" : null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateM10AT04AndEarlierOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T04_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T03_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T02_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1605,
      trackedPathSetSha256: "d1397218dc5f5e1554b163c27f4098014a8953fbb4ccad046d5382b8c4d29167",
      proofOwnedPathCount: 222,
      categoryCounts: {
        ...CI_04_CATEGORY_COUNTS,
        PROOF_UNIT: 222,
        DEPENDENCY_POLICY: 34,
        FROZEN_INPUT: 160,
        PACKAGE_OR_APPLICATION: 606,
        SHARED_PROOF_INFRASTRUCTURE: 363,
        PROJECT_DOCUMENTATION: 161,
      },
      ownershipSha256: "b51940f4dadabc2bda7b45b22b0101dbd3faf285dfe1e6bf07335ce2d6d69d1c",
    },
  );
});

test("the M10A-T01 successor preserves G10 ownership and adds exactly 58 reviewed paths", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(M10A_T01_SUCCESSOR_PATHS.length, 58);
  for (const relativePath of M10A_T01_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-m10a-t01.mjs" || relativePath === "tests/m10a-t01.test.mjs";
    assert.equal(owner.disposition, proofInput ? "SELECT_PROOF_UNIT" : "FORCE_EXHAUSTIVE");
    assert.equal(owner.proofUnitId, proofInput ? "m10a-t01" : null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateM10AT04AndEarlierOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T04_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T03_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T02_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T01_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1547,
      trackedPathSetSha256: "32a71872b78da9276979078098413c7dbc356845db2290f2fe2583b45696cf7e",
      proofOwnedPathCount: 220,
      categoryCounts: {
        ...CI_04_CATEGORY_COUNTS,
        PROOF_UNIT: 220,
        FROZEN_INPUT: 159,
        PACKAGE_OR_APPLICATION: 572,
        SHARED_PROOF_INFRASTRUCTURE: 349,
        PROJECT_DOCUMENTATION: 156,
      },
      ownershipSha256: "427ee85a2c53ebaf47a50275697cab725292bd63c85de895ae4947d7e2120aa5",
    },
  );
});

test("the G10 successor preserves every T09 owner and adds exactly six reviewed paths", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(G10_SUCCESSOR_PATHS.length, 6);
  for (const relativePath of G10_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-m10-gate.mjs" || relativePath === "tests/m10-gate.test.mjs";
    assert.equal(owner.disposition, proofInput ? "SELECT_PROOF_UNIT" : "FORCE_EXHAUSTIVE");
    assert.equal(owner.proofUnitId, proofInput ? "m10-gate" : null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateM10AT04AndEarlierOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T04_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T03_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T02_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T01_SUCCESSOR_PATHS.includes(candidate) &&
          !G10_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1541,
      trackedPathSetSha256: "1436f95e25ad4ee78790a8048e595e1c1f4f069d30b4235b1fa3e4a80e4534e6",
      proofOwnedPathCount: 218,
      categoryCounts: {
        ...CI_04_CATEGORY_COUNTS,
        PROOF_UNIT: 218,
        FROZEN_INPUT: 158,
        PACKAGE_OR_APPLICATION: 572,
        SHARED_PROOF_INFRASTRUCTURE: 347,
        PROJECT_DOCUMENTATION: 155,
      },
      ownershipSha256: "690f26d609effff38c790890c00779291e50e120183fe67cf1b8c2c617eb0d5c",
    },
  );
});

test("the T09 baseline successor preserves every T08 owner and adds exactly six reviewed paths", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(T09_SUCCESSOR_PATHS.length, 6);
  for (const relativePath of T09_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-runtime-core-baseline.mjs" ||
      relativePath === "tests/runtime-core-baseline.test.mjs";
    assert.equal(owner.disposition, proofInput ? "SELECT_PROOF_UNIT" : "FORCE_EXHAUSTIVE");
    assert.equal(owner.proofUnitId, proofInput ? "runtime-core-baseline" : null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateM10AT04AndEarlierOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T04_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T03_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T02_SUCCESSOR_PATHS.includes(candidate) &&
          !T09_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T01_SUCCESSOR_PATHS.includes(candidate) &&
          !G10_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1535,
      trackedPathSetSha256: "3f08451d014fb7ea95e0c0bd9beb3852f322855978fd86800231bb4144d250a8",
      proofOwnedPathCount: 216,
      categoryCounts: {
        ...CI_04_CATEGORY_COUNTS,
        PROOF_UNIT: 216,
        FROZEN_INPUT: 157,
        PACKAGE_OR_APPLICATION: 572,
        SHARED_PROOF_INFRASTRUCTURE: 345,
        PROJECT_DOCUMENTATION: 154,
      },
      ownershipSha256: "f7bdffd97b8b652e8d9eda41f224106b11f97ab007e1d549600d4ae0649437ec",
    },
  );
});

test("the T08 repeatable-demo successor preserves every T07 owner and adds only its exact proof pair", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.equal(T08_SUCCESSOR_PATHS.length, 42);
  for (const relativePath of T08_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-desen-app-repeatable-demo.mjs" ||
      relativePath === "tests/desen-app-repeatable-demo.test.mjs";
    assert.equal(owner.disposition, proofInput ? "SELECT_PROOF_UNIT" : "FORCE_EXHAUSTIVE");
    assert.equal(owner.proofUnitId, proofInput ? "desen-app-repeatable-demo" : null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateM10AT04AndEarlierOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T04_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T03_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T02_SUCCESSOR_PATHS.includes(candidate) &&
          !T08_SUCCESSOR_PATHS.includes(candidate) &&
          !T09_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T01_SUCCESSOR_PATHS.includes(candidate) &&
          !G10_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1493,
      trackedPathSetSha256: "813e4547408e5515b576265eec70d4ee5f38d156d56ee3184ec763bf1ce587aa",
      proofOwnedPathCount: 214,
      categoryCounts: {
        ...CI_04_CATEGORY_COUNTS,
        PROOF_UNIT: 214,
        FROZEN_INPUT: 156,
        PACKAGE_OR_APPLICATION: 565,
        SHARED_PROOF_INFRASTRUCTURE: 315,
        PROJECT_DOCUMENTATION: 152,
      },
      ownershipSha256: "eefd587e1882c30c4f7afcab190ba80f29dac50df5c38d2cde14e8f9be62ad82",
    },
  );
});

test("the T07 recovery successor preserves T06 ownership and narrowly registers its exact pair", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  for (const relativePath of T07_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-desen-app-last-known-good-recovery.mjs" ||
      relativePath === "tests/desen-app-last-known-good-recovery.test.mjs";
    assert.equal(owner.disposition, proofInput ? "SELECT_PROOF_UNIT" : "FORCE_EXHAUSTIVE");
    assert.equal(owner.proofUnitId, proofInput ? "desen-app-last-known-good-recovery" : null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateM10AT04AndEarlierOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T04_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T03_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T02_SUCCESSOR_PATHS.includes(candidate) &&
          !T07_SUCCESSOR_PATHS.includes(candidate) &&
          !T08_SUCCESSOR_PATHS.includes(candidate) &&
          !T09_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T01_SUCCESSOR_PATHS.includes(candidate) &&
          !G10_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1465,
      trackedPathSetSha256: "ef74c63d58eac2795aece54f442aa5d894c6215f1de37366fc22bae698c08328",
      proofOwnedPathCount: 212,
      categoryCounts: {
        ...CI_04_CATEGORY_COUNTS,
        PROOF_UNIT: 212,
        FROZEN_INPUT: 155,
        PACKAGE_OR_APPLICATION: 562,
        SHARED_PROOF_INFRASTRUCTURE: 294,
        PROJECT_DOCUMENTATION: 151,
      },
      ownershipSha256: "7a7d55ff9cd399fbb80e67d7e8ec6d48709e04ecd7237cde8ed1ace4bbd58f80",
    },
  );
});

test("the T06 publication successor preserves every CI-04 owner and registers only its exact proof pair", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  for (const relativePath of T06_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    const proofInput =
      relativePath === "scripts/verify-desen-app-invalid-publication.mjs" ||
      relativePath === "tests/desen-app-invalid-publication.test.mjs";
    assert.equal(
      owner.disposition,
      proofInput
        ? AFFECTED_OWNERSHIP_DISPOSITIONS.SELECT_PROOF_UNIT
        : AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE,
    );
    assert.equal(owner.proofUnitId, proofInput ? "desen-app-invalid-publication" : null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateM10AT04AndEarlierOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T04_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T03_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T02_SUCCESSOR_PATHS.includes(candidate) &&
          !T06_SUCCESSOR_PATHS.includes(candidate) &&
          !T07_SUCCESSOR_PATHS.includes(candidate) &&
          !T08_SUCCESSOR_PATHS.includes(candidate) &&
          !T09_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T01_SUCCESSOR_PATHS.includes(candidate) &&
          !G10_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1452,
      trackedPathSetSha256: "b65cb7ec03e4c4c242220d411846faf96d5e2d29a6396004ddc546386d353590",
      proofOwnedPathCount: 210,
      categoryCounts: CI_04_CATEGORY_COUNTS,
      ownershipSha256: "7ebb6e9d5d01e0753844138d520b0b898fc63dfb20074d086861213ab070d799",
    },
  );
});

test("the CI-04 execution sources retain every SEC-02 owner and force exhaustive review", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  for (const relativePath of CI_04_SUCCESSOR_PATHS) {
    const owner = resolveAffectedWorkloadOwner(authority, relativePath);
    assert.equal(owner.category, AFFECTED_OWNERSHIP_CATEGORIES.CI_POLICY);
    assert.equal(owner.disposition, AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE);
    assert.equal(owner.proofUnitId, null);
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== relativePath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
  assert.deepEqual(
    calculateM10AT04AndEarlierOwnershipReview(
      paths.filter(
        (candidate) =>
          !M10A_T04_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T03_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T02_SUCCESSOR_PATHS.includes(candidate) &&
          !CI_04_SUCCESSOR_PATHS.includes(candidate) &&
          !T06_SUCCESSOR_PATHS.includes(candidate) &&
          !T07_SUCCESSOR_PATHS.includes(candidate) &&
          !T08_SUCCESSOR_PATHS.includes(candidate) &&
          !T09_SUCCESSOR_PATHS.includes(candidate) &&
          !M10A_T01_SUCCESSOR_PATHS.includes(candidate) &&
          !G10_SUCCESSOR_PATHS.includes(candidate),
      ),
    ),
    {
      trackedPathCount: 1449,
      trackedPathSetSha256: "6fc4ae57156724abb4b42d88fb84e00d70ce15e2c6787e5850b079492d8bd828",
      proofOwnedPathCount: 210,
      categoryCounts: { ...CI_04_CATEGORY_COUNTS, CI_POLICY: 45 },
      ownershipSha256: "c8836a58038204386135eadc7cba83453f95c03dde11ea98b70fba516360afce",
    },
  );
});

test("the SEC-02 documentation successor preserves the exact SEC-01 ownership authority", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  assert.deepEqual(resolveAffectedWorkloadOwner(authority, SEC_02_SUCCESSOR_PATH), {
    path: SEC_02_SUCCESSOR_PATH,
    category: AFFECTED_OWNERSHIP_CATEGORIES.PROJECT_DOCUMENTATION,
    disposition: AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE,
    proofUnitId: null,
    verifierNodeId: null,
    rootTestNodeId: null,
  });
  const previousPaths = paths.filter(
    (candidate) =>
      !M10A_T04_SUCCESSOR_PATHS.includes(candidate) &&
      !M10A_T03_SUCCESSOR_PATHS.includes(candidate) &&
      !M10A_T02_SUCCESSOR_PATHS.includes(candidate) &&
      candidate !== SEC_02_SUCCESSOR_PATH &&
      !CI_04_SUCCESSOR_PATHS.includes(candidate) &&
      !T06_SUCCESSOR_PATHS.includes(candidate) &&
      !T07_SUCCESSOR_PATHS.includes(candidate) &&
      !T08_SUCCESSOR_PATHS.includes(candidate) &&
      !T09_SUCCESSOR_PATHS.includes(candidate) &&
      !M10A_T01_SUCCESSOR_PATHS.includes(candidate) &&
      !G10_SUCCESSOR_PATHS.includes(candidate),
  );
  assert.throws(
    () => createAffectedWorkloadOwnership(previousPaths),
    expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
  );
  assert.deepEqual(calculateM10AT04AndEarlierOwnershipReview(previousPaths), {
    trackedPathCount: 1448,
    trackedPathSetSha256: "c47ca4048c8cd04a2d1f70facffc9dcb20027fb846284774e991ae23fc578f95",
    proofOwnedPathCount: 210,
    categoryCounts: { ...CI_04_CATEGORY_COUNTS, CI_POLICY: 45, PROJECT_DOCUMENTATION: 148 },
    ownershipSha256: "5e9bfed553437553ea36157baef70439ed50c712eeb318f28e14f2c522228c60",
  });
});

test("the exact SEC-01 successor preserves the reviewed T05 ownership authority", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  for (const [trackedPath, category] of [
    [SEC_01_SUCCESSOR_PATHS[0], AFFECTED_OWNERSHIP_CATEGORIES.PACKAGE_OR_APPLICATION],
    [SEC_01_SUCCESSOR_PATHS[1], AFFECTED_OWNERSHIP_CATEGORIES.PROJECT_DOCUMENTATION],
  ]) {
    assert.deepEqual(resolveAffectedWorkloadOwner(authority, trackedPath), {
      path: trackedPath,
      category,
      disposition: AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE,
      proofUnitId: null,
      verifierNodeId: null,
      rootTestNodeId: null,
    });
    assert.throws(
      () => createAffectedWorkloadOwnership(paths.filter((candidate) => candidate !== trackedPath)),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }

  const predecessorPaths = paths.filter(
    (candidate) =>
      !M10A_T04_SUCCESSOR_PATHS.includes(candidate) &&
      !M10A_T03_SUCCESSOR_PATHS.includes(candidate) &&
      !M10A_T02_SUCCESSOR_PATHS.includes(candidate) &&
      !SEC_01_SUCCESSOR_PATHS.includes(candidate) &&
      candidate !== SEC_02_SUCCESSOR_PATH &&
      !CI_04_SUCCESSOR_PATHS.includes(candidate) &&
      !T06_SUCCESSOR_PATHS.includes(candidate) &&
      !T07_SUCCESSOR_PATHS.includes(candidate) &&
      !T08_SUCCESSOR_PATHS.includes(candidate) &&
      !T09_SUCCESSOR_PATHS.includes(candidate) &&
      !M10A_T01_SUCCESSOR_PATHS.includes(candidate) &&
      !G10_SUCCESSOR_PATHS.includes(candidate),
  );
  assert.deepEqual(calculateM10AT04AndEarlierOwnershipReview(predecessorPaths), {
    trackedPathCount: 1446,
    trackedPathSetSha256: "9cc6e2ebb16b60cc804ca2b7380bf1710d4aa960a363ec606b0574c641fbd53c",
    proofOwnedPathCount: 210,
    categoryCounts: {
      PROOF_UNIT: 210,
      CI_POLICY: 45,
      DEPENDENCY_POLICY: 32,
      FROZEN_INPUT: 154,
      PACKAGE_OR_APPLICATION: 555,
      SHARED_PROOF_INFRASTRUCTURE: 292,
      PROJECT_DOCUMENTATION: 147,
      REPOSITORY_POLICY: 11,
    },
    ownershipSha256: "dc6d534f81fa551fc37ca045a88b2424f10d5fc935cdc56f99aaa55a5efbcbc6",
  });
});

test("permits strict selection only for exact verifier and root-test proof inputs", async () => {
  const authority = await currentAuthority();
  const inventory = createExhaustiveWorkloadInventory();
  const nodeById = new Map(inventory.nodes.map((workload) => [workload.id, workload]));
  const proofEntries = authority.entries.filter(
    ({ category }) => category === AFFECTED_OWNERSHIP_CATEGORIES.PROOF_UNIT,
  );

  assert.equal(proofEntries.length, 246);
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "m10a-t12")
      .map(({ path: trackedPath }) => trackedPath),
    ["scripts/verify-m10a-t12.mjs", "tests/m10a-t12.test.mjs"],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "m10a-t05")
      .map(({ path: trackedPath }) => trackedPath),
    ["scripts/verify-m10a-t05.mjs", "tests/m10a-t05.test.mjs"],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "m10a-t06")
      .map(({ path: trackedPath }) => trackedPath),
    ["scripts/verify-m10a-t06.mjs", "tests/m10a-t06.test.mjs"],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "m10a-t07")
      .map(({ path: trackedPath }) => trackedPath),
    ["scripts/verify-m10a-t07.mjs", "tests/m10a-t07.test.mjs"],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "m10a-t02")
      .map(({ path: trackedPath }) => trackedPath),
    ["scripts/verify-m10a-t02.mjs", "tests/m10a-t02.test.mjs"],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "m10a-t04")
      .map(({ path: trackedPath }) => trackedPath),
    ["scripts/verify-m10a-t04.mjs", "tests/m10a-t04.test.mjs"],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "m10a-t01")
      .map(({ path: trackedPath }) => trackedPath),
    ["scripts/verify-m10a-t01.mjs", "tests/m10a-t01.test.mjs"],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "reference-host-web-channel-consumption")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-reference-host-web-channel-consumption.mjs",
      "tests/reference-host-web-channel-consumption.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "editor-core-source-document")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-editor-core-source-document.mjs",
      "tests/editor-core-source-document.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "editor-core-event-action-edits")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-editor-core-event-action-edits.mjs",
      "tests/editor-core-event-action-edits.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "editor-core-authoring-round-trip")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-editor-core-authoring-round-trip.mjs",
      "tests/editor-core-authoring-round-trip.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "editor-core-persistence")
      .map(({ path: trackedPath }) => trackedPath),
    ["scripts/verify-editor-core-persistence.mjs", "tests/editor-core-persistence.test.mjs"],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "editor-core-continuous-validation")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-editor-core-continuous-validation.mjs",
      "tests/editor-core-continuous-validation.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "editor-core-terminal-integration")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-editor-core-terminal-integration.mjs",
      "tests/editor-core-terminal-integration.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-shell-navigation")
      .map(({ path: trackedPath }) => trackedPath),
    ["scripts/verify-desen-app-shell-navigation.mjs", "tests/desen-app-shell-navigation.test.mjs"],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-catalog-panel-layer-tree")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-catalog-panel-layer-tree.mjs",
      "tests/desen-app-catalog-panel-layer-tree.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-real-adapter-canvas")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-real-adapter-canvas.mjs",
      "tests/desen-app-real-adapter-canvas.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-selection-overlay")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-selection-overlay.mjs",
      "tests/desen-app-selection-overlay.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-schema-inspector")
      .map(({ path: trackedPath }) => trackedPath),
    ["scripts/verify-desen-app-schema-inspector.mjs", "tests/desen-app-schema-inspector.test.mjs"],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-structured-inspector")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-structured-inspector.mjs",
      "tests/desen-app-structured-inspector.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-named-slot-authoring")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-named-slot-authoring.mjs",
      "tests/desen-app-named-slot-authoring.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-event-action-editor")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-event-action-editor.mjs",
      "tests/desen-app-event-action-editor.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-fixtures-scenarios-fidelity")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-fixtures-scenarios-fidelity.mjs",
      "tests/desen-app-fixtures-scenarios-fidelity.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-source-persistence")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-source-persistence.mjs",
      "tests/desen-app-source-persistence.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-node-linked-diagnostics")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-node-linked-diagnostics.mjs",
      "tests/desen-app-node-linked-diagnostics.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-publish-activation")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-publish-activation.mjs",
      "tests/desen-app-publish-activation.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-browser-e2e-workspace-compatibility")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-browser-e2e-workspace-compatibility.mjs",
      "tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-user-created-blank-project")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-user-created-blank-project.mjs",
      "tests/desen-app-user-created-blank-project.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-visual-behavior-authoring")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-visual-behavior-authoring.mjs",
      "tests/desen-app-visual-behavior-authoring.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-evergreen-product-composition")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-evergreen-product-composition.mjs",
      "tests/desen-app-evergreen-product-composition.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-input-pending-fixture")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-input-pending-fixture.mjs",
      "tests/desen-app-input-pending-fixture.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-failure-fixture")
      .map(({ path: trackedPath }) => trackedPath),
    ["scripts/verify-desen-app-failure-fixture.mjs", "tests/desen-app-failure-fixture.test.mjs"],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-success-host-operation")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-success-host-operation.mjs",
      "tests/desen-app-success-host-operation.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-published-host-update")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-desen-app-published-host-update.mjs",
      "tests/desen-app-published-host-update.test.mjs",
    ],
  );
  for (const entry of proofEntries) {
    assert.equal(entry.disposition, AFFECTED_OWNERSHIP_DISPOSITIONS.SELECT_PROOF_UNIT);
    const verifier = nodeById.get(entry.verifierNodeId);
    const rootTest = nodeById.get(entry.rootTestNodeId);
    assert.ok(verifier);
    assert.ok(rootTest);
    assert.ok([verifier.args[0], rootTest.args.at(-1)].includes(entry.path));
    assert.equal(
      inventory.proofUnits.some(
        (unit) =>
          unit.id === entry.proofUnitId &&
          unit.verifierNodeId === entry.verifierNodeId &&
          unit.rootTestNodeId === entry.rootTestNodeId,
      ),
      true,
    );
  }

  for (const entry of authority.entries.filter(
    ({ category }) => category !== AFFECTED_OWNERSHIP_CATEGORIES.PROOF_UNIT,
  )) {
    assert.equal(entry.disposition, AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE);
    assert.equal(entry.proofUnitId, null);
    assert.equal(entry.verifierNodeId, null);
    assert.equal(entry.rootTestNodeId, null);
  }
});

test("keeps CI-03 and AR-01 documentation exhaustive without proof ownership", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);
  for (const documentationPath of [
    "docs/adr/0018-fresh-proof-performance.md",
    "docs/proof/CI-FRESH-PROOF-PERFORMANCE.md",
    "docs/adr/0019-historical-archive-privacy-amendment.md",
    "docs/proof/HISTORICAL-ARCHIVE-REDACTION.md",
  ]) {
    assert.deepEqual(resolveAffectedWorkloadOwner(authority, documentationPath), {
      path: documentationPath,
      category: AFFECTED_OWNERSHIP_CATEGORIES.PROJECT_DOCUMENTATION,
      disposition: AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE,
      proofUnitId: null,
      verifierNodeId: null,
      rootTestNodeId: null,
    });
    assert.throws(
      () =>
        createAffectedWorkloadOwnership(
          paths.filter((candidate) => candidate !== documentationPath),
        ),
      expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
    );
  }
});

test("keeps every T05 product and documentation surface conservative outside its exact readers", async () => {
  const authority = await currentAuthority();
  for (const [trackedPath, category] of [
    ["apps/desen-app/package.json", AFFECTED_OWNERSHIP_CATEGORIES.DEPENDENCY_POLICY],
    ["apps/desen-app/README.md", AFFECTED_OWNERSHIP_CATEGORIES.PACKAGE_OR_APPLICATION],
    ["apps/desen-app-browser-e2e/README.md", AFFECTED_OWNERSHIP_CATEGORIES.PACKAGE_OR_APPLICATION],
    [
      "apps/reference-host-web-server/README.md",
      AFFECTED_OWNERSHIP_CATEGORIES.PACKAGE_OR_APPLICATION,
    ],
    ["docs/architecture/ARCHITECTURE.md", AFFECTED_OWNERSHIP_CATEGORIES.PROJECT_DOCUMENTATION],
    [
      "docs/adr/0020-desen-app-fixed-destination-publication-and-host-activation.md",
      AFFECTED_OWNERSHIP_CATEGORIES.PROJECT_DOCUMENTATION,
    ],
  ]) {
    const entry = authority.entries.find(({ path: candidate }) => candidate === trackedPath);
    assert.ok(entry, `${trackedPath} must remain in exact ownership`);
    assert.equal(entry.category, category);
    assert.equal(entry.disposition, AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE);
    assert.equal(entry.proofUnitId, null);
  }
});

test("the reviewed AR-01 successor preserves the historical I07-04 ownership projection", async () => {
  const currentPaths = await currentTrackedPaths();
  const current = createAffectedWorkloadOwnership(currentPaths);
  const promotedPaths = [
    "docs/proof/baselines/i07-04-affected-selector-promotion.json",
    "scripts/ci/affected-selector-promotion-evidence.mjs",
    "scripts/ci/run-required-affected-quality-gate.mjs",
    "scripts/ci/test/affected-selector-promotion-evidence.test.mjs",
    "scripts/ci/test/required-affected-quality-gate.test.mjs",
    "scripts/ci/verify-affected-selector-promotion-evidence.mjs",
  ];
  const successorPaths = [
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
    "apps/desen-app/src/authoring-publication.ts",
    "apps/desen-app/src/publication-controls.tsx",
    "apps/desen-app/test/authoring-publication.test.ts",
    "apps/desen-app/test/publication-activation-integration.test.ts",
    "apps/desen-app/test/publication-application.test.tsx",
    "apps/desen-app/test/publication-controls.test.tsx",
    "docs/proof/DESEN-APP-PUBLISH-ACTIVATION.md",
    "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json",
    "packages/editor-web/src/local-bundle-channel-publication.ts",
    "packages/editor-web/test/local-bundle-channel-publication.test.ts",
    "scripts/generate-desen-app-publish-activation-proof.mjs",
    "scripts/lib/desen-app-publish-activation-proof.mjs",
    "scripts/verify-desen-app-publish-activation.mjs",
    "tests/desen-app-publish-activation.test.mjs",
    "apps/desen-app-browser-e2e/README.md",
    "apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts",
    "apps/desen-app-browser-e2e/index.html",
    "apps/desen-app-browser-e2e/package.json",
    "apps/desen-app-browser-e2e/playwright.config.ts",
    "apps/desen-app-browser-e2e/proof-application.tsx",
    "apps/desen-app-browser-e2e/tsconfig.json",
    "apps/desen-app-browser-e2e/vite.config.ts",
    "apps/desen-app/src/reference-empty-project.ts",
    "docs/proof/DESEN-APP-EMPTY-PROJECT-BROWSER-E2E.md",
    "docs/proof/artifacts/desen-app-0.1.0-empty-project-browser-e2e.json",
    "scripts/generate-desen-app-empty-project-browser-e2e-proof.mjs",
    "scripts/lib/desen-app-empty-project-browser-e2e-proof.mjs",
    "scripts/verify-desen-app-empty-project-browser-e2e.mjs",
    "tests/desen-app-empty-project-browser-e2e.test.mjs",
    "docs/proof/DESEN-APP-BROWSER-E2E-WORKSPACE-COMPATIBILITY.md",
    "docs/proof/artifacts/desen-app-0.1.0-browser-e2e-workspace-compatibility.json",
    "scripts/generate-desen-app-browser-e2e-workspace-compatibility-proof.mjs",
    "scripts/lib/desen-app-browser-e2e-workspace-compatibility-proof.mjs",
    "scripts/verify-desen-app-browser-e2e-workspace-compatibility.mjs",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app-browser-e2e/proof-application.ts",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/application.tsx",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/reference-empty-project.ts",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/reference-sign-in-workspace-profile.ts",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/styles.css",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/packages/editor-core/src/index.ts",
    "tests/boundaries/fixtures/desen-app-browser-e2e-imports-publisher/apps/desen-app-browser-e2e/proof-application.ts",
    "tests/boundaries/fixtures/desen-app-browser-e2e-imports-publisher/packages/publisher/src/index.ts",
    "tests/boundaries/fixtures/desen-app-browser-e2e-imports-unreviewed-app-source/apps/desen-app-browser-e2e/proof-application.ts",
    "tests/boundaries/fixtures/desen-app-browser-e2e-imports-unreviewed-app-source/apps/desen-app/src/main.ts",
    "tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
    "apps/desen-app-browser-e2e/product-playwright.config.ts",
    "apps/desen-app-browser-e2e/product-proof-server.mjs",
    "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
    "apps/desen-app/dev/local-dev-host.mjs",
    "apps/desen-app/dev/local-dev-host.test.mjs",
    "apps/desen-app/dev/local-dev.mjs",
    "apps/desen-app/src/local-runtime-persistence.ts",
    "apps/desen-app/src/product-bootstrap.tsx",
    "apps/desen-app/test/local-runtime-persistence.test.ts",
    "apps/desen-app/test/product-bootstrap.test.tsx",
    "apps/desen-app/tsconfig.local-dev.json",
    "docs/adr/0016-desen-app-local-product-bootstrap.md",
    "docs/proof/DESEN-APP-USER-CREATED-BLANK-PROJECT.md",
    "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json",
    "scripts/generate-desen-app-user-created-blank-project-proof.mjs",
    "scripts/lib/desen-app-user-created-blank-project-proof.mjs",
    "scripts/verify-desen-app-user-created-blank-project.mjs",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-product-server-control-plane-root/apps/control-plane-api/dist/index.js",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-product-server-control-plane-root/apps/desen-app-browser-e2e/product-proof-server.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-non-product-server-imports-control-plane/apps/control-plane-api/dist/index.js",
    "tests/boundaries/fixtures/desen-app-browser-e2e-non-product-server-imports-control-plane/apps/desen-app-browser-e2e/proof-application.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-control-plane-private/apps/control-plane-api/dist/runtime-activation-sqlite-internal.js",
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-control-plane-private/apps/desen-app-browser-e2e/product-proof-server.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-other-app/apps/desen-app-browser-e2e/product-proof-server.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-other-app/apps/desen-app/src/application.js",
    "tests/desen-app-user-created-blank-project.test.mjs",
    "apps/desen-app/src/authoring-behavior-projection.ts",
    "apps/desen-app/src/authoring-conditions.ts",
    "apps/desen-app/src/authoring-connections.ts",
    "apps/desen-app/src/behavior-controls.tsx",
    "apps/desen-app/test/authoring-behavior-projection.test.ts",
    "apps/desen-app/test/authoring-conditions.test.ts",
    "apps/desen-app/test/authoring-connections.test.ts",
    "apps/desen-app/test/behavior-controls.test.tsx",
    "docs/proof/DESEN-APP-VISUAL-BEHAVIOR-AUTHORING.md",
    "docs/proof/artifacts/desen-app-0.1.0-visual-behavior-authoring.json",
    "scripts/generate-desen-app-visual-behavior-authoring-proof.mjs",
    "scripts/lib/desen-app-visual-behavior-authoring-proof.mjs",
    "scripts/verify-desen-app-visual-behavior-authoring.mjs",
    "tests/desen-app-visual-behavior-authoring.test.mjs",
    "apps/desen-app/src/project-inventory-fixture.ts",
    "apps/desen-app/src/project-workspace-profile.ts",
    "apps/desen-app/src/reference-authoring-profile.ts",
    "apps/desen-app/src/reference-project-fixtures.ts",
    "apps/desen-app/src/reference-sign-in-workspace-profile.ts",
    "apps/desen-app/test/evergreen-product-composition.test.tsx",
    "apps/desen-app/test/project-inventory-fixture.test.ts",
    "apps/desen-app/test/project-workspace-profile.test.ts",
    "docs/proof/DESEN-APP-EVERGREEN-PRODUCT-COMPOSITION.md",
    "docs/proof/artifacts/desen-app-0.1.0-evergreen-product-composition.json",
    "docs/proof/artifacts/desen-app-0.1.0-t01b-historical-reader-bridge.json.gz",
    "scripts/generate-desen-app-evergreen-product-composition-proof.mjs",
    "scripts/generate-desen-app-t01b-historical-reader-bridge.mjs",
    "scripts/lib/desen-app-evergreen-product-composition-proof.mjs",
    "scripts/verify-desen-app-evergreen-product-composition.mjs",
    "tests/desen-app-evergreen-product-composition.test.mjs",
    "tests/desen-app-historical-reader-fixture.mjs",
    "apps/desen-app-browser-e2e/input-pending-fixture.pw.ts",
    "apps/desen-app-browser-e2e/input-pending-playwright.config.ts",
    "docs/proof/DESEN-APP-INPUT-PENDING-FIXTURE.md",
    "docs/proof/artifacts/desen-app-0.1.0-input-pending-fixture.json",
    "docs/proof/artifacts/desen-app-0.1.0-t01c-historical-reader-bridge.json.gz",
    "scripts/generate-desen-app-input-pending-fixture-proof.mjs",
    "scripts/generate-desen-app-t01c-historical-reader-bridge.mjs",
    "scripts/lib/desen-app-input-pending-fixture-proof.mjs",
    "scripts/verify-desen-app-input-pending-fixture.mjs",
    "tests/desen-app-input-pending-fixture.test.mjs",
    "tests/desen-app-t01c-historical-reader-fixture.mjs",
    "apps/desen-app-browser-e2e/failure-fixture.pw.ts",
    "apps/desen-app-browser-e2e/failure-playwright.config.ts",
    "docs/proof/DESEN-APP-FAILURE-FIXTURE.md",
    "docs/proof/artifacts/desen-app-0.1.0-failure-fixture.json",
    "docs/proof/artifacts/desen-app-0.1.0-t02-historical-reader-bridge.json.gz",
    "scripts/generate-desen-app-failure-fixture-proof.mjs",
    "scripts/generate-desen-app-t02-historical-reader-bridge.mjs",
    "scripts/lib/desen-app-failure-fixture-proof.mjs",
    "scripts/verify-desen-app-failure-fixture.mjs",
    "tests/desen-app-failure-fixture.test.mjs",
    "tests/desen-app-t02-historical-reader-fixture.mjs",
    "apps/desen-app-browser-e2e/success-host-operation.pw.ts",
    "apps/desen-app-browser-e2e/success-host-playwright.config.ts",
    "apps/desen-app/dev/local-operation-host.mjs",
    "apps/desen-app/dev/local-operation-host.test.mjs",
    "apps/desen-app/src/authoring-integration.ts",
    "apps/desen-app/src/authoring-run-navigation.ts",
    "apps/desen-app/src/local-operation-binding.ts",
    "apps/desen-app/src/local-workspaces.module.css",
    "apps/desen-app/src/local-workspaces.tsx",
    "apps/desen-app/src/reference-flow-workspace-profile.ts",
    "apps/desen-app/test/authoring-integration.test.ts",
    "apps/desen-app/test/authoring-run-navigation.test.ts",
    "apps/desen-app/test/local-operation-binding.test.ts",
    "apps/desen-app/test/local-workspaces.test.tsx",
    "apps/desen-app/test/reference-flow-workspace-profile.test.ts",
    "apps/desen-app/test/success-host-navigation.test.tsx",
    "docs/adr/0017-desen-app-explicit-integration-and-run-navigation.md",
    "docs/proof/DESEN-APP-SUCCESS-HOST-OPERATION.md",
    "docs/proof/artifacts/desen-app-0.1.0-success-host-operation.json",
    "docs/proof/artifacts/desen-app-0.1.0-t03-historical-reader-bridge.json.gz",
    "scripts/generate-desen-app-success-host-operation-proof.mjs",
    "scripts/generate-desen-app-t03-historical-reader-bridge.mjs",
    "scripts/lib/desen-app-success-host-operation-proof.mjs",
    "scripts/verify-desen-app-success-host-operation.mjs",
    "tests/desen-app-success-host-operation.test.mjs",
    "tests/desen-app-t03-historical-reader-fixture.mjs",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-product-server-local-operation-host/apps/desen-app-browser-e2e/product-proof-server.mjs",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-product-server-local-operation-host/apps/desen-app/dev/local-operation-host.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-non-product-server-imports-local-operation-host/apps/desen-app-browser-e2e/proof-application.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-non-product-server-imports-local-operation-host/apps/desen-app/dev/local-operation-host.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-unreviewed-dev-module/apps/desen-app-browser-e2e/product-proof-server.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-unreviewed-dev-module/apps/desen-app/dev/local-operation-private.mjs",
    "docs/adr/0018-fresh-proof-performance.md",
    "docs/proof/CI-FRESH-PROOF-PERFORMANCE.md",
    "docs/adr/0019-historical-archive-privacy-amendment.md",
    "docs/proof/HISTORICAL-ARCHIVE-REDACTION.md",
    "docs/proof/artifacts/historical-archive-redaction.json",
    "scripts/generate-historical-archive-redaction-proof.mjs",
    "scripts/lib/historical-archive-redaction-proof.mjs",
    "scripts/lib/historical-archive-redaction.mjs",
    "scripts/verify-historical-archive-redaction.mjs",
    "tests/historical-archive-redaction.test.mjs",
    "apps/desen-app-browser-e2e/published-host-playwright.config.ts",
    "apps/desen-app-browser-e2e/published-host-proof-server.mjs",
    "apps/desen-app-browser-e2e/published-host-update.pw.ts",
    "apps/desen-app/dev/local-publication-host.mjs",
    "apps/desen-app/dev/local-publication-host.test.mjs",
    "apps/desen-app/src/local-runtime-publication.ts",
    "apps/desen-app/test/local-runtime-publication.test.ts",
    "docs/adr/0020-desen-app-fixed-destination-publication-and-host-activation.md",
    "docs/proof/DESEN-APP-PUBLISHED-HOST-UPDATE.md",
    "docs/proof/artifacts/desen-app-0.1.0-published-host-update.json",
    "docs/proof/artifacts/desen-app-0.1.0-t04-historical-reader-bridge.json.gz",
    "scripts/generate-desen-app-published-host-update-proof.mjs",
    "scripts/generate-desen-app-t04-historical-reader-bridge.mjs",
    "scripts/lib/desen-app-published-host-update-proof.mjs",
    "scripts/verify-desen-app-published-host-update.mjs",
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
    "tests/desen-app-published-host-update.test.mjs",
    "tests/desen-app-t04-historical-reader-fixture.mjs",
  ];
  for (const promotedPath of promotedPaths) {
    const entry = current.entries.find(({ path: candidate }) => candidate === promotedPath);
    assert.ok(entry, `${promotedPath} must be tracked by the promoted authority`);
    assert.equal(entry.disposition, AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE);
    assert.equal(entry.proofUnitId, null);
  }

  for (const successorPath of successorPaths) {
    assert.ok(
      current.entries.some(({ path: candidate }) => candidate === successorPath),
      `${successorPath} must be tracked by the reviewed AR-01 successor`,
    );
  }

  const historicalPaths = currentPaths.filter(
    (candidate) =>
      !M10A_T04_SUCCESSOR_PATHS.includes(candidate) &&
      !M10A_T03_SUCCESSOR_PATHS.includes(candidate) &&
      !M10A_T02_SUCCESSOR_PATHS.includes(candidate) &&
      !promotedPaths.includes(candidate) &&
      !successorPaths.includes(candidate) &&
      !SEC_01_SUCCESSOR_PATHS.includes(candidate) &&
      candidate !== SEC_02_SUCCESSOR_PATH &&
      !CI_04_SUCCESSOR_PATHS.includes(candidate) &&
      !T06_SUCCESSOR_PATHS.includes(candidate) &&
      !T07_SUCCESSOR_PATHS.includes(candidate) &&
      !T08_SUCCESSOR_PATHS.includes(candidate) &&
      !T09_SUCCESSOR_PATHS.includes(candidate) &&
      !M10A_T01_SUCCESSOR_PATHS.includes(candidate) &&
      !G10_SUCCESSOR_PATHS.includes(candidate),
  );
  historicalPaths.push(
    "scripts/ci/run-shadow-affected-quality-gate.mjs",
    "scripts/ci/test/shadow-affected-quality-gate.test.mjs",
  );
  historicalPaths.sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  assert.deepEqual(calculateM10AT04AndEarlierOwnershipReview(historicalPaths), {
    trackedPathCount: 1039,
    trackedPathSetSha256: "44dce94427dbe3f8e856be0b583cc1e7425ba77d98786b328cfaae7874729b16",
    proofOwnedPathCount: 146,
    categoryCounts: {
      PROOF_UNIT: 146,
      CI_POLICY: 42,
      DEPENDENCY_POLICY: 31,
      FROZEN_INPUT: 116,
      PACKAGE_OR_APPLICATION: 401,
      SHARED_PROOF_INFRASTRUCTURE: 183,
      PROJECT_DOCUMENTATION: 109,
      REPOSITORY_POLICY: 11,
    },
    ownershipSha256: "bc7a53593efd0a99da372d6ee83781f17a3bb5f138ea364bd4d5e868a5b53ad7",
  });
});

test("keeps all eight threshold categories populated and mutually exclusive", async () => {
  const authority = await currentAuthority();
  assert.deepEqual(
    Object.keys(authority.categoryCounts),
    Object.values(AFFECTED_OWNERSHIP_CATEGORIES),
  );
  assert.equal(
    Object.values(authority.categoryCounts).reduce((total, count) => total + count, 0),
    authority.trackedPathCount,
  );
  for (const category of Object.values(AFFECTED_OWNERSHIP_CATEGORIES)) {
    assert.ok(authority.categoryCounts[category] > 0, `${category} must own at least one path`);
  }
});

test("resolves only records inside the frozen path authority", async () => {
  const authority = await currentAuthority();
  const expected = authority.entries.find(
    ({ path: trackedPath }) => trackedPath === "scripts/verify-protocol-snapshot.mjs",
  );
  assert.deepEqual(resolveAffectedWorkloadOwner(authority, expected.path), expected);
  assert.throws(
    () => resolveAffectedWorkloadOwner(authority, "new/unreviewed-path.ts"),
    expectCode("AFFECTED_OWNERSHIP_PATH_UNOWNED"),
  );
});

test("rejects a missing ownership record as a coverage gap", async () => {
  const candidate = structuredClone(await currentAuthority());
  candidate.entries.pop();
  assert.throws(
    () => validateAffectedWorkloadOwnership(candidate),
    expectCode("AFFECTED_OWNERSHIP_PATH_COVERAGE_GAP"),
  );
});

test("rejects duplicate ownership records as ambiguous", async () => {
  const candidate = structuredClone(await currentAuthority());
  candidate.entries[1] = structuredClone(candidate.entries[0]);
  assert.throws(
    () => validateAffectedWorkloadOwnership(candidate),
    expectCode("AFFECTED_OWNERSHIP_PATH_AMBIGUOUS"),
  );
});

test("rejects unknown or substituted proof-unit owners", async () => {
  const candidate = structuredClone(await currentAuthority());
  const proofEntry = candidate.entries.find(
    ({ category }) => category === AFFECTED_OWNERSHIP_CATEGORIES.PROOF_UNIT,
  );
  proofEntry.proofUnitId = "unknown-proof-unit";
  assert.throws(
    () => validateAffectedWorkloadOwnership(candidate),
    expectCode("AFFECTED_OWNERSHIP_PROOF_OWNER_UNKNOWN"),
  );
});

test("rejects category and FORCE_EXHAUSTIVE disposition substitutions", async () => {
  const authority = await currentAuthority();
  const categoryCandidate = structuredClone(authority);
  const packageEntry = categoryCandidate.entries.find(
    ({ category }) => category === AFFECTED_OWNERSHIP_CATEGORIES.PACKAGE_OR_APPLICATION,
  );
  packageEntry.category = AFFECTED_OWNERSHIP_CATEGORIES.PROJECT_DOCUMENTATION;
  assert.throws(
    () => validateAffectedWorkloadOwnership(categoryCandidate),
    expectCode("AFFECTED_OWNERSHIP_RULE_SUBSTITUTED"),
  );

  const dispositionCandidate = structuredClone(authority);
  const policyEntry = dispositionCandidate.entries.find(
    ({ category }) => category === AFFECTED_OWNERSHIP_CATEGORIES.CI_POLICY,
  );
  policyEntry.disposition = AFFECTED_OWNERSHIP_DISPOSITIONS.SELECT_PROOF_UNIT;
  assert.throws(
    () => validateAffectedWorkloadOwnership(dispositionCandidate),
    expectCode("AFFECTED_OWNERSHIP_RULE_SUBSTITUTED"),
  );
});

test("rejects tracked-path, category-count, and ownership digest drift", async () => {
  const authority = await currentAuthority();

  const pathDigestCandidate = structuredClone(authority);
  pathDigestCandidate.trackedPathSetSha256 = "0".repeat(64);
  assert.throws(
    () => validateAffectedWorkloadOwnership(pathDigestCandidate),
    expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
  );

  const categoryCountCandidate = structuredClone(authority);
  categoryCountCandidate.categoryCounts.REPOSITORY_POLICY += 1;
  assert.throws(
    () => validateAffectedWorkloadOwnership(categoryCountCandidate),
    expectCode("AFFECTED_OWNERSHIP_CATEGORY_COUNT_DRIFT"),
  );

  const ownershipDigestCandidate = structuredClone(authority);
  ownershipDigestCandidate.ownershipSha256 = "f".repeat(64);
  assert.throws(
    () => validateAffectedWorkloadOwnership(ownershipDigestCandidate),
    expectCode("AFFECTED_OWNERSHIP_DIGEST_DRIFT"),
  );
});

test("rejects added, reordered, traversal, and non-normalized paths", async () => {
  const paths = await currentTrackedPaths();
  assert.throws(
    () => createAffectedWorkloadOwnership([...paths, "new/unreviewed-path.ts"]),
    AffectedWorkloadOwnershipError,
  );
  assert.throws(
    () => createAffectedWorkloadOwnership([...paths].reverse()),
    expectCode("AFFECTED_OWNERSHIP_PATH_ORDER_INVALID"),
  );
  for (const unsafePath of ["../escape", "nested/../escape", "/absolute", "a//b", "a\\b"]) {
    assert.throws(
      () => calculateAffectedTrackedPathSetSha256([unsafePath]),
      expectCode("AFFECTED_OWNERSHIP_PATH_INVALID"),
    );
  }
  assert.throws(
    () => calculateAffectedTrackedPathSetSha256(["docs/e\u0301vidence.md"]),
    expectCode("AFFECTED_OWNERSHIP_PATH_INVALID"),
  );
});

test("rejects oversized and sparse tracked-path containers", () => {
  assert.throws(
    () => createAffectedWorkloadOwnership(Array(16_385).fill("same")),
    expectCode("AFFECTED_OWNERSHIP_INPUT_OVER_BUDGET"),
  );
  const sparse = [];
  sparse.length = 2;
  sparse[1] = "README.md";
  assert.throws(
    () => createAffectedWorkloadOwnership(sparse),
    expectCode("AFFECTED_OWNERSHIP_INPUT_OVER_BUDGET"),
  );
});

test("does not invoke accessor-backed ownership data", async () => {
  const candidate = structuredClone(await currentAuthority());
  let getterCalls = 0;
  Object.defineProperty(candidate.entries[0], "path", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "README.md";
    },
  });
  assert.throws(
    () => validateAffectedWorkloadOwnership(candidate),
    expectCode("AFFECTED_OWNERSHIP_INPUT_INVALID"),
  );
  assert.equal(getterCalls, 0);
});

test("does not read hostile proxy-backed authorities or arrays", async () => {
  const authority = await currentAuthority();
  let authorityReads = 0;
  const proxiedAuthority = new Proxy(structuredClone(authority), {
    get(target, property, receiver) {
      authorityReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  assert.throws(
    () => validateAffectedWorkloadOwnership(proxiedAuthority),
    expectCode("AFFECTED_OWNERSHIP_INPUT_INVALID"),
  );
  assert.equal(authorityReads, 0);

  let arrayReads = 0;
  const proxiedPaths = new Proxy(await currentTrackedPaths(), {
    get(target, property, receiver) {
      arrayReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  assert.throws(
    () => createAffectedWorkloadOwnership(proxiedPaths),
    expectCode("AFFECTED_OWNERSHIP_INPUT_OVER_BUDGET"),
  );
  assert.equal(arrayReads, 0);
});

test("rejects extra fields and unknown authority profiles", async () => {
  const authority = await currentAuthority();
  const extraField = structuredClone(authority);
  extraField.unreviewed = true;
  assert.throws(
    () => validateAffectedWorkloadOwnership(extraField),
    expectCode("AFFECTED_OWNERSHIP_INPUT_INVALID"),
  );

  const unknownProfile = structuredClone(authority);
  unknownProfile.profile = "desen.ci.affected-workload-ownership.v2";
  assert.throws(
    () => validateAffectedWorkloadOwnership(unknownProfile),
    expectCode("AFFECTED_OWNERSHIP_PROFILE_UNKNOWN"),
  );
});
