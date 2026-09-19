function command(id, executable, args) {
  return Object.freeze({ id, command: executable, args: Object.freeze(args) });
}

/** Complete project/recipe suites; the token suites remain owned by the full Core command. */
export const M10A_T15_CORE_TEST_FILES = Object.freeze([
  "test/master-edit.test.ts",
  "test/master-instance-materialization.test.ts",
  "test/project-history.test.ts",
  "test/project-migrations.test.ts",
  "test/project-record.test.ts",
  "test/recipe-graph.test.ts",
  "test/recipe-source-edits.test.ts",
  "test/recipe-transactions.test.ts",
  "test/token-document.test.ts",
  "test/token-resolver.test.ts",
]);

/** T15 aggregate/draft integration plus the complete T12 and T14 App regression owners. */
export const M10A_T15_APP_TEST_FILES = Object.freeze([
  "test/application.test.tsx",
  "test/authoring-data.test.ts",
  "test/authoring-design-tokens.test.ts",
  "test/authoring-inspector.test.ts",
  "test/authoring-persistence.test.ts",
  "test/authoring-style-preview-runtime.test.ts",
  "test/authoring-styles.test.ts",
  "test/local-project-workspace-persistence.test.ts",
  "test/main-lifecycle.test.tsx",
  "test/persistence-application.test.tsx",
  "test/preview-fidelity.test.ts",
  "test/product-bootstrap.test.tsx",
  "test/project-authoring-application.test.tsx",
  "test/project-authoring-controller.test.ts",
  "test/project-authoring-source-controller.test.ts",
  "test/project-lifecycle-admission.test.ts",
  "test/project-lifecycle.test.ts",
  "test/project-master-draft-application.test.tsx",
  "test/project-master-draft-controller.test.ts",
  "test/project-workspace-authoring-persistence.test.ts",
  "test/publication-application.test.tsx",
  "test/starter-neutral-workspace-profile.test.ts",
  "test/starter-project.test.ts",
  "test/style-panel.test.tsx",
]);

/** Original T14 App cases that must still execute, not merely remain in a source file. */
export const M10A_T15_INHERITED_REUSE_TESTS = Object.freeze([
  "keeps duplicate and undo/redo operations atomic",
  "does not reuse an older clipboard",
  "retains the project clipboard across admitted surface remounts",
  "clears the project clipboard when opaque workspace authority changes",
  "keeps Source unchanged when a pasted candidate fails the current admission preflight",
  "rejects a structurally admitted foreign capability through the real Catalog preflight",
  "duplicates a reverse-clicked multi-selection in Source order",
]);

/** Fixed serial work inventory; only runner-owned report paths may be appended by the executor. */
export const M10A_T15_WORKLOADS = Object.freeze([
  command("build-app-closure", "pnpm", ["--filter", "@desen/app-web...", "build"]),
  command("build-control-plane", "pnpm", ["--filter", "@desen/control-plane-api", "build"]),
  command("protocol-snapshot", "node", ["scripts/verify-protocol-snapshot.mjs"]),
  command("runtime-baseline", "node", ["scripts/verify-runtime-core-baseline.mjs"]),
  command("core-public-contract", "pnpm", [
    "--filter",
    "@desen/design-system-core",
    "test:public-package",
  ]),
  command("theme-public-contract", "pnpm", [
    "--filter",
    "@desen/design-system-authoring",
    "test:public-package",
  ]),
  command("starter-public-contract", "pnpm", [
    "--filter",
    "@desen/starter-catalog-web",
    "test:public-package",
  ]),
  command("core-behavior", "pnpm", [
    "--filter",
    "@desen/design-system-core",
    "exec",
    "vitest",
    "run",
    ...M10A_T15_CORE_TEST_FILES,
  ]),
  command("theme-behavior", "pnpm", [
    "--filter",
    "@desen/design-system-authoring",
    "exec",
    "vitest",
    "run",
  ]),
  command("starter-behavior", "pnpm", [
    "--filter",
    "@desen/starter-catalog-web",
    "exec",
    "vitest",
    "run",
  ]),
  command("asset-behavior", "pnpm", [
    "--filter",
    "@desen/design-system-assets",
    "exec",
    "vitest",
    "run",
  ]),
  command("source-history", "pnpm", [
    "--filter",
    "@desen/editor-core",
    "exec",
    "vitest",
    "run",
    "test/history.test.ts",
  ]),
  command("app-behavior", "pnpm", [
    "--filter",
    "@desen/app-web",
    "exec",
    "vitest",
    "run",
    ...M10A_T15_APP_TEST_FILES,
    "--maxWorkers=1",
  ]),
  command("browser-types", "pnpm", ["--filter", "@desen/app-browser-e2e", "typecheck"]),
  command("theme-browser", "pnpm", [
    "--filter",
    "@desen/design-system-workbench-proof",
    "test:e2e",
  ]),
  command("style-browser", "pnpm", [
    "--filter",
    "@desen/app-browser-e2e",
    "exec",
    "playwright",
    "test",
    "--config",
    "t12-playwright.config.ts",
  ]),
  command("master-browser", "pnpm", [
    "--filter",
    "@desen/app-browser-e2e",
    "exec",
    "playwright",
    "test",
    "--config",
    "t15-playwright.config.ts",
  ]),
]);

/** Original T03 browser inventory, retained as fresh regression work by T15. */
export const M10A_T15_THEME_BROWSER_TITLES = Object.freeze([
  "applies a color literal to live preview and supports undo and redo",
  "edits typography atomically and redirects a whole-token alias",
  "round-trips deterministic export and retains working data after invalid import",
  "shows the editable Neutral foundation and switches light and dark modes",
]);

/** All fifteen original workbench claims retain a concrete fresh browser owner. */
export const M10A_T15_THEME_ASSERTIONS = Object.freeze([
  "visibleNeutralFoundation",
  "lightDarkModeSelection",
  "literalColorAuthoring",
  "exactColorAlpha",
  "livePreview",
  "atomicTypographyComposite",
  "unitAwareTypography",
  "wholeTokenAliasAuthoring",
  "tokenCreation",
  "structuredThemeModeAuthoring",
  "undoRedoInteraction",
  "deterministicExportReimport",
  "invalidImportRetention",
  "unsupportedModePreviewBlocked",
  "isolatedProofGraph",
]);

/** Unabridged T12 browser claims; these are fresh work, never a relabeled historical PASS. */
export const M10A_T15_STYLE_ASSERTIONS = Object.freeze([
  "aggregateWorkspacePersistence",
  "desktopPreview",
  "distinctComponentBrandPresentations",
  "literalBrandPresentation",
  "mobilePreview",
  "noJsxCssJsonAuthoring",
  "normalStarterProfile",
  "resetInheritance",
  "resolvedTokenBrandPresentation",
  "responsiveOverrideOrder",
  "tabletPreview",
]);

/** Exact normal-product visual-style regression case. */
export const M10A_T15_STYLE_BROWSER_TITLE =
  "authors two component-level visual presentations and ordered responsive overrides through the normal DESEN Neutral product";

/** Exact normal-product master/instance case, required after all of its actual assertions. */
export const M10A_T15_MASTER_BROWSER_TITLE =
  "visually edits a master in normal Desen App, preserving linked overrides, detached Source, atomic history and complete reopen";
