import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  AFFECTED_OBSERVATION_LEDGER_PROFILE,
  AFFECTED_OBSERVATION_THRESHOLD_PROFILE,
  AffectedObservationThresholdError,
  EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256,
  calculateAffectedObservationThresholdSha256,
  evaluateAffectedObservationLedger,
  validateAffectedObservationThreshold,
  validateAffectedObservationThresholdBytes,
} from "../affected-observation-threshold.mjs";

const THRESHOLD_PATH = path.resolve(import.meta.dirname, "../affected-observation-threshold.json");
const MODULE_PATH = path.resolve(import.meta.dirname, "../affected-observation-threshold.mjs");
const thresholdBytes = await readFile(THRESHOLD_PATH);
const thresholdManifest = JSON.parse(thresholdBytes.toString("utf8"));
const OWNERSHIP_CATEGORY_IDS = thresholdManifest.ownershipCategories.map(({ id }) => id);
const DECISION_CATEGORY_IDS = thresholdManifest.decisionCategories.map(({ id }) => id);
const SELECTOR_SHA256 = "1".repeat(64);
const OWNERSHIP_SHA256 = "2".repeat(64);
const INVENTORY_SHA256 = "3".repeat(64);

function thresholdError(code) {
  return (error) => error instanceof AffectedObservationThresholdError && error.code === code;
}

function cloneThreshold() {
  return structuredClone(thresholdManifest);
}

function revision(index) {
  return index.toString(16).padStart(40, "0");
}

function affectedObservation(index, overrides = {}) {
  const currentRevision = revision(index + 1);
  return {
    sequence: index + 1,
    comparisonId: `comparison-${index + 1}`,
    affectedRunId: `affected-run-${index + 1}`,
    exhaustiveRunId: `exhaustive-run-${index + 1}`,
    affectedRevision: currentRevision,
    exhaustiveRevision: currentRevision,
    thresholdSha256: EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256,
    affectedSelectorSha256: SELECTOR_SHA256,
    exhaustiveSelectorSha256: SELECTOR_SHA256,
    affectedOwnershipSha256: OWNERSHIP_SHA256,
    exhaustiveOwnershipSha256: OWNERSHIP_SHA256,
    affectedInventorySha256: INVENTORY_SHA256,
    exhaustiveInventorySha256: INVENTORY_SHA256,
    decisionCategory: "AFFECTED",
    strictSubset: true,
    affectedStatus: "PASS",
    exhaustiveStatus: "PASS",
    ...overrides,
  };
}

function fallbackObservation(index, decisionCategory = "UNKNOWN_PATH", overrides = {}) {
  return affectedObservation(index, {
    affectedRunId: null,
    affectedRevision: null,
    decisionCategory,
    strictSubset: false,
    affectedStatus: "NOT_RUN",
    ...overrides,
  });
}

function completeLedger(observations = [], overrides = {}) {
  return {
    schemaVersion: 1,
    profile: AFFECTED_OBSERVATION_LEDGER_PROFILE,
    thresholdSha256: EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256,
    observations,
    ...overrides,
  };
}

