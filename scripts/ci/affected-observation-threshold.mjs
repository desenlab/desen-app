import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_JSON_PARSE = JSON.parse;
const SAFE_JSON_STRINGIFY = JSON.stringify;
const SAFE_NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const SAFE_OBJECT_PROTOTYPE = Object.prototype;
const SAFE_REFLECT_OWN_KEYS = Reflect.ownKeys;
const SAFE_TEXT_DECODER = TextDecoder;
const SAFE_TEXT_DECODER_DECODE = TextDecoder.prototype.decode;
const SAFE_UTIL_IS_PROXY = utilTypes.isProxy;
const SAFE_UTIL_IS_UINT8_ARRAY = utilTypes.isUint8Array;

/** Frozen schema identifier for the I07-03 observation threshold. */
export const AFFECTED_OBSERVATION_THRESHOLD_PROFILE = "desen.ci.affected-observation-threshold.v1";

/** Frozen schema identifier for an append-only observation input. */
export const AFFECTED_OBSERVATION_LEDGER_PROFILE = "desen.ci.affected-observation-ledger.v1";

/** Reviewed digest of the normalized I07-03 threshold authority. */
export const EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256 =
  "ca6ee4128f2dbc581d033ebabe8e437268c8f7c5b29d6fbc7f9e3fb031b6c23c";

const MAX_THRESHOLD_BYTES = 64 * 1024;
const MAX_OBSERVATIONS = 1_024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const REVISION_PATTERN = /^[0-9a-f]{40}$/u;
const IDENTIFIER_PATTERN = /^[A-Z][A-Z0-9_]*$/u;
const ROOT_KEYS = SAFE_OBJECT_FREEZE([
  "schemaVersion",
  "profile",
  "authoritySha256",
  "requiredAuthority",
  "requiredScope",
  "minimumConsecutiveEligibleComparisons",
  "maximumFalseNegatives",
  "initialEligibleComparisonCount",
  "sameRevisionWithinComparisonRequired",
  "freshHostedExecutionsRequired",
  "cachedSuccessAllowed",
  "ownershipCategories",
  "decisionCategories",
]);
const CATEGORY_KEYS = SAFE_OBJECT_FREEZE(["id", "selectionPolicy"]);
const LEDGER_KEYS = SAFE_OBJECT_FREEZE([
  "schemaVersion",
  "profile",
  "thresholdSha256",
  "observations",
]);
const OBSERVATION_KEYS = SAFE_OBJECT_FREEZE([
  "sequence",
  "comparisonId",
  "affectedRunId",
  "exhaustiveRunId",
  "affectedRevision",
  "exhaustiveRevision",
  "thresholdSha256",
  "affectedSelectorSha256",
  "exhaustiveSelectorSha256",
  "affectedOwnershipSha256",
  "exhaustiveOwnershipSha256",
  "affectedInventorySha256",
  "exhaustiveInventorySha256",
  "decisionCategory",
  "strictSubset",
  "affectedStatus",
  "exhaustiveStatus",
]);
const RESULT_STATUSES = SAFE_OBJECT_FREEZE(["PASS", "FAIL", "CANCELLED", "INCOMPLETE", "NOT_RUN"]);
const SELECTION_POLICIES = SAFE_OBJECT_FREEZE(["STRICT_SUBSET_ELIGIBLE", "FORCE_EXHAUSTIVE"]);
const REVIEWED_OWNERSHIP_CATEGORIES = SAFE_OBJECT_FREEZE([
  SAFE_OBJECT_FREEZE({ id: "PROOF_UNIT", selectionPolicy: "STRICT_SUBSET_ELIGIBLE" }),
  SAFE_OBJECT_FREEZE({ id: "CI_POLICY", selectionPolicy: "FORCE_EXHAUSTIVE" }),
  SAFE_OBJECT_FREEZE({ id: "DEPENDENCY_POLICY", selectionPolicy: "FORCE_EXHAUSTIVE" }),
  SAFE_OBJECT_FREEZE({ id: "FROZEN_INPUT", selectionPolicy: "FORCE_EXHAUSTIVE" }),
  SAFE_OBJECT_FREEZE({ id: "PACKAGE_OR_APPLICATION", selectionPolicy: "FORCE_EXHAUSTIVE" }),
  SAFE_OBJECT_FREEZE({
    id: "SHARED_PROOF_INFRASTRUCTURE",
    selectionPolicy: "FORCE_EXHAUSTIVE",
  }),
  SAFE_OBJECT_FREEZE({ id: "PROJECT_DOCUMENTATION", selectionPolicy: "FORCE_EXHAUSTIVE" }),
  SAFE_OBJECT_FREEZE({ id: "REPOSITORY_POLICY", selectionPolicy: "FORCE_EXHAUSTIVE" }),
]);
const REVIEWED_DECISION_CATEGORIES = SAFE_OBJECT_FREEZE([
  SAFE_OBJECT_FREEZE({ id: "AFFECTED", selectionPolicy: "STRICT_SUBSET_ELIGIBLE" }),
  SAFE_OBJECT_FREEZE({ id: "POLICY_DRIFT", selectionPolicy: "FORCE_EXHAUSTIVE" }),
  SAFE_OBJECT_FREEZE({ id: "UNKNOWN_PATH", selectionPolicy: "FORCE_EXHAUSTIVE" }),
  SAFE_OBJECT_FREEZE({ id: "AMBIGUOUS_OWNER", selectionPolicy: "FORCE_EXHAUSTIVE" }),
  SAFE_OBJECT_FREEZE({ id: "UNTRUSTED_BASE", selectionPolicy: "FORCE_EXHAUSTIVE" }),
  SAFE_OBJECT_FREEZE({ id: "UNSUPPORTED_CHANGE", selectionPolicy: "FORCE_EXHAUSTIVE" }),
  SAFE_OBJECT_FREEZE({ id: "INVALID_DIFF", selectionPolicy: "FORCE_EXHAUSTIVE" }),
  SAFE_OBJECT_FREEZE({ id: "AUTHORITY_DRIFT", selectionPolicy: "FORCE_EXHAUSTIVE" }),
]);

