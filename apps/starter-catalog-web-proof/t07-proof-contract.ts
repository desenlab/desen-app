/** Exact executable browser cases authenticated by the M10A-T07 custom reporter. */
export const STARTER_T07_BROWSER_PROOF_TEST_TITLES = Object.freeze({
  publication:
    "publishes the T07 selection and numeric surfaces through the reviewed starter Catalog",
  semantics:
    "renders selection, tab panels, and numeric bounds in authoring and independent host graphs",
  keyboard:
    "projects keyboard typeahead, tab selection, and numeric changes through Runtime events",
  boundaries: "retains empty and disabled states and rejects malformed selection and numeric data",
});

/** Duration-free claim set emitted only after every exact M10A-T07 browser case passes. */
export const STARTER_T07_BROWSER_PROOF_ASSERTION_NAMES = Object.freeze([
  "publisherDerivedAuthoring",
  "independentHostGraph",
  "sameStaticAdapterRegistry",
  "allSelectionNumericCapabilitiesPublished",
  "stableSelectedIdentities",
  "dataOnlyBoundedFiltering",
  "publicOrderedTabPanels",
  "keyboardSelectTypeahead",
  "keyboardComboboxFiltering",
  "keyboardTabSelection",
  "numericBounds",
  "emptyAndDisabledControls",
  "duplicateOptionIdRejected",
  "nonFiniteValueRejected",
  "functionRendererAndFilterRejected",
  "malformedRuntimeEventRejected",
] as const);

/** Exact browser case that independently establishes each emitted M10A-T07 proof assertion. */
export const STARTER_T07_BROWSER_PROOF_ASSERTION_OWNERS = Object.freeze({
  allSelectionNumericCapabilitiesPublished: STARTER_T07_BROWSER_PROOF_TEST_TITLES.publication,
  dataOnlyBoundedFiltering: STARTER_T07_BROWSER_PROOF_TEST_TITLES.publication,
  duplicateOptionIdRejected: STARTER_T07_BROWSER_PROOF_TEST_TITLES.boundaries,
  emptyAndDisabledControls: STARTER_T07_BROWSER_PROOF_TEST_TITLES.boundaries,
  functionRendererAndFilterRejected: STARTER_T07_BROWSER_PROOF_TEST_TITLES.boundaries,
  independentHostGraph: STARTER_T07_BROWSER_PROOF_TEST_TITLES.semantics,
  keyboardComboboxFiltering: STARTER_T07_BROWSER_PROOF_TEST_TITLES.keyboard,
  keyboardSelectTypeahead: STARTER_T07_BROWSER_PROOF_TEST_TITLES.keyboard,
  keyboardTabSelection: STARTER_T07_BROWSER_PROOF_TEST_TITLES.keyboard,
  malformedRuntimeEventRejected: STARTER_T07_BROWSER_PROOF_TEST_TITLES.boundaries,
  nonFiniteValueRejected: STARTER_T07_BROWSER_PROOF_TEST_TITLES.boundaries,
  numericBounds: STARTER_T07_BROWSER_PROOF_TEST_TITLES.keyboard,
  publicOrderedTabPanels: STARTER_T07_BROWSER_PROOF_TEST_TITLES.semantics,
  publisherDerivedAuthoring: STARTER_T07_BROWSER_PROOF_TEST_TITLES.publication,
  sameStaticAdapterRegistry: STARTER_T07_BROWSER_PROOF_TEST_TITLES.publication,
  stableSelectedIdentities: STARTER_T07_BROWSER_PROOF_TEST_TITLES.keyboard,
} as const);

if (
  STARTER_T07_BROWSER_PROOF_ASSERTION_NAMES.length !==
    Object.keys(STARTER_T07_BROWSER_PROOF_ASSERTION_OWNERS).length ||
  STARTER_T07_BROWSER_PROOF_ASSERTION_NAMES.some(
    (name) => !(name in STARTER_T07_BROWSER_PROOF_ASSERTION_OWNERS),
  )
) {
  throw new TypeError("M10A-T07 browser assertion ownership drifted.");
}