test("freezes the reviewed threshold, category policies, and zero-of-twenty baseline", () => {
  const threshold = validateAffectedObservationThreshold(thresholdManifest);

  assert.equal(threshold.schemaVersion, 1);
  assert.equal(threshold.profile, AFFECTED_OBSERVATION_THRESHOLD_PROFILE);
  assert.equal(threshold.authoritySha256, EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256);
  assert.equal(calculateAffectedObservationThresholdSha256(threshold), threshold.authoritySha256);
  assert.equal(threshold.requiredAuthority, "SHADOW");
  assert.equal(threshold.requiredScope, "AFFECTED");
  assert.equal(threshold.minimumConsecutiveEligibleComparisons, 20);
  assert.equal(threshold.maximumFalseNegatives, 0);
  assert.equal(threshold.initialEligibleComparisonCount, 0);
  assert.equal(threshold.sameRevisionWithinComparisonRequired, true);
  assert.equal(threshold.freshHostedExecutionsRequired, true);
  assert.equal(threshold.cachedSuccessAllowed, false);
  assert.deepEqual(OWNERSHIP_CATEGORY_IDS, [
    "PROOF_UNIT",
    "CI_POLICY",
    "DEPENDENCY_POLICY",
    "FROZEN_INPUT",
    "PACKAGE_OR_APPLICATION",
    "SHARED_PROOF_INFRASTRUCTURE",
    "PROJECT_DOCUMENTATION",
    "REPOSITORY_POLICY",
  ]);
  assert.deepEqual(DECISION_CATEGORY_IDS, [
    "AFFECTED",
    "POLICY_DRIFT",
    "UNKNOWN_PATH",
    "AMBIGUOUS_OWNER",
    "UNTRUSTED_BASE",
    "UNSUPPORTED_CHANGE",
    "INVALID_DIFF",
    "AUTHORITY_DRIFT",
  ]);
  assert.deepEqual(
    threshold.ownershipCategories.map(({ selectionPolicy }) => selectionPolicy),
    ["STRICT_SUBSET_ELIGIBLE", ...Array(7).fill("FORCE_EXHAUSTIVE")],
  );
  assert.deepEqual(
    threshold.decisionCategories.map(({ selectionPolicy }) => selectionPolicy),
    ["STRICT_SUBSET_ELIGIBLE", ...Array(7).fill("FORCE_EXHAUSTIVE")],
  );
  assert.equal(Object.isFrozen(threshold), true);
  assert.equal(Object.isFrozen(threshold.ownershipCategories), true);
  assert.equal(Object.isFrozen(threshold.ownershipCategories[0]), true);
});

test("authenticates only the exact canonical UTF-8 threshold bytes", () => {
  const threshold = validateAffectedObservationThresholdBytes(thresholdBytes);
  assert.equal(threshold.authoritySha256, EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256);

  const noncanonical = Buffer.from(` ${thresholdBytes.toString("utf8")}`, "utf8");
  assert.throws(
    () => validateAffectedObservationThresholdBytes(noncanonical),
    thresholdError("AFFECTED_THRESHOLD_CANONICAL_DRIFT"),
  );
  assert.throws(
    () => validateAffectedObservationThresholdBytes(Uint8Array.from([0xc3, 0x28])),
    thresholdError("AFFECTED_THRESHOLD_BYTES_INVALID"),
  );
  assert.throws(
    () => validateAffectedObservationThresholdBytes(new Uint8Array(64 * 1024 + 1)),
    thresholdError("AFFECTED_THRESHOLD_BYTES_INVALID"),
  );
  assert.throws(
    () => validateAffectedObservationThresholdBytes(new Proxy(new Uint8Array([1]), {})),
    thresholdError("AFFECTED_THRESHOLD_BYTES_INVALID"),
  );
});

test("rejects profile, safety, category, self-digest, and active-object drift", () => {
  for (const mutate of [
    (manifest) => {
      manifest.schemaVersion = 2;
    },
    (manifest) => {
      manifest.profile = "desen.ci.affected-observation-threshold.v2";
    },
    (manifest) => {
      manifest.requiredAuthority = "REQUIRED";
    },
    (manifest) => {
      manifest.requiredScope = "EXHAUSTIVE";
    },
    (manifest) => {
      manifest.minimumConsecutiveEligibleComparisons = 19;
    },
    (manifest) => {
      manifest.maximumFalseNegatives = 1;
    },
    (manifest) => {
      manifest.initialEligibleComparisonCount = 1;
    },
    (manifest) => {
      manifest.sameRevisionWithinComparisonRequired = false;
    },
    (manifest) => {
      manifest.freshHostedExecutionsRequired = false;
    },
    (manifest) => {
      manifest.cachedSuccessAllowed = true;
    },
    (manifest) => {
      manifest.ownershipCategories[0].selectionPolicy = "FORCE_EXHAUSTIVE";
    },
    (manifest) => {
      manifest.decisionCategories.reverse();
    },
    (manifest) => {
      manifest.authoritySha256 = "f".repeat(64);
    },
  ]) {
    const manifest = cloneThreshold();
    mutate(manifest);
    assert.throws(() => validateAffectedObservationThreshold(manifest));
  }

  const extraField = cloneThreshold();
  extraField.unreviewed = true;
  assert.throws(
    () => validateAffectedObservationThreshold(extraField),
    thresholdError("AFFECTED_THRESHOLD_INVALID"),
  );

  const accessor = cloneThreshold();
  Object.defineProperty(accessor, "requiredScope", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    },
  });
  assert.throws(
    () => validateAffectedObservationThreshold(accessor),
    thresholdError("AFFECTED_THRESHOLD_INVALID"),
  );
  assert.throws(
    () => validateAffectedObservationThreshold(new Proxy(cloneThreshold(), {})),
    thresholdError("AFFECTED_THRESHOLD_INVALID"),
  );

  const sparse = cloneThreshold();
  delete sparse.ownershipCategories[2];
  assert.throws(
    () => validateAffectedObservationThreshold(sparse),
    thresholdError("AFFECTED_THRESHOLD_INVALID"),
  );
});