/** Error raised when threshold or observation evidence is malformed or unsafe. */
export class AffectedObservationThresholdError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AffectedObservationThresholdError";
    this.code = code;
    this.details = SAFE_OBJECT_FREEZE({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new AffectedObservationThresholdError(code, message, details);
}

function exactOwnDataRecord(value, expectedKeys, label, code) {
  if (
    value === null ||
    typeof value !== "object" ||
    SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_UTIL_IS_PROXY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== SAFE_OBJECT_PROTOTYPE
  ) {
    fail(code, `${label} must be one inert ordinary own-data record.`);
  }
  const keys = SAFE_REFLECT_OWN_KEYS(value);
  if (keys.length !== expectedKeys.length) {
    fail(code, `${label} has an unexpected field count.`, { expectedKeys, actualKeys: keys });
  }
  const captured = {};
  for (let index = 0; index < expectedKeys.length; index += 1) {
    const expectedKey = expectedKeys[index];
    const key = keys[index];
    const descriptor =
      typeof key === "string" ? SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key) : undefined;
    if (
      key !== expectedKey ||
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !("value" in descriptor)
    ) {
      fail(code, `${label} fields must be exact ordered enumerable own data.`, {
        index,
        expectedKey,
        actualKey: typeof key === "string" ? key : String(key),
      });
    }
    captured[expectedKey] = descriptor.value;
  }
  return captured;
}

function exactDenseArray(value, label, maximumLength, code) {
  if (
    !SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_UTIL_IS_PROXY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== Array.prototype ||
    value.length > maximumLength
  ) {
    fail(code, `${label} must be one bounded inert array.`);
  }
  const keys = SAFE_REFLECT_OWN_KEYS(value);
  if (keys.length !== value.length + 1 || keys.at(-1) !== "length") {
    fail(code, `${label} must be dense and carry no extra fields.`);
  }
  const captured = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, String(index));
    if (descriptor === undefined || descriptor.enumerable !== true || !("value" in descriptor)) {
      fail(code, `${label}[${index}] must be inert own data.`);
    }
    captured.push(descriptor.value);
  }
  return captured;
}

