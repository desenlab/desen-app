import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { types as utilTypes } from "node:util";

import {
  createExhaustiveWorkloadInventory,
  validateExhaustiveWorkloadInventory,
} from "./exhaustive-workload-inventory.mjs";

const PROFILE = "desen.ci.affected-workload-ownership.v1";
const PATH_SET_PROFILE = "desen.ci.affected-tracked-path-set.v1";
const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_JSON_STRINGIFY = JSON.stringify;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const SAFE_OBJECT_PROTOTYPE = Object.prototype;
const SAFE_REFLECT_OWN_KEYS = Reflect.ownKeys;
const SAFE_UTIL_IS_PROXY = utilTypes.isProxy;

const MAXIMUM_TRACKED_PATHS = 16_384;
const MAXIMUM_TRACKED_PATH_BYTES = 4 * 1024;
const MAXIMUM_TRACKED_PATH_SET_BYTES = 16 * 1024 * 1024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

/** Exact categories frozen by the I07-03 observation threshold. */
export const AFFECTED_OWNERSHIP_CATEGORIES = SAFE_OBJECT_FREEZE({
  PROOF_UNIT: "PROOF_UNIT",
  CI_POLICY: "CI_POLICY",
  DEPENDENCY_POLICY: "DEPENDENCY_POLICY",
  FROZEN_INPUT: "FROZEN_INPUT",
  PACKAGE_OR_APPLICATION: "PACKAGE_OR_APPLICATION",
  SHARED_PROOF_INFRASTRUCTURE: "SHARED_PROOF_INFRASTRUCTURE",
  PROJECT_DOCUMENTATION: "PROJECT_DOCUMENTATION",
  REPOSITORY_POLICY: "REPOSITORY_POLICY",
});

export const AFFECTED_OWNERSHIP_DISPOSITIONS = SAFE_OBJECT_FREEZE({
  SELECT_PROOF_UNIT: "SELECT_PROOF_UNIT",
  FORCE_EXHAUSTIVE: "FORCE_EXHAUSTIVE",
});

const CATEGORY_IDS = SAFE_OBJECT_FREEZE(Object.values(AFFECTED_OWNERSHIP_CATEGORIES));
const AUTHORITY_KEYS = SAFE_OBJECT_FREEZE([
  "schemaVersion",
  "profile",
  "trackedPathCount",
  "trackedPathSetSha256",
  "proofOwnedPathCount",
  "categoryCounts",
  "entries",
  "ownershipSha256",
]);
const ENTRY_KEYS = SAFE_OBJECT_FREEZE([
  "path",
  "category",
  "disposition",
  "proofUnitId",
  "verifierNodeId",
  "rootTestNodeId",
]);

const DEPENDENCY_POLICY_ROOT_PATHS = new Set([
  ".node-version",
  "dependency-cruiser.config.cjs",
  "eslint.config.mjs",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "prettier.config.mjs",
  "tsconfig.base.json",
  "tsconfig.browser.json",
  "tsconfig.json",
  "tsconfig.node.json",
  "tsconfig.react-web.json",
  "tsconfig.react.json",
  "turbo.json",
]);
const CI_POLICY_EXACT_PATHS = new Set([
  "scripts/run-ci-quality-gate.mjs",
  "scripts/test/ci-quality-gate.test.mjs",
]);
const PROJECT_DOCUMENTATION_ROOT_PATHS = new Set(["PROJECT-STATUS.md", "README.md"]);

/** Reviewed count for the live CI-03 fresh-proof performance successor authority. */
export const EXPECTED_AFFECTED_TRACKED_PATH_COUNT = 1419;

/** Reviewed SHA-256 of the ordered complete tracked-path set. */
export const EXPECTED_AFFECTED_TRACKED_PATH_SET_SHA256 =
  "688fecd205711a2dd637b9f336b9fbf1564e098476f041d6d18028b3c6e0421e";

/** Reviewed SHA-256 of every exact path, category, disposition, and proof owner. */
export const EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256 =
  "98ecf40d65550a02f9b57e3b771db673e4b274dfd8225d346e79d7ee8de0eb98";

