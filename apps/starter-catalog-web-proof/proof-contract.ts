/** Exact executable browser cases authenticated by the M10A-T05 custom reporter. */
export const STARTER_BROWSER_PROOF_TEST_TITLES = Object.freeze({
  publication: "publishes four Source surfaces and rejects undeclared capability data",
  interactions: "keeps Select and Dialog interactions inside the approved boundary",
  layoutContent:
    "renders nested logical layout and safe semantic content in authoring and independent host graphs",
  isolation:
    "preserves protocol identity with session isolation, survives StrictMode remount, and isolates the host graph",
});

/** Duration-free claim set emitted only after every exact browser case passes. */
export const STARTER_BROWSER_PROOF_ASSERTION_NAMES = Object.freeze([
  "atomicRequiredSlotInsertion",
  "publisherDerivedAuthoring",
  "independentHostGraph",
  "sameStaticAdapterRegistry",
  "keyboardSelect",
  "escapeFocusReturn",
  "focusTrap",
  "portalContainment",
  "nestedPortalContainment",
  "disabledAndLoadingButton",
  "strictModeUnmountRemount",
  "compatiblePublicationIdentity",
  "compatibleLiveRerenderIdentity",
  "wrongEventPayloadRejected",
  "unknownCapabilityRejected",
  "unknownStylePartRejected",
  "logicalRtlAlignment",
  "visibleBorderProjection",
  "nestedLayoutSlots",
  "semanticContent",
  "trustedLocalMedia",
  "unsupportedImageColorRejected",
  "invalidDimensionsRejected",
  "privateSelectorsRejected",
  "visibleVerticalSeparator",
] as const);

/** Exact browser case that independently establishes each emitted proof assertion. */
export const STARTER_BROWSER_PROOF_ASSERTION_OWNERS = Object.freeze({
  atomicRequiredSlotInsertion: STARTER_BROWSER_PROOF_TEST_TITLES.publication,
  compatibleLiveRerenderIdentity: STARTER_BROWSER_PROOF_TEST_TITLES.isolation,
  compatiblePublicationIdentity: STARTER_BROWSER_PROOF_TEST_TITLES.isolation,
  disabledAndLoadingButton: STARTER_BROWSER_PROOF_TEST_TITLES.isolation,
  escapeFocusReturn: STARTER_BROWSER_PROOF_TEST_TITLES.interactions,
  focusTrap: STARTER_BROWSER_PROOF_TEST_TITLES.interactions,
  independentHostGraph: STARTER_BROWSER_PROOF_TEST_TITLES.isolation,
  invalidDimensionsRejected: STARTER_BROWSER_PROOF_TEST_TITLES.publication,
  keyboardSelect: STARTER_BROWSER_PROOF_TEST_TITLES.interactions,
  logicalRtlAlignment: STARTER_BROWSER_PROOF_TEST_TITLES.layoutContent,
  nestedLayoutSlots: STARTER_BROWSER_PROOF_TEST_TITLES.layoutContent,
  nestedPortalContainment: STARTER_BROWSER_PROOF_TEST_TITLES.interactions,
  portalContainment: STARTER_BROWSER_PROOF_TEST_TITLES.interactions,
  privateSelectorsRejected: STARTER_BROWSER_PROOF_TEST_TITLES.publication,
  publisherDerivedAuthoring: STARTER_BROWSER_PROOF_TEST_TITLES.publication,
  sameStaticAdapterRegistry: STARTER_BROWSER_PROOF_TEST_TITLES.publication,
  semanticContent: STARTER_BROWSER_PROOF_TEST_TITLES.layoutContent,
  strictModeUnmountRemount: STARTER_BROWSER_PROOF_TEST_TITLES.isolation,
  trustedLocalMedia: STARTER_BROWSER_PROOF_TEST_TITLES.layoutContent,
  unsupportedImageColorRejected: STARTER_BROWSER_PROOF_TEST_TITLES.publication,
  unknownCapabilityRejected: STARTER_BROWSER_PROOF_TEST_TITLES.publication,
  unknownStylePartRejected: STARTER_BROWSER_PROOF_TEST_TITLES.publication,
  visibleBorderProjection: STARTER_BROWSER_PROOF_TEST_TITLES.layoutContent,
  visibleVerticalSeparator: STARTER_BROWSER_PROOF_TEST_TITLES.layoutContent,
  wrongEventPayloadRejected: STARTER_BROWSER_PROOF_TEST_TITLES.interactions,
} as const);

if (
  STARTER_BROWSER_PROOF_ASSERTION_NAMES.length !==
    Object.keys(STARTER_BROWSER_PROOF_ASSERTION_OWNERS).length ||
  STARTER_BROWSER_PROOF_ASSERTION_NAMES.some(
    (name) => !(name in STARTER_BROWSER_PROOF_ASSERTION_OWNERS),
  )
) {
  throw new TypeError("Starter browser assertion ownership drifted.");
}