test("begins observation at zero without claiming promotion", () => {
  const result = evaluateAffectedObservationLedger(completeLedger(), thresholdManifest);

  assert.deepEqual(result, {
    profile: AFFECTED_OBSERVATION_LEDGER_PROFILE,
    thresholdSha256: EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256,
    status: "OBSERVING",
    thresholdSatisfied: false,
    promotionEligible: false,
    hostedEvidenceAuthenticated: false,
    authenticatedReviewRequired: true,
    categoryMutationCoverageAuthority: "CODE_OWNED_CONTRACT_TESTS",
    reviewedOwnershipCategoryCount: 8,
    reviewedDecisionCategoryCount: 8,
    falseNegativeLimitSatisfied: true,
    comparisonThresholdSatisfied: false,
    eligibleComparisonCount: 0,
    consecutiveEligibleComparisons: 0,
    requiredConsecutiveEligibleComparisons: 20,
    exhaustiveFallbackCount: 0,
    falseNegativeCount: 0,
    resetCount: 0,
    lastResetReason: null,
  });
  assert.equal(Object.isFrozen(result), true);
});

test("never promotes twenty caller-invented run and digest declarations", () => {
  const nineteen = Array.from({ length: 19 }, (_, index) => affectedObservation(index));
  const nineteenResult = evaluateAffectedObservationLedger(
    completeLedger(nineteen),
    thresholdManifest,
  );
  assert.equal(nineteenResult.status, "OBSERVING");
  assert.equal(nineteenResult.consecutiveEligibleComparisons, 19);

  const twenty = [...nineteen, affectedObservation(19)];
  const twentyResult = evaluateAffectedObservationLedger(completeLedger(twenty), thresholdManifest);
  assert.equal(twentyResult.status, "AUTHENTICATED_REVIEW_REQUIRED");
  assert.equal(twentyResult.thresholdSatisfied, true);
  assert.equal(twentyResult.comparisonThresholdSatisfied, true);
  assert.equal(twentyResult.hostedEvidenceAuthenticated, false);
  assert.equal(twentyResult.authenticatedReviewRequired, true);
  assert.equal(twentyResult.promotionEligible, false);
  assert.equal(twentyResult.eligibleComparisonCount, 20);
  assert.equal(twentyResult.consecutiveEligibleComparisons, 20);
  assert.equal(twentyResult.falseNegativeCount, 0);
});

test("does not count or interrupt successful exhaustive fallbacks", () => {
  const observations = [
    ...Array.from({ length: 10 }, (_, index) => affectedObservation(index)),
    fallbackObservation(10),
    ...Array.from({ length: 10 }, (_, offset) => affectedObservation(offset + 11)),
  ];
  const result = evaluateAffectedObservationLedger(completeLedger(observations), thresholdManifest);

  assert.equal(result.thresholdSatisfied, true);
  assert.equal(result.promotionEligible, false);
  assert.equal(result.eligibleComparisonCount, 20);
  assert.equal(result.consecutiveEligibleComparisons, 20);
  assert.equal(result.exhaustiveFallbackCount, 1);
  assert.equal(result.resetCount, 0);
});