/** Exact number of verifier/root-test inputs owned by the current 104 proof units. */
export const EXPECTED_AFFECTED_PROOF_OWNED_PATH_COUNT = 208;

/** Stable failure raised when path ownership is incomplete, ambiguous, or substituted. */
export class AffectedWorkloadOwnershipError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AffectedWorkloadOwnershipError";
    this.code = code;
    this.details = SAFE_OBJECT_FREEZE({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new AffectedWorkloadOwnershipError(code, message, details);
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of SAFE_REFLECT_OWN_KEYS(value)) deepFreeze(value[key]);
    SAFE_OBJECT_FREEZE(value);
  }
  return value;
}

function exactRecord(value, expectedKeys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_UTIL_IS_PROXY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== SAFE_OBJECT_PROTOTYPE
  ) {
    fail("AFFECTED_OWNERSHIP_INPUT_INVALID", `${label} must be one inert plain object.`);
  }
  const ownKeys = SAFE_REFLECT_OWN_KEYS(value);
  if (
    ownKeys.length !== expectedKeys.length ||
    ownKeys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    fail("AFFECTED_OWNERSHIP_INPUT_INVALID", `${label} fields drifted.`, {
      expected: expectedKeys,
      actual: ownKeys.map(String),
    });
  }
  const captured = {};
  for (const key of expectedKeys) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    if (!descriptor || descriptor.enumerable !== true || !("value" in descriptor)) {
      fail("AFFECTED_OWNERSHIP_INPUT_INVALID", `${label}.${key} must be inert own data.`);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function exactArray(value, label, maximumLength) {
  if (
    !SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_UTIL_IS_PROXY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== Array.prototype ||
    value.length > maximumLength ||
    SAFE_REFLECT_OWN_KEYS(value).length !== value.length + 1
  ) {
    fail(
      "AFFECTED_OWNERSHIP_INPUT_OVER_BUDGET",
      `${label} must be one bounded dense inert array.`,
      { maximumLength },
    );
  }
  const captured = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, String(index));
    if (!descriptor || descriptor.enumerable !== true || !("value" in descriptor)) {
      fail("AFFECTED_OWNERSHIP_INPUT_INVALID", `${label}[${index}] must be inert own data.`);
    }
    captured.push(descriptor.value);
  }
  return captured;
}

function exactString(value, label, maximumBytes = MAXIMUM_TRACKED_PATH_BYTES) {
  if (typeof value !== "string" || value.length === 0 || Buffer.byteLength(value) > maximumBytes) {
    fail("AFFECTED_OWNERSHIP_INPUT_INVALID", `${label} must be one bounded nonempty string.`);
  }
  return value;
}

function nullableString(value, label) {
  return value === null ? null : exactString(value, label, 256);
}

function assertWellFormedUnicode(value, label) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        fail("AFFECTED_OWNERSHIP_PATH_INVALID", `${label} contains an unpaired surrogate.`);
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      fail("AFFECTED_OWNERSHIP_PATH_INVALID", `${label} contains an unpaired surrogate.`);
    }
  }
}

