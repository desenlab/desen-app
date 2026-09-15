/** Exact executable browser cases authenticated by the M10A-T09 custom reporter. */
export const STARTER_T09_BROWSER_PROOF_TEST_TITLES = Object.freeze({
  publication:
    "publishes the T09 data-display and feedback inventory through the reviewed starter Catalog",
  semantics:
    "renders empty loading error and ready examples with text alternatives and table semantics",
  host: "renders the same sample-data scenarios in the independent host graph without an operation",
  boundaries:
    "retains bounded repeats and row identities while rejecting grid and malformed-data authority",
});

/** Assertions emitted only after every exact M10A-T09 browser case passes. */
export const STARTER_T09_BROWSER_PROOF_ASSERTION_NAMES = Object.freeze([
  "allDataDisplayFeedbackCapabilitiesPublished",
  "sameStaticAdapterRegistry",
  "authoringGraphPresent",
  "independentHostGraph",
  "sampleDataWithoutOperation",
  "readyExample",
  "emptyExample",
  "loadingExample",
  "errorExample",
  "avatarTextAlternative",
  "explicitListItemSlots",
  "tableSemantics",
  "stableRowIdentity",
  "repeatBoundEnforced",
  "enterpriseGridNotAdmitted",
] as const);

/** Exact browser case that owns each emitted M10A-T09 assertion. */
export const STARTER_T09_BROWSER_PROOF_ASSERTION_OWNERS = Object.freeze({
  allDataDisplayFeedbackCapabilitiesPublished: STARTER_T09_BROWSER_PROOF_TEST_TITLES.publication,
  sameStaticAdapterRegistry: STARTER_T09_BROWSER_PROOF_TEST_TITLES.publication,
  authoringGraphPresent: STARTER_T09_BROWSER_PROOF_TEST_TITLES.publication,
  independentHostGraph: STARTER_T09_BROWSER_PROOF_TEST_TITLES.host,
  sampleDataWithoutOperation: STARTER_T09_BROWSER_PROOF_TEST_TITLES.host,
  readyExample: STARTER_T09_BROWSER_PROOF_TEST_TITLES.semantics,
  emptyExample: STARTER_T09_BROWSER_PROOF_TEST_TITLES.semantics,
  loadingExample: STARTER_T09_BROWSER_PROOF_TEST_TITLES.semantics,
  errorExample: STARTER_T09_BROWSER_PROOF_TEST_TITLES.semantics,
  avatarTextAlternative: STARTER_T09_BROWSER_PROOF_TEST_TITLES.semantics,
  explicitListItemSlots: STARTER_T09_BROWSER_PROOF_TEST_TITLES.semantics,
  tableSemantics: STARTER_T09_BROWSER_PROOF_TEST_TITLES.semantics,
  stableRowIdentity: STARTER_T09_BROWSER_PROOF_TEST_TITLES.boundaries,
  repeatBoundEnforced: STARTER_T09_BROWSER_PROOF_TEST_TITLES.boundaries,
  enterpriseGridNotAdmitted: STARTER_T09_BROWSER_PROOF_TEST_TITLES.boundaries,
} as const);

if (
  STARTER_T09_BROWSER_PROOF_ASSERTION_NAMES.length !==
    Object.keys(STARTER_T09_BROWSER_PROOF_ASSERTION_OWNERS).length ||
  STARTER_T09_BROWSER_PROOF_ASSERTION_NAMES.some(
    (name) => !(name in STARTER_T09_BROWSER_PROOF_ASSERTION_OWNERS),
  )
) {
  throw new TypeError("M10A-T09 browser assertion ownership drifted.");
}
