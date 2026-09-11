/** Exact executable browser cases authenticated by the M10A-T01 custom reporter. */
export const STARTER_BROWSER_PROOF_TEST_TITLES = Object.freeze({
  publication: "publishes three Source surfaces and rejects undeclared capability data",
  interactions: "keeps Select and Dialog interactions inside the approved boundary",
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
] as const);
