/** Exact browser cases authenticated by the M10A-T03 workbench reporter. */
export const WORKBENCH_BROWSER_PROOF_TEST_TITLES = Object.freeze({
  foundation: "shows the editable Neutral foundation and switches light and dark modes",
  editing: "applies a color literal to live preview and supports undo and redo",
  compositeAndAlias: "edits typography atomically and redirects a whole-token alias",
  transfer: "round-trips deterministic export and retains working data after invalid import",
});

/** Duration-free claims emitted only when the exact browser inventory passes. */
export const WORKBENCH_BROWSER_PROOF_ASSERTION_NAMES = Object.freeze([
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
] as const);

/** Closed ownership of every browser assertion by the case that observes it. */
export const WORKBENCH_BROWSER_PROOF_ASSERTIONS_BY_TEST_TITLE = Object.freeze({
  [WORKBENCH_BROWSER_PROOF_TEST_TITLES.foundation]: Object.freeze([
    "visibleNeutralFoundation",
    "lightDarkModeSelection",
    "isolatedProofGraph",
  ]),
  [WORKBENCH_BROWSER_PROOF_TEST_TITLES.editing]: Object.freeze([
    "literalColorAuthoring",
    "exactColorAlpha",
    "livePreview",
    "undoRedoInteraction",
  ]),
  [WORKBENCH_BROWSER_PROOF_TEST_TITLES.compositeAndAlias]: Object.freeze([
    "atomicTypographyComposite",
    "unitAwareTypography",
    "wholeTokenAliasAuthoring",
    "tokenCreation",
    "structuredThemeModeAuthoring",
  ]),
  [WORKBENCH_BROWSER_PROOF_TEST_TITLES.transfer]: Object.freeze([
    "deterministicExportReimport",
    "invalidImportRetention",
    "unsupportedModePreviewBlocked",
  ]),
} as const);