test("resets the streak on failed, cancelled, or incomplete affected execution", () => {
  for (const [status, exhaustiveStatus, expectedReason] of [
    ["FAIL", "PASS", "TERMINAL_MISMATCH"],
    ["CANCELLED", "CANCELLED", "CANCELLED"],
    ["INCOMPLETE", "INCOMPLETE", "INCOMPLETE"],
  ]) {
    const observations = [
      ...Array.from({ length: 5 }, (_, index) => affectedObservation(index)),
      affectedObservation(5, { affectedStatus: status, exhaustiveStatus }),
      ...Array.from({ length: 19 }, (_, offset) => affectedObservation(offset + 6)),
    ];
    const result = evaluateAffectedObservationLedger(
      completeLedger(observations),
      thresholdManifest,
    );
    assert.equal(result.promotionEligible, false);
    assert.equal(result.consecutiveEligibleComparisons, 19);
    assert.equal(result.resetCount, 1);
    assert.equal(result.lastResetReason, expectedReason);
  }
});

test("resets on an exhaustive fallback failure without counting the fallback", () => {
  const observations = [
    ...Array.from({ length: 5 }, (_, index) => affectedObservation(index)),
    fallbackObservation(5, "UNKNOWN_PATH", { exhaustiveStatus: "FAIL" }),
    ...Array.from({ length: 19 }, (_, offset) => affectedObservation(offset + 6)),
  ];
  const result = evaluateAffectedObservationLedger(completeLedger(observations), thresholdManifest);

  assert.equal(result.promotionEligible, false);
  assert.equal(result.consecutiveEligibleComparisons, 19);
  assert.equal(result.exhaustiveFallbackCount, 1);
  assert.equal(result.lastResetReason, "FAIL");
});

test("records one false negative as a permanent promotion blocker", () => {
  const observations = [
    affectedObservation(0, { exhaustiveStatus: "FAIL" }),
    ...Array.from({ length: 20 }, (_, offset) => affectedObservation(offset + 1)),
  ];
  const result = evaluateAffectedObservationLedger(completeLedger(observations), thresholdManifest);

  assert.equal(result.consecutiveEligibleComparisons, 20);
  assert.equal(result.comparisonThresholdSatisfied, true);
  assert.equal(result.falseNegativeCount, 1);
  assert.equal(result.falseNegativeLimitSatisfied, false);
  assert.equal(result.promotionEligible, false);
});

test("resets the streak when selector, ownership, or inventory authority drifts", () => {
  for (const [affectedField, exhaustiveField] of [
    ["affectedSelectorSha256", "exhaustiveSelectorSha256"],
    ["affectedOwnershipSha256", "exhaustiveOwnershipSha256"],
    ["affectedInventorySha256", "exhaustiveInventorySha256"],
  ]) {
    const observations = [
      ...Array.from({ length: 5 }, (_, index) => affectedObservation(index)),
      affectedObservation(5, {
        [affectedField]: "4".repeat(64),
        [exhaustiveField]: "4".repeat(64),
      }),
      ...Array.from({ length: 18 }, (_, offset) =>
        affectedObservation(offset + 6, {
          [affectedField]: "4".repeat(64),
          [exhaustiveField]: "4".repeat(64),
        }),
      ),
    ];
    const result = evaluateAffectedObservationLedger(
      completeLedger(observations),
      thresholdManifest,
    );
    assert.equal(result.promotionEligible, false);
    assert.equal(result.consecutiveEligibleComparisons, 19);
    assert.equal(result.resetCount, 1);
    assert.equal(result.lastResetReason, "AUTHORITY_DIGEST_DRIFT");
  }
});

