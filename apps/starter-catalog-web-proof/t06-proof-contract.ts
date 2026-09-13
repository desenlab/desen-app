/** Exact executable browser cases authenticated by the M10A-T06 custom reporter. */
export const STARTER_T06_BROWSER_PROOF_TEST_TITLES = Object.freeze({
  publication: "publishes the T06 form surfaces through the reviewed starter Catalog",
  semantics:
    "preserves native labels and described messages in authoring and independent host graphs",
  controlledEvents: "projects controlled form changes through the Runtime event boundary",
  boundaries: "retains Button disabled/loading behavior and rejects malformed form payloads",
});

/** Duration-free claim set emitted only after every exact M10A-T06 browser case passes. */
export const STARTER_T06_BROWSER_PROOF_ASSERTION_NAMES = Object.freeze([
  "publisherDerivedAuthoring",
  "independentHostGraph",
  "sameStaticAdapterRegistry",
  "allFormCapabilitiesPublished",
  "invalidFormValueRejected",
  "nativeLabelAssociation",
  "helpAndErrorAssociation",
  "safeStyleProjectionRetainsSemantics",
  "keyboardFocus",
  "controlledTextFieldChange",
  "controlledTextAreaChange",
  "controlledCheckboxChange",
  "controlledRadioGroupChange",
  "controlledSwitchChange",
  "disabledAndLoadingButton",
  "malformedFormPayloadRejected",
] as const);

/** Exact browser case that independently establishes each emitted M10A-T06 proof assertion. */
export const STARTER_T06_BROWSER_PROOF_ASSERTION_OWNERS = Object.freeze({
  allFormCapabilitiesPublished: STARTER_T06_BROWSER_PROOF_TEST_TITLES.publication,
  invalidFormValueRejected: STARTER_T06_BROWSER_PROOF_TEST_TITLES.publication,
  controlledCheckboxChange: STARTER_T06_BROWSER_PROOF_TEST_TITLES.controlledEvents,
  controlledRadioGroupChange: STARTER_T06_BROWSER_PROOF_TEST_TITLES.controlledEvents,
  controlledSwitchChange: STARTER_T06_BROWSER_PROOF_TEST_TITLES.controlledEvents,
  controlledTextAreaChange: STARTER_T06_BROWSER_PROOF_TEST_TITLES.controlledEvents,
  controlledTextFieldChange: STARTER_T06_BROWSER_PROOF_TEST_TITLES.controlledEvents,
  disabledAndLoadingButton: STARTER_T06_BROWSER_PROOF_TEST_TITLES.boundaries,
  helpAndErrorAssociation: STARTER_T06_BROWSER_PROOF_TEST_TITLES.semantics,
  independentHostGraph: STARTER_T06_BROWSER_PROOF_TEST_TITLES.semantics,
  keyboardFocus: STARTER_T06_BROWSER_PROOF_TEST_TITLES.controlledEvents,
  malformedFormPayloadRejected: STARTER_T06_BROWSER_PROOF_TEST_TITLES.boundaries,
  nativeLabelAssociation: STARTER_T06_BROWSER_PROOF_TEST_TITLES.semantics,
  publisherDerivedAuthoring: STARTER_T06_BROWSER_PROOF_TEST_TITLES.publication,
  safeStyleProjectionRetainsSemantics: STARTER_T06_BROWSER_PROOF_TEST_TITLES.semantics,
  sameStaticAdapterRegistry: STARTER_T06_BROWSER_PROOF_TEST_TITLES.publication,
} as const);

if (
  STARTER_T06_BROWSER_PROOF_ASSERTION_NAMES.length !==
    Object.keys(STARTER_T06_BROWSER_PROOF_ASSERTION_OWNERS).length ||
  STARTER_T06_BROWSER_PROOF_ASSERTION_NAMES.some(
    (name) => !(name in STARTER_T06_BROWSER_PROOF_ASSERTION_OWNERS),
  )
) {
  throw new TypeError("M10A-T06 browser assertion ownership drifted.");
}
