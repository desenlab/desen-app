import { execFileSync } from "node:child_process";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const EXPECTED_BASE_COMMIT = "a44575d48e073468da6b25eb8b31a375218caf0a";
const rawArguments = process.argv.slice(2);
if (rawArguments.length !== 2 || rawArguments.some((value) => value.length === 0)) {
  throw new Error(
    "Usage: node scripts/generate-desen-app-t01b-historical-reader-bridge.mjs <detached-t01b-root> <output-path>",
  );
}
const oldRoot = await realpath(path.resolve(rawArguments[0]));
const rawOutputPath = path.resolve(rawArguments[1]);
const outputPath = path.join(
  await realpath(path.dirname(rawOutputPath)),
  path.basename(rawOutputPath),
);
const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: oldRoot,
  encoding: "utf8",
}).trim();
if (baseCommit !== EXPECTED_BASE_COMMIT) {
  throw new Error(`Detached task-time root must be exact commit ${EXPECTED_BASE_COMMIT}.`);
}

const readers = [
  ["desen-app-catalog-panel-layer-tree", "buildDesenAppCatalogPanelLayerTreeEvidence"],
  ["desen-app-design-run-modes", "buildDesenAppDesignRunModesEvidence"],
  ["desen-app-event-action-editor", "buildDesenAppEventActionEditorEvidence"],
  ["desen-app-fixtures-scenarios-fidelity", "buildDesenAppFixturesScenariosFidelityEvidence"],
  ["desen-app-named-slot-authoring", "buildDesenAppNamedSlotAuthoringEvidence"],
  ["desen-app-node-linked-diagnostics", "buildDesenAppNodeLinkedDiagnosticsEvidence"],
  ["desen-app-publish-activation", "buildDesenAppPublishActivationEvidence"],
  ["desen-app-real-adapter-canvas", "buildDesenAppRealAdapterCanvasEvidence"],
  ["desen-app-schema-inspector", "buildDesenAppSchemaInspectorEvidence"],
  ["desen-app-selection-overlay", "buildDesenAppSelectionOverlayEvidence"],
  ["desen-app-shell-navigation", "buildDesenAppShellNavigationEvidence"],
  ["desen-app-source-persistence", "buildDesenAppSourcePersistenceEvidence"],
  ["desen-app-state-binding-editor", "buildDesenAppStateBindingEditorEvidence"],
  ["desen-app-structured-inspector", "buildDesenAppStructuredInspectorEvidence"],
  [
    "desen-app-user-created-blank-project",
    "buildDesenAppUserCreatedBlankProjectEvidence",
    "artifact",
  ],
];
const SUCCESSOR_ADDED_PATHS = Object.freeze([
  "apps/desen-app/src/project-inventory-fixture.ts",
  "apps/desen-app/src/project-workspace-profile.ts",
  "apps/desen-app/src/reference-authoring-profile.ts",
  "apps/desen-app/src/reference-project-fixtures.ts",
  "apps/desen-app/src/reference-sign-in-workspace-profile.ts",
  "apps/desen-app/test/evergreen-product-composition.test.tsx",
  "apps/desen-app/test/project-inventory-fixture.test.ts",
  "apps/desen-app/test/project-workspace-profile.test.ts",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/reference-sign-in-workspace-profile.ts",
]);
const TASK_TIME_FILE_PATHS = Object.freeze([
  ".github/workflows/ci.yml",
  "apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts",
  "apps/desen-app-browser-e2e/proof-application.tsx",
  "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
  "apps/desen-app/README.md",
  "apps/desen-app/src/adapter-canvas.tsx",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/authoring-connections.ts",
  "apps/desen-app/src/authoring-data.ts",
  "apps/desen-app/src/authoring-event-actions.ts",
  "apps/desen-app/src/authoring-fixtures.ts",
  "apps/desen-app/src/authoring-persistence.ts",
  "apps/desen-app/src/authoring-preview.ts",
  "apps/desen-app/src/authoring-publication.ts",
  "apps/desen-app/src/authoring-scenarios.ts",
  "apps/desen-app/src/event-action-panel.tsx",
  "apps/desen-app/src/main.tsx",
  "apps/desen-app/src/preview-fidelity.ts",
  "apps/desen-app/src/product-bootstrap.tsx",
  "apps/desen-app/src/project-data.ts",
  "apps/desen-app/src/publication-controls.tsx",
  "apps/desen-app/test/adapter-canvas.test.tsx",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/authoring-behavior-projection.test.ts",
  "apps/desen-app/test/authoring-data.test.ts",
  "apps/desen-app/test/authoring-diagnostics.test.ts",
  "apps/desen-app/test/authoring-event-actions.test.ts",
  "apps/desen-app/test/authoring-inspector.test.ts",
  "apps/desen-app/test/authoring-persistence.test.ts",
  "apps/desen-app/test/authoring-preview.test.ts",
  "apps/desen-app/test/authoring-publication.test.ts",
  "apps/desen-app/test/authoring-scenarios.test.ts",
  "apps/desen-app/test/authoring-selection.test.ts",
  "apps/desen-app/test/authoring-slots.test.ts",
  "apps/desen-app/test/authoring-state.test.ts",
  "apps/desen-app/test/behavior-controls.test.tsx",
  "apps/desen-app/test/event-action-panel.test.tsx",
  "apps/desen-app/test/inspector-panel.test.tsx",
  "apps/desen-app/test/persistence-application.test.tsx",
  "apps/desen-app/test/preview-fidelity.test.ts",
  "apps/desen-app/test/product-bootstrap.test.tsx",
  "apps/desen-app/test/publication-activation-integration.test.ts",
  "apps/desen-app/test/publication-application.test.tsx",
  "apps/desen-app/test/state-panel.test.tsx",
  "dependency-cruiser.config.cjs",
  "docs/architecture/ARCHITECTURE.md",
  "docs/plan/MASTER-PLAN.md",
  "docs/plan/START-HERE.tr.md",
  "docs/plan/TASKS.md",
  "docs/standards/TESTING-STRATEGY.md",
  "package.json",
  "PROJECT-STATUS.md",
  "README.md",
  "scripts/ci/affected-impact-graph.mjs",
  "scripts/ci/affected-selector-promotion-evidence.mjs",
  "scripts/ci/affected-workload-ownership.mjs",
  "scripts/ci/exhaustive-workload-inventory.mjs",
  "scripts/ci/proof-reader-checkpoints.json",
  "scripts/ci/proof-reader-checkpoints.mjs",
  "scripts/ci/required-exhaustive-equivalence.mjs",
  "scripts/ci/run-required-affected-quality-gate.mjs",
  "scripts/ci/run-required-exhaustive-quality-gate.mjs",
  "scripts/ci/shared-state-authority.mjs",
  "scripts/ci/test/affected-impact-graph.test.mjs",
  "scripts/ci/test/affected-selector-promotion-evidence.test.mjs",
  "scripts/ci/test/affected-workload-ownership.test.mjs",
  "scripts/ci/test/affected-workload-selector.test.mjs",
  "scripts/ci/test/exhaustive-workload-inventory.test.mjs",
  "scripts/ci/test/proof-reader-checkpoints.test.mjs",
  "scripts/ci/test/required-affected-quality-gate.test.mjs",
  "scripts/ci/test/required-exhaustive-equivalence.test.mjs",
  "scripts/ci/test/required-exhaustive-quality-gate.test.mjs",
  "scripts/ci/test/shared-state-authority.test.mjs",
  "scripts/run-ci-quality-gate.mjs",
  "scripts/test/ci-quality-gate.test.mjs",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app-browser-e2e/proof-application.ts",
]);

const projections = Object.create(null);
for (const [proofId, exportName, projectionKind = "currentCompatibility"] of readers) {
  const modulePath = path.join(oldRoot, "scripts/lib", `${proofId}-proof.mjs`);
  const module = await import(pathToFileURL(modulePath));
  const built = await module[exportName]();
  projections[proofId] = built[projectionKind];
}

const files = Object.create(null);
for (const relativePath of TASK_TIME_FILE_PATHS) {
  files[relativePath] = (await readFile(path.join(oldRoot, relativePath))).toString("base64");
}

const payload = {
  schemaVersion: 1,
  profile: "desen.app.m10-t01b-historical-reader-bridge.v1",
  baseCommit,
  successorAddedPaths: SUCCESSOR_ADDED_PATHS,
  files,
  projections,
};
const bytes = Buffer.from(`${JSON.stringify(payload)}\n`);
await writeFile(outputPath, gzipSync(bytes, { level: 9, mtime: 0 }), { flag: "wx" });