test("rejects replay, threshold drift, authority mismatch, and revision mismatch", () => {
  const replayedComparison = [affectedObservation(0), affectedObservation(1)];
  replayedComparison[1].comparisonId = replayedComparison[0].comparisonId;
  assert.throws(
    () => evaluateAffectedObservationLedger(completeLedger(replayedComparison), thresholdManifest),
    thresholdError("AFFECTED_OBSERVATION_REPLAY"),
  );

  const replayedRun = [affectedObservation(0), affectedObservation(1)];
  replayedRun[1].exhaustiveRunId = replayedRun[0].affectedRunId;
  assert.throws(
    () => evaluateAffectedObservationLedger(completeLedger(replayedRun), thresholdManifest),
    thresholdError("AFFECTED_OBSERVATION_REPLAY"),
  );

  const thresholdDrift = completeLedger([affectedObservation(0)]);
  thresholdDrift.observations[0].thresholdSha256 = "f".repeat(64);
  assert.throws(
    () => evaluateAffectedObservationLedger(thresholdDrift, thresholdManifest),
    thresholdError("AFFECTED_OBSERVATION_THRESHOLD_DRIFT"),
  );

  const authorityMismatch = completeLedger([
    affectedObservation(0, { exhaustiveInventorySha256: "f".repeat(64) }),
  ]);
  assert.throws(
    () => evaluateAffectedObservationLedger(authorityMismatch, thresholdManifest),
    thresholdError("AFFECTED_OBSERVATION_AUTHORITY_MISMATCH"),
  );

  const revisionMismatch = completeLedger([
    affectedObservation(0, { exhaustiveRevision: "f".repeat(40) }),
  ]);
  assert.throws(
    () => evaluateAffectedObservationLedger(revisionMismatch, thresholdManifest),
    thresholdError("AFFECTED_OBSERVATION_REVISION_MISMATCH"),
  );
});

test("keeps category mutation coverage code-owned and rejects caller declarations", () => {
  const observations = Array.from({ length: 20 }, (_, index) => affectedObservation(index));
  const result = evaluateAffectedObservationLedger(completeLedger(observations), thresholdManifest);

  assert.equal(result.categoryMutationCoverageAuthority, "CODE_OWNED_CONTRACT_TESTS");
  assert.equal(result.reviewedOwnershipCategoryCount, OWNERSHIP_CATEGORY_IDS.length);
  assert.equal(result.reviewedDecisionCategoryCount, DECISION_CATEGORY_IDS.length);

  for (const declaration of [
    { coveredOwnershipCategories: [...OWNERSHIP_CATEGORY_IDS] },
    { coveredDecisionCategories: [...DECISION_CATEGORY_IDS] },
  ]) {
    assert.throws(
      () => evaluateAffectedObservationLedger(completeLedger([], declaration), thresholdManifest),
      thresholdError("AFFECTED_OBSERVATION_LEDGER_INVALID"),
    );
  }
});

test("rejects malformed fallback, non-independent runs, gaps, active records, and excess input", () => {
  assert.throws(
    () =>
      evaluateAffectedObservationLedger(
        completeLedger([fallbackObservation(0, "UNKNOWN_PATH", { strictSubset: true })]),
        thresholdManifest,
      ),
    thresholdError("AFFECTED_OBSERVATION_INVALID"),
  );
  assert.throws(
    () =>
      evaluateAffectedObservationLedger(
        completeLedger([
          affectedObservation(0, {
            exhaustiveRunId: "affected-run-1",
          }),
        ]),
        thresholdManifest,
      ),
    thresholdError("AFFECTED_OBSERVATION_INVALID"),
  );

  const gap = affectedObservation(0);
  gap.sequence = 2;
  assert.throws(
    () => evaluateAffectedObservationLedger(completeLedger([gap]), thresholdManifest),
    thresholdError("AFFECTED_OBSERVATION_INVALID"),
  );

  const activeLedger = completeLedger();
  Object.defineProperty(activeLedger, "observations", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    },
  });
  assert.throws(
    () => evaluateAffectedObservationLedger(activeLedger, thresholdManifest),
    thresholdError("AFFECTED_OBSERVATION_LEDGER_INVALID"),
  );
  assert.throws(
    () => evaluateAffectedObservationLedger(new Proxy(completeLedger(), {}), thresholdManifest),
    thresholdError("AFFECTED_OBSERVATION_LEDGER_INVALID"),
  );

  const excess = Array.from({ length: 1_025 }, (_, index) => affectedObservation(index));
  assert.throws(
    () => evaluateAffectedObservationLedger(completeLedger(excess), thresholdManifest),
    thresholdError("AFFECTED_OBSERVATION_LEDGER_INVALID"),
  );
});

test("the threshold validator has no filesystem or process execution authority", async () => {
  const source = await readFile(MODULE_PATH, "utf8");
  assert.doesNotMatch(
    source,
    /node:fs|node:child_process|writeFile|appendFile|rename|execFile|spawn/u,
  );
});