function exactString(value, label, maximumLength, code) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximumLength) {
    fail(code, `${label} must be one bounded nonempty string.`);
  }
  return value;
}

function exactNullableString(value, label, maximumLength, code) {
  if (value === null) return null;
  return exactString(value, label, maximumLength, code);
}

function exactBoolean(value, label, code) {
  if (value !== true && value !== false) fail(code, `${label} must be boolean.`);
  return value;
}

function exactSafeInteger(value, label, minimum, maximum, code) {
  if (!SAFE_NUMBER_IS_SAFE_INTEGER(value) || value < minimum || value > maximum) {
    fail(code, `${label} must be one bounded safe integer.`, { value, minimum, maximum });
  }
  return value;
}

function exactSha256(value, label, code) {
  const digest = exactString(value, label, 64, code);
  if (!SHA256_PATTERN.test(digest)) fail(code, `${label} must be one lowercase SHA-256 digest.`);
  return digest;
}

function exactRevision(value, label, code) {
  const revision = exactString(value, label, 40, code);
  if (!REVISION_PATTERN.test(revision)) fail(code, `${label} must be one full lowercase Git SHA.`);
  return revision;
}

function exactNullableRevision(value, label, code) {
  if (value === null) return null;
  return exactRevision(value, label, code);
}

function assertAllowed(value, allowed, label, code) {
  if (!allowed.includes(value)) fail(code, `${label} uses an unsupported value.`, { value });
  return value;
}

function captureCategory(rawCategory, label, code) {
  const category = exactOwnDataRecord(rawCategory, CATEGORY_KEYS, label, code);
  category.id = exactString(category.id, `${label}.id`, 64, code);
  if (!IDENTIFIER_PATTERN.test(category.id)) fail(code, `${label}.id is not a safe identifier.`);
  category.selectionPolicy = assertAllowed(
    exactString(category.selectionPolicy, `${label}.selectionPolicy`, 64, code),
    SELECTION_POLICIES,
    `${label}.selectionPolicy`,
    code,
  );
  return category;
}

function assertReviewedCategories(actual, expected, label, code) {
  if (actual.length !== expected.length) {
    fail(code, `${label} count drifted.`, { expected: expected.length, actual: actual.length });
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (
      actual[index].id !== expected[index].id ||
      actual[index].selectionPolicy !== expected[index].selectionPolicy
    ) {
      fail(code, `${label} drifted from reviewed order or policy.`, {
        index,
        expected: expected[index],
        actual: actual[index],
      });
    }
  }
}

function normalizedThreshold(threshold) {
  return {
    schemaVersion: threshold.schemaVersion,
    profile: threshold.profile,
    requiredAuthority: threshold.requiredAuthority,
    requiredScope: threshold.requiredScope,
    minimumConsecutiveEligibleComparisons: threshold.minimumConsecutiveEligibleComparisons,
    maximumFalseNegatives: threshold.maximumFalseNegatives,
    initialEligibleComparisonCount: threshold.initialEligibleComparisonCount,
    sameRevisionWithinComparisonRequired: threshold.sameRevisionWithinComparisonRequired,
    freshHostedExecutionsRequired: threshold.freshHostedExecutionsRequired,
    cachedSuccessAllowed: threshold.cachedSuccessAllowed,
    ownershipCategories: threshold.ownershipCategories.map((category) => ({ ...category })),
    decisionCategories: threshold.decisionCategories.map((category) => ({ ...category })),
  };
}

function hashNormalizedThreshold(threshold) {
  return createHash("sha256")
    .update(SAFE_JSON_STRINGIFY(normalizedThreshold(threshold)))
    .digest("hex");
}

