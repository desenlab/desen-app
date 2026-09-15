/** Exact executable browser cases authenticated by the M10A-T08 custom reporter. */
export const STARTER_T08_BROWSER_PROOF_TEST_TITLES = Object.freeze({
  publication:
    "publishes the T08 overlay and disclosure inventory through the reviewed starter Catalog",
  semantics: "renders Dialog, Popover, Tooltip, Menu, and Accordion with contained preview portals",
  keyboard:
    "projects pointer and keyboard open close parity with focus return through Runtime events",
  boundaries:
    "retains disabled and ordered slot states while rejecting forged portal and stale inputs",
});

/** Assertions emitted only after every exact M10A-T08 browser case passes. */
export const STARTER_T08_BROWSER_PROOF_ASSERTION_NAMES = Object.freeze([
  "allOverlayDisclosureCapabilitiesPublished",
  "sameStaticAdapterRegistry",
  "authoringGraphPresent",
  "independentHostGraph",
  "containedPortalRoots",
  "dialogOpenClose",
  "popoverOpenClose",
  "tooltipHoverAndFocus",
  "menuKeyboardSelection",
  "accordionOrderedPanels",
  "focusReturnAfterClose",
  "pointerKeyboardParity",
  "disabledControls",
  "missingRequiredSlotsRejected",
  "forgedPortalAuthorityRejected",
  "staleInteractionRejected",
] as const);

/** Exact browser case that owns each emitted M10A-T08 assertion. */
export const STARTER_T08_BROWSER_PROOF_ASSERTION_OWNERS = Object.freeze({
  allOverlayDisclosureCapabilitiesPublished: STARTER_T08_BROWSER_PROOF_TEST_TITLES.publication,
  sameStaticAdapterRegistry: STARTER_T08_BROWSER_PROOF_TEST_TITLES.publication,
  authoringGraphPresent: STARTER_T08_BROWSER_PROOF_TEST_TITLES.publication,
  independentHostGraph: STARTER_T08_BROWSER_PROOF_TEST_TITLES.semantics,
  containedPortalRoots: STARTER_T08_BROWSER_PROOF_TEST_TITLES.semantics,
  dialogOpenClose: STARTER_T08_BROWSER_PROOF_TEST_TITLES.keyboard,
  popoverOpenClose: STARTER_T08_BROWSER_PROOF_TEST_TITLES.keyboard,
  tooltipHoverAndFocus: STARTER_T08_BROWSER_PROOF_TEST_TITLES.keyboard,
  menuKeyboardSelection: STARTER_T08_BROWSER_PROOF_TEST_TITLES.keyboard,
  accordionOrderedPanels: STARTER_T08_BROWSER_PROOF_TEST_TITLES.semantics,
  focusReturnAfterClose: STARTER_T08_BROWSER_PROOF_TEST_TITLES.keyboard,
  pointerKeyboardParity: STARTER_T08_BROWSER_PROOF_TEST_TITLES.keyboard,
  disabledControls: STARTER_T08_BROWSER_PROOF_TEST_TITLES.boundaries,
  missingRequiredSlotsRejected: STARTER_T08_BROWSER_PROOF_TEST_TITLES.boundaries,
  forgedPortalAuthorityRejected: STARTER_T08_BROWSER_PROOF_TEST_TITLES.boundaries,
  staleInteractionRejected: STARTER_T08_BROWSER_PROOF_TEST_TITLES.boundaries,
} as const);

if (
  STARTER_T08_BROWSER_PROOF_ASSERTION_NAMES.length !==
    Object.keys(STARTER_T08_BROWSER_PROOF_ASSERTION_OWNERS).length ||
  STARTER_T08_BROWSER_PROOF_ASSERTION_NAMES.some(
    (name) => !(name in STARTER_T08_BROWSER_PROOF_ASSERTION_OWNERS),
  )
) {
  throw new TypeError("M10A-T08 browser assertion ownership drifted.");
}