function containsUnsafePathCharacter(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function capturePath(value, label) {
  const trackedPath = exactString(value, label);
  assertWellFormedUnicode(trackedPath, label);
  if (
    trackedPath.startsWith("/") ||
    trackedPath.endsWith("/") ||
    trackedPath.includes("\\") ||
    trackedPath.includes("//") ||
    containsUnsafePathCharacter(trackedPath) ||
    trackedPath
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..") ||
    trackedPath.normalize("NFC") !== trackedPath
  ) {
    fail(
      "AFFECTED_OWNERSHIP_PATH_INVALID",
      `${label} is not one normalized repository-relative path.`,
      { path: trackedPath },
    );
  }
  return trackedPath;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function captureTrackedPaths(rawPaths) {
  const paths = exactArray(rawPaths, "Tracked paths", MAXIMUM_TRACKED_PATHS).map((value, index) =>
    capturePath(value, `Tracked paths[${index}]`),
  );
  const totalBytes = paths.reduce((sum, trackedPath) => sum + Buffer.byteLength(trackedPath), 0);
  if (totalBytes > MAXIMUM_TRACKED_PATH_SET_BYTES) {
    fail(
      "AFFECTED_OWNERSHIP_INPUT_OVER_BUDGET",
      "The tracked-path set exceeds its reviewed byte budget.",
      { totalBytes, maximumBytes: MAXIMUM_TRACKED_PATH_SET_BYTES },
    );
  }
  for (let index = 1; index < paths.length; index += 1) {
    const comparison = compareUtf8(paths[index - 1], paths[index]);
    if (comparison === 0) {
      fail(
        "AFFECTED_OWNERSHIP_PATH_AMBIGUOUS",
        "A tracked path has more than one ownership record.",
        { path: paths[index] },
      );
    }
    if (comparison > 0) {
      fail(
        "AFFECTED_OWNERSHIP_PATH_ORDER_INVALID",
        "Tracked paths must retain canonical Git byte order.",
        { previous: paths[index - 1], current: paths[index] },
      );
    }
  }
  return paths;
}

function sha256(value) {
  return createHash("sha256").update(SAFE_JSON_STRINGIFY(value)).digest("hex");
}

/** Calculates the frozen projection digest for one validated ordered tracked-path set. */
export function calculateAffectedTrackedPathSetSha256(rawPaths) {
  const paths = captureTrackedPaths(rawPaths);
  return sha256({ schemaVersion: 1, profile: PATH_SET_PROFILE, paths });
}

function canonicalProofPathOwners() {
  const inventory = validateExhaustiveWorkloadInventory(createExhaustiveWorkloadInventory());
  const nodeById = new Map(inventory.nodes.map((workload) => [workload.id, workload]));
  const ownerByPath = new Map();

  for (const unit of inventory.proofUnits) {
    const verifier = nodeById.get(unit.verifierNodeId);
    const rootTest = nodeById.get(unit.rootTestNodeId);
    const verifierPath = verifier?.args.length === 1 ? verifier.args[0] : undefined;
    const rootTestPath = rootTest?.args.at(-1);
    if (
      verifier?.command !== "node" ||
      rootTest?.command !== "node" ||
      typeof verifierPath !== "string" ||
      !verifierPath.startsWith("scripts/verify-") ||
      !verifierPath.endsWith(".mjs") ||
      typeof rootTestPath !== "string" ||
      !rootTestPath.startsWith("tests/") ||
      !rootTestPath.endsWith(".test.mjs")
    ) {
      fail(
        "AFFECTED_OWNERSHIP_PROOF_GRAPH_INVALID",
        `Proof unit "${unit.id}" has unsupported verifier or root-test identity.`,
      );
    }

    const owner = SAFE_OBJECT_FREEZE({
      proofUnitId: unit.id,
      verifierNodeId: unit.verifierNodeId,
      rootTestNodeId: unit.rootTestNodeId,
    });
    for (const ownedPath of [verifierPath, rootTestPath]) {
      if (ownerByPath.has(ownedPath)) {
        fail(
          "AFFECTED_OWNERSHIP_PATH_AMBIGUOUS",
          "Two proof units claim the same exact tracked input.",
          { path: ownedPath, owners: [ownerByPath.get(ownedPath).proofUnitId, unit.id] },
        );
      }
      ownerByPath.set(ownedPath, owner);
    }
  }

  if (ownerByPath.size !== EXPECTED_AFFECTED_PROOF_OWNED_PATH_COUNT) {
    fail(
      "AFFECTED_OWNERSHIP_PROOF_GRAPH_INVALID",
      "The exact verifier/root-test owner set drifted from review.",
      { expected: EXPECTED_AFFECTED_PROOF_OWNED_PATH_COUNT, actual: ownerByPath.size },
    );
  }
  return ownerByPath;
}

function isCiPolicyPath(trackedPath) {
  return (
    trackedPath.startsWith(".github/") ||
    trackedPath.startsWith("scripts/ci/") ||
    CI_POLICY_EXACT_PATHS.has(trackedPath)
  );
}

function isFrozenInputPath(trackedPath) {
  return (
    trackedPath.startsWith("docs/proof/artifacts/") ||
    trackedPath.startsWith("docs/proof/baselines/") ||
    trackedPath.startsWith("packages/protocol/upstream/")
  );
}

function isDependencyPolicyPath(trackedPath) {
  return (
    !isFrozenInputPath(trackedPath) &&
    (DEPENDENCY_POLICY_ROOT_PATHS.has(trackedPath) || trackedPath.endsWith("/package.json"))
  );
}

function isPackageOrApplicationPath(trackedPath) {
  return (
    (trackedPath.startsWith("apps/") ||
      trackedPath.startsWith("examples/") ||
      trackedPath.startsWith("packages/")) &&
    !isFrozenInputPath(trackedPath) &&
    !isDependencyPolicyPath(trackedPath)
  );
}

function isSharedProofInfrastructurePath(trackedPath, proofPathOwners) {
  return (
    (trackedPath.startsWith("scripts/") || trackedPath.startsWith("tests/")) &&
    !proofPathOwners.has(trackedPath) &&
    !isCiPolicyPath(trackedPath)
  );
}

function isProjectDocumentationPath(trackedPath) {
  return (
    PROJECT_DOCUMENTATION_ROOT_PATHS.has(trackedPath) ||
    (trackedPath.startsWith("docs/") && !isFrozenInputPath(trackedPath))
  );
}

function isRepositoryPolicyPath(trackedPath) {
  return (
    (trackedPath.startsWith(".changeset/") || !trackedPath.includes("/")) &&
    !isDependencyPolicyPath(trackedPath) &&
    !isProjectDocumentationPath(trackedPath)
  );
}

function matchingCategories(trackedPath, proofPathOwners) {
  const matches = [];
  if (proofPathOwners.has(trackedPath)) matches.push(AFFECTED_OWNERSHIP_CATEGORIES.PROOF_UNIT);
  if (isCiPolicyPath(trackedPath)) matches.push(AFFECTED_OWNERSHIP_CATEGORIES.CI_POLICY);
  if (isDependencyPolicyPath(trackedPath)) {
    matches.push(AFFECTED_OWNERSHIP_CATEGORIES.DEPENDENCY_POLICY);
  }
  if (isFrozenInputPath(trackedPath)) matches.push(AFFECTED_OWNERSHIP_CATEGORIES.FROZEN_INPUT);
  if (isPackageOrApplicationPath(trackedPath)) {
    matches.push(AFFECTED_OWNERSHIP_CATEGORIES.PACKAGE_OR_APPLICATION);
  }
  if (isSharedProofInfrastructurePath(trackedPath, proofPathOwners)) {
    matches.push(AFFECTED_OWNERSHIP_CATEGORIES.SHARED_PROOF_INFRASTRUCTURE);
  }
  if (isProjectDocumentationPath(trackedPath)) {
    matches.push(AFFECTED_OWNERSHIP_CATEGORIES.PROJECT_DOCUMENTATION);
  }
  if (isRepositoryPolicyPath(trackedPath)) {
    matches.push(AFFECTED_OWNERSHIP_CATEGORIES.REPOSITORY_POLICY);
  }
  return matches;
}

function createEntry(trackedPath, proofPathOwners) {
  const matches = matchingCategories(trackedPath, proofPathOwners);
  if (matches.length === 0) {
    fail(
      "AFFECTED_OWNERSHIP_PATH_UNOWNED",
      "A tracked path has no exact code-owned selector category.",
      { path: trackedPath },
    );
  }
  if (matches.length !== 1) {
    fail(
      "AFFECTED_OWNERSHIP_PATH_AMBIGUOUS",
      "A tracked path matches more than one selector category.",
      { path: trackedPath, categories: matches },
    );
  }

  const category = matches[0];
  const owner = proofPathOwners.get(trackedPath);
  if (category === AFFECTED_OWNERSHIP_CATEGORIES.PROOF_UNIT) {
    if (!owner) {
      fail(
        "AFFECTED_OWNERSHIP_PROOF_OWNER_UNKNOWN",
        "A proof-owned path has no exact proof-unit owner.",
        { path: trackedPath },
      );
    }
    return {
      path: trackedPath,
      category,
      disposition: AFFECTED_OWNERSHIP_DISPOSITIONS.SELECT_PROOF_UNIT,
      proofUnitId: owner.proofUnitId,
      verifierNodeId: owner.verifierNodeId,
      rootTestNodeId: owner.rootTestNodeId,
    };
  }
  return {
    path: trackedPath,
    category,
    disposition: AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE,
    proofUnitId: null,
    verifierNodeId: null,
    rootTestNodeId: null,
  };
}

function emptyCategoryCounts() {
  return Object.fromEntries(CATEGORY_IDS.map((category) => [category, 0]));
}

function countCategories(entries) {
  const counts = emptyCategoryCounts();
  for (const entry of entries) counts[entry.category] += 1;
  return counts;
}

function ownershipProjection(authority) {
  return {
    schemaVersion: authority.schemaVersion,
    profile: authority.profile,
    trackedPathCount: authority.trackedPathCount,
    trackedPathSetSha256: authority.trackedPathSetSha256,
    proofOwnedPathCount: authority.proofOwnedPathCount,
    categoryCounts: authority.categoryCounts,
    entries: authority.entries,
  };
}

function calculateOwnershipSha256(authority) {
  return sha256(ownershipProjection(authority));
}

function buildOwnershipCandidate(trackedPaths) {
  const trackedPathSetSha256 = calculateAffectedTrackedPathSetSha256(trackedPaths);
  const proofPathOwners = canonicalProofPathOwners();
  const entries = trackedPaths.map((trackedPath) => createEntry(trackedPath, proofPathOwners));
  const categoryCounts = countCategories(entries);
  const base = {
    schemaVersion: 1,
    profile: PROFILE,
    trackedPathCount: entries.length,
    trackedPathSetSha256,
    proofOwnedPathCount: categoryCounts[AFFECTED_OWNERSHIP_CATEGORIES.PROOF_UNIT],
    categoryCounts,
    entries,
  };
  return {
    ...base,
    ownershipSha256: calculateOwnershipSha256(base),
  };
}

function captureCategoryCounts(rawCounts) {
  const counts = exactRecord(rawCounts, CATEGORY_IDS, "Ownership category counts");
  for (const category of CATEGORY_IDS) {
    if (
      !Number.isSafeInteger(counts[category]) ||
      counts[category] < 0 ||
      counts[category] > MAXIMUM_TRACKED_PATHS
    ) {
      fail(
        "AFFECTED_OWNERSHIP_INPUT_INVALID",
        `Ownership category count "${category}" is outside its bound.`,
      );
    }
  }
  return counts;
}

function captureEntry(rawEntry, index, proofPathOwners) {
  const label = `Ownership entry ${index}`;
  const entry = exactRecord(rawEntry, ENTRY_KEYS, label);
  entry.path = capturePath(entry.path, `${label}.path`);
  entry.category = exactString(entry.category, `${label}.category`, 64);
  entry.disposition = exactString(entry.disposition, `${label}.disposition`, 64);
  entry.proofUnitId = nullableString(entry.proofUnitId, `${label}.proofUnitId`);
  entry.verifierNodeId = nullableString(entry.verifierNodeId, `${label}.verifierNodeId`);
  entry.rootTestNodeId = nullableString(entry.rootTestNodeId, `${label}.rootTestNodeId`);

  const expected = createEntry(entry.path, proofPathOwners);
  if (entry.category !== expected.category || entry.disposition !== expected.disposition) {
    fail(
      "AFFECTED_OWNERSHIP_RULE_SUBSTITUTED",
      "A path category or selector disposition drifted from code-owned ownership.",
      {
        path: entry.path,
        expectedCategory: expected.category,
        actualCategory: entry.category,
        expectedDisposition: expected.disposition,
        actualDisposition: entry.disposition,
      },
    );
  }
  for (const field of ["proofUnitId", "verifierNodeId", "rootTestNodeId"]) {
    if (entry[field] !== expected[field]) {
      fail(
        "AFFECTED_OWNERSHIP_PROOF_OWNER_UNKNOWN",
        "A path names an unknown or substituted proof-unit owner.",
        { path: entry.path, field, expected: expected[field], actual: entry[field] },
      );
    }
  }
  return entry;
}

function captureAuthority(candidate, { enforceReviewedPins }) {
  const authority = exactRecord(candidate, AUTHORITY_KEYS, "Affected ownership authority");
  if (authority.schemaVersion !== 1 || authority.profile !== PROFILE) {
    fail(
      "AFFECTED_OWNERSHIP_PROFILE_UNKNOWN",
      "The affected ownership profile or schema version is unknown.",
      { schemaVersion: authority.schemaVersion, profile: authority.profile },
    );
  }
  if (
    !Number.isSafeInteger(authority.trackedPathCount) ||
    authority.trackedPathCount < 1 ||
    authority.trackedPathCount > MAXIMUM_TRACKED_PATHS ||
    !Number.isSafeInteger(authority.proofOwnedPathCount) ||
    authority.proofOwnedPathCount < 0 ||
    authority.proofOwnedPathCount > authority.trackedPathCount
  ) {
    fail("AFFECTED_OWNERSHIP_INPUT_INVALID", "Affected ownership counts are invalid.");
  }
  authority.trackedPathSetSha256 = exactString(
    authority.trackedPathSetSha256,
    "Affected ownership trackedPathSetSha256",
    64,
  );
  authority.ownershipSha256 = exactString(
    authority.ownershipSha256,
    "Affected ownership ownershipSha256",
    64,
  );
  if (
    !SHA256_PATTERN.test(authority.trackedPathSetSha256) ||
    !SHA256_PATTERN.test(authority.ownershipSha256)
  ) {
    fail("AFFECTED_OWNERSHIP_DIGEST_INVALID", "Affected ownership digests are invalid.");
  }

  const proofPathOwners = canonicalProofPathOwners();
  authority.categoryCounts = captureCategoryCounts(authority.categoryCounts);
  authority.entries = exactArray(
    authority.entries,
    "Affected ownership entries",
    MAXIMUM_TRACKED_PATHS,
  ).map((entry, index) => captureEntry(entry, index, proofPathOwners));

  if (authority.entries.length !== authority.trackedPathCount) {
    fail(
      "AFFECTED_OWNERSHIP_PATH_COVERAGE_GAP",
      "The ownership record count does not cover every declared tracked path.",
      { declared: authority.trackedPathCount, actual: authority.entries.length },
    );
  }
  const paths = captureTrackedPaths(authority.entries.map(({ path: trackedPath }) => trackedPath));
  const calculatedPathSetSha256 = calculateAffectedTrackedPathSetSha256(paths);
  if (authority.trackedPathSetSha256 !== calculatedPathSetSha256) {
    fail(
      "AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT",
      "The declared tracked-path digest does not authenticate the exact ownership entries.",
      { declared: authority.trackedPathSetSha256, calculated: calculatedPathSetSha256 },
    );
  }

  const calculatedCounts = countCategories(authority.entries);
  if (SAFE_JSON_STRINGIFY(authority.categoryCounts) !== SAFE_JSON_STRINGIFY(calculatedCounts)) {
    fail(
      "AFFECTED_OWNERSHIP_CATEGORY_COUNT_DRIFT",
      "The category counts do not cover the exact ownership entries.",
      { declared: authority.categoryCounts, calculated: calculatedCounts },
    );
  }
  const calculatedProofOwnedPathCount = calculatedCounts[AFFECTED_OWNERSHIP_CATEGORIES.PROOF_UNIT];
  if (authority.proofOwnedPathCount !== calculatedProofOwnedPathCount) {
    fail(
      "AFFECTED_OWNERSHIP_PROOF_COUNT_DRIFT",
      "The proof-owned path count drifted from the exact category entries.",
      { declared: authority.proofOwnedPathCount, calculated: calculatedProofOwnedPathCount },
    );
  }

  const calculatedOwnershipSha256 = calculateOwnershipSha256(authority);
  if (authority.ownershipSha256 !== calculatedOwnershipSha256) {
    fail("AFFECTED_OWNERSHIP_DIGEST_DRIFT", "The ownership self-digest is invalid.", {
      declared: authority.ownershipSha256,
      calculated: calculatedOwnershipSha256,
    });
  }

  if (
    enforceReviewedPins &&
    (authority.trackedPathCount !== EXPECTED_AFFECTED_TRACKED_PATH_COUNT ||
      authority.trackedPathSetSha256 !== EXPECTED_AFFECTED_TRACKED_PATH_SET_SHA256 ||
      authority.proofOwnedPathCount !== EXPECTED_AFFECTED_PROOF_OWNED_PATH_COUNT ||
      authority.ownershipSha256 !== EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256)
  ) {
    fail(
      "AFFECTED_OWNERSHIP_REVIEWED_AUTHORITY_DRIFT",
      "The affected ownership authority differs from the reviewed I07-03 freeze.",
      {
        expectedPathCount: EXPECTED_AFFECTED_TRACKED_PATH_COUNT,
        actualPathCount: authority.trackedPathCount,
        expectedPathSetSha256: EXPECTED_AFFECTED_TRACKED_PATH_SET_SHA256,
        actualPathSetSha256: authority.trackedPathSetSha256,
        expectedProofOwnedPathCount: EXPECTED_AFFECTED_PROOF_OWNED_PATH_COUNT,
        actualProofOwnedPathCount: authority.proofOwnedPathCount,
        expectedOwnershipSha256: EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256,
        actualOwnershipSha256: authority.ownershipSha256,
      },
    );
  }
  return deepFreeze(authority);
}

/**
 * Builds the reviewed exact-one path ownership authority from inert Git-discovered paths.
 *
 * This function never reads Git or the filesystem. Callers own no selection authority until the
 * supplied path set matches the frozen count and digest below.
 */
export function createAffectedWorkloadOwnership(rawTrackedPaths) {
  const trackedPaths = captureTrackedPaths(rawTrackedPaths);
  const candidate = buildOwnershipCandidate(trackedPaths);
  if (
    trackedPaths.length !== EXPECTED_AFFECTED_TRACKED_PATH_COUNT ||
    candidate.trackedPathSetSha256 !== EXPECTED_AFFECTED_TRACKED_PATH_SET_SHA256
  ) {
    fail(
      "AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT",
      "The discovered tracked-path set differs from the reviewed I07-03 freeze.",
      {
        expectedCount: EXPECTED_AFFECTED_TRACKED_PATH_COUNT,
        actualCount: trackedPaths.length,
        expectedSha256: EXPECTED_AFFECTED_TRACKED_PATH_SET_SHA256,
        actualSha256: candidate.trackedPathSetSha256,
      },
    );
  }
  return validateAffectedWorkloadOwnership(candidate);
}

/**
 * Calculates the inert review receipt used to reseal counts and digests after planned I07 files
 * join the tracked set. The receipt has no selection authority; only the pinned validator above
 * can authenticate a live owner table.
 */
export function calculateAffectedWorkloadOwnershipReview(rawTrackedPaths) {
  const candidate = buildOwnershipCandidate(captureTrackedPaths(rawTrackedPaths));
  return deepFreeze({
    trackedPathCount: candidate.trackedPathCount,
    trackedPathSetSha256: candidate.trackedPathSetSha256,
    proofOwnedPathCount: candidate.proofOwnedPathCount,
    categoryCounts: candidate.categoryCounts,
    ownershipSha256: candidate.ownershipSha256,
  });
}

/** Calculates the stable ownership digest after exact structural and owner validation. */
export function calculateAffectedWorkloadOwnershipSha256(candidate) {
  const captured = captureAuthority(candidate, { enforceReviewedPins: false });
  return calculateOwnershipSha256(captured);
}

/** Validates a supplied authority and returns a detached deeply frozen canonical capture. */
export function validateAffectedWorkloadOwnership(candidate) {
  return captureAuthority(candidate, { enforceReviewedPins: true });
}

/** Returns the exact owner record, rejecting any path outside the frozen tracked authority. */
export function resolveAffectedWorkloadOwner(authority, rawPath) {
  const validated = validateAffectedWorkloadOwnership(authority);
  const trackedPath = capturePath(rawPath, "Affected changed path");
  const entry = validated.entries.find(({ path: candidate }) => candidate === trackedPath);
  if (!entry) {
    fail(
      "AFFECTED_OWNERSHIP_PATH_UNOWNED",
      "The changed path is outside the frozen exact ownership authority.",
      { path: trackedPath },
    );
  }
  return entry;
}