function captureThreshold(rawThreshold) {
  const code = "AFFECTED_THRESHOLD_INVALID";
  const threshold = exactOwnDataRecord(rawThreshold, ROOT_KEYS, "Affected threshold", code);
  if (
    threshold.schemaVersion !== 1 ||
    threshold.profile !== AFFECTED_OBSERVATION_THRESHOLD_PROFILE
  ) {
    fail(code, "Affected threshold schema version or profile is unknown.", {
      schemaVersion: threshold.schemaVersion,
      profile: threshold.profile,
    });
  }
  threshold.authoritySha256 = exactSha256(
    threshold.authoritySha256,
    "Affected threshold.authoritySha256",
    code,
  );
  if (threshold.requiredAuthority !== "SHADOW" || threshold.requiredScope !== "AFFECTED") {
    fail(code, "Affected threshold authority or scope drifted.");
  }
  threshold.minimumConsecutiveEligibleComparisons = exactSafeInteger(
    threshold.minimumConsecutiveEligibleComparisons,
    "Affected threshold.minimumConsecutiveEligibleComparisons",
    20,
    1_000,
    code,
  );
  threshold.maximumFalseNegatives = exactSafeInteger(
    threshold.maximumFalseNegatives,
    "Affected threshold.maximumFalseNegatives",
    0,
    0,
    code,
  );
  threshold.initialEligibleComparisonCount = exactSafeInteger(
    threshold.initialEligibleComparisonCount,
    "Affected threshold.initialEligibleComparisonCount",
    0,
    0,
    code,
  );
  threshold.sameRevisionWithinComparisonRequired = exactBoolean(
    threshold.sameRevisionWithinComparisonRequired,
    "Affected threshold.sameRevisionWithinComparisonRequired",
    code,
  );
  threshold.freshHostedExecutionsRequired = exactBoolean(
    threshold.freshHostedExecutionsRequired,
    "Affected threshold.freshHostedExecutionsRequired",
    code,
  );
  threshold.cachedSuccessAllowed = exactBoolean(
    threshold.cachedSuccessAllowed,
    "Affected threshold.cachedSuccessAllowed",
    code,
  );
  if (
    !threshold.sameRevisionWithinComparisonRequired ||
    !threshold.freshHostedExecutionsRequired ||
    threshold.cachedSuccessAllowed
  ) {
    fail(code, "Affected threshold safety invariants drifted.");
  }
  threshold.ownershipCategories = exactDenseArray(
    threshold.ownershipCategories,
    "Affected threshold.ownershipCategories",
    REVIEWED_OWNERSHIP_CATEGORIES.length,
    code,
  ).map((category, index) => captureCategory(category, `Ownership category ${index}`, code));
  threshold.decisionCategories = exactDenseArray(
    threshold.decisionCategories,
    "Affected threshold.decisionCategories",
    REVIEWED_DECISION_CATEGORIES.length,
    code,
  ).map((category, index) => captureCategory(category, `Decision category ${index}`, code));
  assertReviewedCategories(
    threshold.ownershipCategories,
    REVIEWED_OWNERSHIP_CATEGORIES,
    "Ownership categories",
    code,
  );
  assertReviewedCategories(
    threshold.decisionCategories,
    REVIEWED_DECISION_CATEGORIES,
    "Decision categories",
    code,
  );
  return threshold;
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const key of SAFE_REFLECT_OWN_KEYS(value)) deepFreeze(value[key]);
    SAFE_OBJECT_FREEZE(value);
  }
  return value;
}

/** Calculates the normalized threshold digest without trusting its self-declared digest. */
export function calculateAffectedObservationThresholdSha256(rawThreshold) {
  return hashNormalizedThreshold(captureThreshold(rawThreshold));
}

/** Validates one inert threshold and returns a deeply frozen canonical snapshot. */
export function validateAffectedObservationThreshold(rawThreshold) {
  const threshold = captureThreshold(rawThreshold);
  const calculated = hashNormalizedThreshold(threshold);
  if (
    threshold.authoritySha256 !== calculated ||
    calculated !== EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256
  ) {
    fail("AFFECTED_THRESHOLD_DIGEST_DRIFT", "Affected threshold authority digest drifted.", {
      declared: threshold.authoritySha256,
      calculated,
      expected: EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256,
    });
  }
  return deepFreeze(threshold);
}

function byteLength(bytes) {
  if (SAFE_UTIL_IS_PROXY(bytes) || !SAFE_UTIL_IS_UINT8_ARRAY(bytes)) {
    fail("AFFECTED_THRESHOLD_BYTES_INVALID", "Threshold bytes must be one Uint8Array.");
  }
  return bytes.byteLength;
}

function equalBytes(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

/** Decodes and validates the exact canonical UTF-8 threshold file representation. */
export function validateAffectedObservationThresholdBytes(rawBytes) {
  const length = byteLength(rawBytes);
  if (length === 0 || length > MAX_THRESHOLD_BYTES) {
    fail("AFFECTED_THRESHOLD_BYTES_INVALID", "Threshold bytes are empty or exceed their bound.", {
      length,
    });
  }
  let text;
  try {
    const decoder = new SAFE_TEXT_DECODER("utf-8", { fatal: true, ignoreBOM: true });
    text = SAFE_TEXT_DECODER_DECODE.call(decoder, rawBytes);
  } catch {
    fail("AFFECTED_THRESHOLD_BYTES_INVALID", "Threshold bytes are not valid UTF-8.");
  }
  let parsed;
  try {
    parsed = SAFE_JSON_PARSE(text);
  } catch {
    fail("AFFECTED_THRESHOLD_BYTES_INVALID", "Threshold bytes are not valid JSON.");
  }
  const threshold = validateAffectedObservationThreshold(parsed);
  const canonicalBytes = new TextEncoder().encode(`${SAFE_JSON_STRINGIFY(threshold, null, 2)}\n`);
  if (!equalBytes(rawBytes, canonicalBytes)) {
    fail(
      "AFFECTED_THRESHOLD_CANONICAL_DRIFT",
      "Threshold bytes differ from the reviewed canonical representation.",
    );
  }
  return threshold;
}

function categoryIds(categories) {
  return categories.map(({ id }) => id);
}

function captureObservation(rawObservation, index, threshold) {
  const code = "AFFECTED_OBSERVATION_INVALID";
  const label = `Affected observation ${index}`;
  const observation = exactOwnDataRecord(rawObservation, OBSERVATION_KEYS, label, code);
  observation.sequence = exactSafeInteger(
    observation.sequence,
    `${label}.sequence`,
    1,
    MAX_OBSERVATIONS,
    code,
  );
  if (observation.sequence !== index + 1) {
    fail(code, `${label}.sequence is not append-only and contiguous.`, {
      expected: index + 1,
      actual: observation.sequence,
    });
  }
  observation.comparisonId = exactString(
    observation.comparisonId,
    `${label}.comparisonId`,
    256,
    code,
  );
  observation.affectedRunId = exactNullableString(
    observation.affectedRunId,
    `${label}.affectedRunId`,
    256,
    code,
  );
  observation.exhaustiveRunId = exactString(
    observation.exhaustiveRunId,
    `${label}.exhaustiveRunId`,
    256,
    code,
  );
  observation.affectedRevision = exactNullableRevision(
    observation.affectedRevision,
    `${label}.affectedRevision`,
    code,
  );
  observation.exhaustiveRevision = exactRevision(
    observation.exhaustiveRevision,
    `${label}.exhaustiveRevision`,
    code,
  );
  for (const digestField of [
    "thresholdSha256",
    "affectedSelectorSha256",
    "exhaustiveSelectorSha256",
    "affectedOwnershipSha256",
    "exhaustiveOwnershipSha256",
    "affectedInventorySha256",
    "exhaustiveInventorySha256",
  ]) {
    observation[digestField] = exactSha256(
      observation[digestField],
      `${label}.${digestField}`,
      code,
    );
  }
  observation.decisionCategory = assertAllowed(
    exactString(observation.decisionCategory, `${label}.decisionCategory`, 64, code),
    categoryIds(threshold.decisionCategories),
    `${label}.decisionCategory`,
    code,
  );
  observation.strictSubset = exactBoolean(observation.strictSubset, `${label}.strictSubset`, code);
  observation.affectedStatus = assertAllowed(
    exactString(observation.affectedStatus, `${label}.affectedStatus`, 16, code),
    RESULT_STATUSES,
    `${label}.affectedStatus`,
    code,
  );
  observation.exhaustiveStatus = assertAllowed(
    exactString(observation.exhaustiveStatus, `${label}.exhaustiveStatus`, 16, code),
    RESULT_STATUSES.filter((status) => status !== "NOT_RUN"),
    `${label}.exhaustiveStatus`,
    code,
  );
  if (observation.thresholdSha256 !== threshold.authoritySha256) {
    fail("AFFECTED_OBSERVATION_THRESHOLD_DRIFT", `${label} cites a different threshold digest.`);
  }
  if (
    observation.affectedSelectorSha256 !== observation.exhaustiveSelectorSha256 ||
    observation.affectedOwnershipSha256 !== observation.exhaustiveOwnershipSha256 ||
    observation.affectedInventorySha256 !== observation.exhaustiveInventorySha256
  ) {
    fail("AFFECTED_OBSERVATION_AUTHORITY_MISMATCH", `${label} authority digests disagree.`);
  }

  const affected = observation.decisionCategory === "AFFECTED";
  if (affected) {
    if (
      !observation.strictSubset ||
      observation.affectedRunId === null ||
      observation.affectedRevision === null ||
      observation.affectedStatus === "NOT_RUN" ||
      observation.affectedRunId === observation.exhaustiveRunId
    ) {
      fail(code, `${label} is not an independent strict-subset comparison declaration.`);
    }
    if (observation.affectedRevision !== observation.exhaustiveRevision) {
      fail("AFFECTED_OBSERVATION_REVISION_MISMATCH", `${label} revisions disagree.`);
    }
  } else if (
    observation.strictSubset ||
    observation.affectedRunId !== null ||
    observation.affectedRevision !== null ||
    observation.affectedStatus !== "NOT_RUN"
  ) {
    fail(code, `${label} exhaustive fallback falsely carries an affected execution.`);
  }
  return observation;
}

function assertNoReplay(observations) {
  const comparisonIds = new Set();
  const runIds = new Set();
  for (const observation of observations) {
    if (comparisonIds.has(observation.comparisonId)) {
      fail("AFFECTED_OBSERVATION_REPLAY", "An observation comparison ID was replayed.", {
        comparisonId: observation.comparisonId,
      });
    }
    comparisonIds.add(observation.comparisonId);
    for (const runId of [observation.affectedRunId, observation.exhaustiveRunId]) {
      if (runId === null) continue;
      if (runIds.has(runId)) {
        fail("AFFECTED_OBSERVATION_REPLAY", "A hosted run ID was replayed.", { runId });
      }
      runIds.add(runId);
    }
  }
}

function authorityTuple(observation) {
  return [
    observation.affectedSelectorSha256,
    observation.affectedOwnershipSha256,
    observation.affectedInventorySha256,
  ].join(":");
}

/**
 * Evaluates inert caller-declared observations against the frozen I07-03 threshold.
 *
 * Exhaustive fallbacks are measured but never count. Controlled failure, cancellation,
 * incompleteness, terminal mismatch, or authority drift resets the consecutive eligible streak.
 * Replay, threshold drift, within-comparison digest mismatch, and revision mismatch are rejected.
 * This pure evaluator cannot authenticate hosted-run provenance, so it never grants promotion.
 */
export function evaluateAffectedObservationLedger(rawLedger, rawThreshold) {
  const threshold = validateAffectedObservationThreshold(rawThreshold);
  const code = "AFFECTED_OBSERVATION_LEDGER_INVALID";
  const ledger = exactOwnDataRecord(rawLedger, LEDGER_KEYS, "Affected observation ledger", code);
  if (ledger.schemaVersion !== 1 || ledger.profile !== AFFECTED_OBSERVATION_LEDGER_PROFILE) {
    fail(code, "Affected observation ledger schema version or profile is unknown.");
  }
  ledger.thresholdSha256 = exactSha256(
    ledger.thresholdSha256,
    "Affected observation ledger.thresholdSha256",
    code,
  );
  if (ledger.thresholdSha256 !== threshold.authoritySha256) {
    fail("AFFECTED_OBSERVATION_THRESHOLD_DRIFT", "The ledger cites a different threshold digest.");
  }
  ledger.observations = exactDenseArray(
    ledger.observations,
    "Affected observation ledger.observations",
    MAX_OBSERVATIONS,
    code,
  ).map((observation, index) => captureObservation(observation, index, threshold));
  assertNoReplay(ledger.observations);

  let consecutiveEligibleComparisons = threshold.initialEligibleComparisonCount;
  let eligibleComparisonCount = threshold.initialEligibleComparisonCount;
  let exhaustiveFallbackCount = 0;
  let falseNegativeCount = 0;
  let resetCount = 0;
  let lastResetReason = null;
  let previousAuthorityTuple = null;

  for (const observation of ledger.observations) {
    if (observation.decisionCategory !== "AFFECTED") {
      exhaustiveFallbackCount += 1;
      if (observation.exhaustiveStatus !== "PASS") {
        consecutiveEligibleComparisons = 0;
        resetCount += 1;
        lastResetReason = observation.exhaustiveStatus;
      }
      continue;
    }

    const currentAuthorityTuple = authorityTuple(observation);
    if (previousAuthorityTuple !== null && previousAuthorityTuple !== currentAuthorityTuple) {
      consecutiveEligibleComparisons = 0;
      resetCount += 1;
      lastResetReason = "AUTHORITY_DIGEST_DRIFT";
    }
    previousAuthorityTuple = currentAuthorityTuple;

    if (observation.affectedStatus === "PASS" && observation.exhaustiveStatus === "FAIL") {
      falseNegativeCount += 1;
      consecutiveEligibleComparisons = 0;
      resetCount += 1;
      lastResetReason = "FALSE_NEGATIVE";
      continue;
    }
    if (
      observation.affectedStatus !== "PASS" ||
      observation.exhaustiveStatus !== "PASS" ||
      observation.affectedStatus !== observation.exhaustiveStatus
    ) {
      consecutiveEligibleComparisons = 0;
      resetCount += 1;
      lastResetReason =
        observation.affectedStatus === observation.exhaustiveStatus
          ? observation.affectedStatus
          : "TERMINAL_MISMATCH";
      continue;
    }
    consecutiveEligibleComparisons += 1;
    eligibleComparisonCount += 1;
  }

  const falseNegativeLimitSatisfied = falseNegativeCount <= threshold.maximumFalseNegatives;
  const comparisonThresholdSatisfied =
    consecutiveEligibleComparisons >= threshold.minimumConsecutiveEligibleComparisons;
  const thresholdSatisfied = falseNegativeLimitSatisfied && comparisonThresholdSatisfied;

  return deepFreeze({
    profile: AFFECTED_OBSERVATION_LEDGER_PROFILE,
    thresholdSha256: threshold.authoritySha256,
    status: thresholdSatisfied ? "AUTHENTICATED_REVIEW_REQUIRED" : "OBSERVING",
    thresholdSatisfied,
    promotionEligible: false,
    hostedEvidenceAuthenticated: false,
    authenticatedReviewRequired: true,
    categoryMutationCoverageAuthority: "CODE_OWNED_CONTRACT_TESTS",
    reviewedOwnershipCategoryCount: threshold.ownershipCategories.length,
    reviewedDecisionCategoryCount: threshold.decisionCategories.length,
    falseNegativeLimitSatisfied,
    comparisonThresholdSatisfied,
    eligibleComparisonCount,
    consecutiveEligibleComparisons,
    requiredConsecutiveEligibleComparisons: threshold.minimumConsecutiveEligibleComparisons,
    exhaustiveFallbackCount,
    falseNegativeCount,
    resetCount,
    lastResetReason,
  });
}
