import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fileConstants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { types as utilTypes } from "node:util";

import { validateAffectedChangeBoundaryReceipt } from "./affected-change-boundary.mjs";
import {
  EXPECTED_AFFECTED_IMPACT_GRAPH_SHA256,
  createAffectedImpactClosure,
} from "./affected-impact-graph.mjs";
import { EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256 } from "./affected-observation-threshold.mjs";
import {
  AFFECTED_OWNERSHIP_DISPOSITIONS,
  EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256,
  createAffectedWorkloadOwnership,
  resolveAffectedWorkloadOwner,
} from "./affected-workload-ownership.mjs";
import {
  EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
  createExhaustiveWorkloadInventory,
} from "./exhaustive-workload-inventory.mjs";

const PROFILE = "desen.ci.shadow-affected-selector.v1";
const CHANGE_BOUNDARY_PROFILE = "desen.ci.affected-change-boundary.v1";
const COMPARISON_AUTHORITY_PROFILE = "desen.ci.shadow-affected-comparison-authority.v1";
const DEFAULT_WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../..");
const SOURCE_READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const MAXIMUM_COMPARISON_SOURCE_BYTES = 32 * 1024 * 1024;
const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_JSON_STRINGIFY = JSON.stringify;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const SAFE_OBJECT_IS_FROZEN = Object.isFrozen;
const SAFE_OBJECT_PROTOTYPE = Object.prototype;
const SAFE_REFLECT_OWN_KEYS = Reflect.ownKeys;
const SAFE_UTIL_IS_PROXY = utilTypes.isProxy;
const REVISION_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const CHANGE_BOUNDARY_KEYS = SAFE_OBJECT_FREEZE([
  "schemaVersion",
  "profile",
  "authority",
  "selection",
  "reason",
  "baseRevision",
  "headRevision",
  "executionRevision",
  "mergeBaseRevision",
  "trackedPathCount",
  "trackedPathSetSha256",
  "trackedPaths",
  "changeCount",
  "changeSetSha256",
  "changes",
]);
const CHANGE_KEYS = SAFE_OBJECT_FREEZE([
  "path",
  "status",
  "mode",
  "beforeObjectId",
  "afterObjectId",
]);
const SELECTION_KEYS = SAFE_OBJECT_FREEZE([
  "schemaVersion",
  "profile",
  "status",
  "authority",
  "requestedScope",
  "effectiveScope",
  "decisionCategory",
  "reason",
  "baseRevision",
  "headRevision",
  "executionRevision",
  "mergeBaseRevision",
  "inventorySha256",
  "ownershipSha256",
  "impactGraphSha256",
  "thresholdSha256",
  "selectorSha256",
  "changeSetSha256",
  "changedPaths",
  "ownerProofUnitIds",
  "affectedProofUnitIds",
  "nodeIds",
  "workloadCount",
  "proofUnitCount",
  "strictSubset",
  "planSha256",
]);
const DECISION_CATEGORIES = SAFE_OBJECT_FREEZE([
  "AFFECTED",
  "POLICY_DRIFT",
  "UNKNOWN_PATH",
  "AMBIGUOUS_OWNER",
  "UNTRUSTED_BASE",
  "UNSUPPORTED_CHANGE",
  "INVALID_DIFF",
  "AUTHORITY_DRIFT",
]);
const AUTHENTIC_SELECTIONS = new WeakSet();
const SOURCE_RECEIPT_KEYS = SAFE_OBJECT_FREEZE(["path", "mode", "byteLength", "byteSha256"]);

/** Exact ordered source inventory that owns I07-03 affected/exhaustive comparison continuity. */
export const SHADOW_AFFECTED_COMPARISON_AUTHORITY_PATHS = SAFE_OBJECT_FREEZE([
  ".github/workflows/ci.yml",
  ".node-version",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "dependency-cruiser.config.cjs",
  "scripts/ci/affected-change-boundary.mjs",
  "scripts/ci/affected-impact-graph.mjs",
  "scripts/ci/affected-observation-threshold.json",
  "scripts/ci/affected-observation-threshold.mjs",
  "scripts/ci/affected-workload-ownership.mjs",
  "scripts/ci/affected-workload-selector.mjs",
  "scripts/ci/exhaustive-gate-boundary.mjs",
  "scripts/ci/exhaustive-workload-inventory.mjs",
  "scripts/ci/run-required-exhaustive-quality-gate.mjs",
  "scripts/ci/run-shadow-affected-quality-gate.mjs",
  "scripts/ci/shared-state-authority.mjs",
]);

/** Stable failure raised when a shadow selection is malformed or substituted. */
export class AffectedWorkloadSelectorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AffectedWorkloadSelectorError";
    this.code = code;
    this.details = SAFE_OBJECT_FREEZE({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new AffectedWorkloadSelectorError(code, message, details);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !SAFE_OBJECT_IS_FROZEN(value)) {
    for (const key of SAFE_REFLECT_OWN_KEYS(value)) deepFreeze(value[key]);
    SAFE_OBJECT_FREEZE(value);
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(SAFE_JSON_STRINGIFY(value)).digest("hex");
}

function exactRecord(value, expectedKeys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_UTIL_IS_PROXY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== SAFE_OBJECT_PROTOTYPE
  ) {
    fail("AFFECTED_SELECTOR_INPUT_INVALID", `${label} must be one inert plain object.`);
  }
  const keys = SAFE_REFLECT_OWN_KEYS(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    fail("AFFECTED_SELECTOR_INPUT_INVALID", `${label} fields drifted.`, {
      expected: expectedKeys,
      actual: keys.map(String),
    });
  }
  const captured = {};
  for (const key of expectedKeys) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail("AFFECTED_SELECTOR_INPUT_INVALID", `${label}.${key} must be inert own data.`);
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
    fail("AFFECTED_SELECTOR_INPUT_INVALID", `${label} must be one bounded dense array.`);
  }
  return value.map((entry, index) => {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail("AFFECTED_SELECTOR_INPUT_INVALID", `${label}[${index}] must be inert own data.`);
    }
    return descriptor.value;
  });
}

function exactString(value, label, maximumLength = 4_096) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximumLength) {
    fail("AFFECTED_SELECTOR_INPUT_INVALID", `${label} must be one bounded nonempty string.`);
  }
  return value;
}

function nullableRevision(value, label) {
  if (value === null) return null;
  if (typeof value !== "string" || !REVISION_PATTERN.test(value)) {
    fail("AFFECTED_SELECTOR_INPUT_INVALID", `${label} must be one exact revision or null.`);
  }
  return value;
}

function nullableSha256(value, label) {
  if (value === null) return null;
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail("AFFECTED_SELECTOR_INPUT_INVALID", `${label} must be one SHA-256 or null.`);
  }
  return value;
}

function sameSourceStat(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function sourceMode(stats, relativePath) {
  const executableBits = stats.mode & 0o111n;
  if (executableBits !== 0n && executableBits !== 0o111n) {
    fail(
      "AFFECTED_SELECTOR_SOURCE_MODE_UNSUPPORTED",
      `Comparison-authority source "${relativePath}" has ambiguous executable mode bits.`,
    );
  }
  return executableBits === 0n ? "100644" : "100755";
}

function captureComparisonAuthoritySource(relativePath) {
  const absolutePath = path.join(DEFAULT_WORKSPACE_ROOT, ...relativePath.split("/"));
  let descriptor;
  try {
    const pathBefore = lstatSync(absolutePath, { bigint: true });
    if (!pathBefore.isFile() || pathBefore.isSymbolicLink()) {
      fail(
        "AFFECTED_SELECTOR_SOURCE_UNSAFE",
        `Comparison-authority source "${relativePath}" is not a regular non-symbolic file.`,
      );
    }
    descriptor = openSync(absolutePath, SOURCE_READ_FLAGS);
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || !sameSourceStat(pathBefore, before)) {
      fail(
        "AFFECTED_SELECTOR_SOURCE_DRIFT",
        `Comparison-authority source "${relativePath}" changed before it could be read.`,
      );
    }
    if (before.size > BigInt(MAXIMUM_COMPARISON_SOURCE_BYTES)) {
      fail(
        "AFFECTED_SELECTOR_SOURCE_LIMIT",
        `Comparison-authority source "${relativePath}" exceeds the byte limit.`,
      );
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(absolutePath, { bigint: true });
    if (
      !pathAfter.isFile() ||
      pathAfter.isSymbolicLink() ||
      !sameSourceStat(before, after) ||
      !sameSourceStat(after, pathAfter) ||
      BigInt(bytes.byteLength) !== after.size
    ) {
      fail(
        "AFFECTED_SELECTOR_SOURCE_DRIFT",
        `Comparison-authority source "${relativePath}" changed while it was read.`,
      );
    }
    return SAFE_OBJECT_FREEZE({
      path: relativePath,
      mode: sourceMode(after, relativePath),
      byteLength: bytes.byteLength,
      byteSha256: createHash("sha256").update(bytes).digest("hex"),
    });
  } catch (error) {
    if (error instanceof AffectedWorkloadSelectorError) throw error;
    fail(
      "AFFECTED_SELECTOR_SOURCE_UNAVAILABLE",
      `Comparison-authority source "${relativePath}" could not be read safely.`,
      { path: relativePath, causeCode: typeof error?.code === "string" ? error.code : null },
    );
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

/** Pure canonical digest calculator for an exact ordered comparison-authority source receipt. */
export function calculateShadowAffectedComparisonAuthority(rawSources) {
  const sources = exactArray(
    rawSources,
    "Shadow affected comparison-authority sources",
    SHADOW_AFFECTED_COMPARISON_AUTHORITY_PATHS.length,
  );
  if (sources.length !== SHADOW_AFFECTED_COMPARISON_AUTHORITY_PATHS.length) {
    fail(
      "AFFECTED_SELECTOR_SOURCE_INVENTORY_DRIFT",
      "Shadow affected comparison-authority source count drifted.",
    );
  }
  const canonicalSources = sources.map((rawSource, index) => {
    const source = exactRecord(
      rawSource,
      SOURCE_RECEIPT_KEYS,
      `Shadow affected comparison-authority source ${index}`,
    );
    const expectedPath = SHADOW_AFFECTED_COMPARISON_AUTHORITY_PATHS[index];
    if (source.path !== expectedPath) {
      fail(
        "AFFECTED_SELECTOR_SOURCE_INVENTORY_DRIFT",
        `Comparison-authority source ${index} must be "${expectedPath}".`,
      );
    }
    if (!["100644", "100755"].includes(source.mode)) {
      fail(
        "AFFECTED_SELECTOR_SOURCE_RECEIPT_INVALID",
        `Comparison-authority source "${expectedPath}" has an invalid mode.`,
      );
    }
    if (
      !Number.isSafeInteger(source.byteLength) ||
      source.byteLength < 0 ||
      source.byteLength > MAXIMUM_COMPARISON_SOURCE_BYTES ||
      typeof source.byteSha256 !== "string" ||
      !SHA256_PATTERN.test(source.byteSha256)
    ) {
      fail(
        "AFFECTED_SELECTOR_SOURCE_RECEIPT_INVALID",
        `Comparison-authority source "${expectedPath}" has invalid byte authority.`,
      );
    }
    return {
      path: source.path,
      mode: source.mode,
      byteLength: source.byteLength,
      byteSha256: source.byteSha256,
    };
  });
  return sha256({
    schemaVersion: 1,
    profile: COMPARISON_AUTHORITY_PROFILE,
    sources: canonicalSources,
  });
}

const COMPARISON_AUTHORITY_SOURCES = SAFE_OBJECT_FREEZE(
  SHADOW_AFFECTED_COMPARISON_AUTHORITY_PATHS.map(captureComparisonAuthoritySource),
);

/**
 * Composite digest binding the exact code-owned authority used to compare affected and exhaustive
 * observations. The compatibility name is retained for existing receipts.
 */
export const EXPECTED_SHADOW_AFFECTED_SELECTOR_SHA256 = calculateShadowAffectedComparisonAuthority(
  COMPARISON_AUTHORITY_SOURCES,
);

function validateChangedPath(rawPath, label) {
  const changedPath = exactString(rawPath, label);
  if (
    changedPath.startsWith("/") ||
    changedPath.endsWith("/") ||
    changedPath.includes("\\") ||
    changedPath.includes("//") ||
    changedPath.normalize("NFC") !== changedPath ||
    changedPath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    fail("AFFECTED_SELECTOR_INPUT_INVALID", `${label} is not a safe repository-relative path.`);
  }
  return changedPath;
}

function captureChangeBoundary(rawBoundary) {
  let authenticBoundary;
  try {
    authenticBoundary = validateAffectedChangeBoundaryReceipt(rawBoundary);
  } catch {
    fail(
      "AFFECTED_SELECTOR_BOUNDARY_UNTRUSTED",
      "Affected change receipt was not minted by the boundary authority.",
    );
  }
  const boundary = exactRecord(authenticBoundary, CHANGE_BOUNDARY_KEYS, "Affected change receipt");
  if (
    boundary.schemaVersion !== 1 ||
    boundary.profile !== CHANGE_BOUNDARY_PROFILE ||
    boundary.authority !== "SHADOW" ||
    !["AFFECTED", "EXHAUSTIVE"].includes(boundary.selection)
  ) {
    fail("AFFECTED_SELECTOR_INPUT_INVALID", "Affected change receipt authority drifted.");
  }
  boundary.reason = exactString(boundary.reason, "Affected change receipt reason", 128);
  boundary.baseRevision = nullableRevision(boundary.baseRevision, "Affected change receipt base");
  boundary.headRevision = nullableRevision(boundary.headRevision, "Affected change receipt head");
  boundary.executionRevision = nullableRevision(
    boundary.executionRevision,
    "Affected change receipt execution revision",
  );
  boundary.mergeBaseRevision = nullableRevision(
    boundary.mergeBaseRevision,
    "Affected change receipt merge base",
  );
  boundary.trackedPathSetSha256 = nullableSha256(
    boundary.trackedPathSetSha256,
    "Affected change receipt tracked path digest",
  );
  boundary.changeSetSha256 = nullableSha256(
    boundary.changeSetSha256,
    "Affected change receipt change-set digest",
  );
  boundary.trackedPaths = exactArray(
    boundary.trackedPaths,
    "Affected change receipt tracked paths",
    16_384,
  ).map((entry, index) => validateChangedPath(entry, `Affected tracked path ${index}`));
  boundary.changes = exactArray(boundary.changes, "Affected change receipt changes", 2_048).map(
    (rawChange, index) => {
      const change = exactRecord(rawChange, CHANGE_KEYS, `Affected change ${index}`);
      change.path = validateChangedPath(change.path, `Affected change ${index}.path`);
      if (
        change.status !== "M" ||
        !["100644", "100755"].includes(change.mode) ||
        !REVISION_PATTERN.test(change.beforeObjectId) ||
        !REVISION_PATTERN.test(change.afterObjectId)
      ) {
        fail("AFFECTED_SELECTOR_INPUT_INVALID", `Affected change ${index} is unsupported.`);
      }
      return change;
    },
  );
  if (
    !Number.isSafeInteger(boundary.trackedPathCount) ||
    !Number.isSafeInteger(boundary.changeCount) ||
    boundary.trackedPathCount !== boundary.trackedPaths.length ||
    boundary.changeCount !== boundary.changes.length
  ) {
    fail("AFFECTED_SELECTOR_INPUT_INVALID", "Affected change receipt counts drifted.");
  }

  if (boundary.selection === "EXHAUSTIVE") {
    if (
      [
        boundary.baseRevision,
        boundary.headRevision,
        boundary.executionRevision,
        boundary.mergeBaseRevision,
        boundary.trackedPathSetSha256,
        boundary.changeSetSha256,
      ].some((value) => value !== null) ||
      boundary.trackedPathCount !== 0 ||
      boundary.changeCount !== 0
    ) {
      fail("AFFECTED_SELECTOR_INPUT_INVALID", "Exhaustive fallback leaked partial selection data.");
    }
    return boundary;
  }

  if (
    [
      boundary.baseRevision,
      boundary.headRevision,
      boundary.executionRevision,
      boundary.mergeBaseRevision,
      boundary.trackedPathSetSha256,
      boundary.changeSetSha256,
    ].some((value) => value === null) ||
    boundary.trackedPathCount === 0 ||
    boundary.changeCount === 0
  ) {
    fail("AFFECTED_SELECTOR_INPUT_INVALID", "Affected receipt is incomplete.");
  }
  const sortedTrackedPaths = [...boundary.trackedPaths].sort();
  const sortedChanges = [...boundary.changes].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  if (
    new Set(boundary.trackedPaths).size !== boundary.trackedPaths.length ||
    new Set(boundary.changes.map(({ path }) => path)).size !== boundary.changes.length ||
    SAFE_JSON_STRINGIFY(sortedTrackedPaths) !== SAFE_JSON_STRINGIFY(boundary.trackedPaths) ||
    SAFE_JSON_STRINGIFY(sortedChanges) !== SAFE_JSON_STRINGIFY(boundary.changes)
  ) {
    fail("AFFECTED_SELECTOR_INPUT_INVALID", "Affected paths are duplicated or not canonical.");
  }
  const expectedTrackedDigest = sha256({
    profile: CHANGE_BOUNDARY_PROFILE,
    executionRevision: boundary.executionRevision,
    trackedPaths: boundary.trackedPaths,
  });
  const expectedChangeDigest = sha256({
    profile: CHANGE_BOUNDARY_PROFILE,
    baseRevision: boundary.baseRevision,
    headRevision: boundary.headRevision,
    executionRevision: boundary.executionRevision,
    mergeBaseRevision: boundary.mergeBaseRevision,
    trackedPathSetSha256: expectedTrackedDigest,
    changes: boundary.changes,
  });
  if (
    boundary.trackedPathSetSha256 !== expectedTrackedDigest ||
    boundary.changeSetSha256 !== expectedChangeDigest
  ) {
    fail("AFFECTED_SELECTOR_INPUT_INVALID", "Affected change receipt digest drifted.");
  }
  return boundary;
}

function boundaryDecision(reason) {
  if (
    [
      "UNTRUSTED_REPOSITORY",
      "REPOSITORY_SHALLOW",
      "REVISION_UNAVAILABLE",
      "EXECUTION_REVISION_MISMATCH",
      "EXECUTION_PARENT_MISMATCH",
      "MERGE_BASE_AMBIGUOUS",
      "ANCESTRY_UNTRUSTED",
    ].includes(reason)
  ) {
    return "UNTRUSTED_BASE";
  }
  if (
    ["UNSUPPORTED_CHANGE_KIND", "UNSUPPORTED_FILE_MODE", "TRACKED_TREE_UNSUPPORTED"].includes(
      reason,
    )
  ) {
    return "UNSUPPORTED_CHANGE";
  }
  return "INVALID_DIFF";
}

function selectionProjection(selection) {
  return {
    schemaVersion: selection.schemaVersion,
    profile: selection.profile,
    authority: selection.authority,
    requestedScope: selection.requestedScope,
    effectiveScope: selection.effectiveScope,
    decisionCategory: selection.decisionCategory,
    reason: selection.reason,
    baseRevision: selection.baseRevision,
    headRevision: selection.headRevision,
    executionRevision: selection.executionRevision,
    mergeBaseRevision: selection.mergeBaseRevision,
    inventorySha256: selection.inventorySha256,
    ownershipSha256: selection.ownershipSha256,
    impactGraphSha256: selection.impactGraphSha256,
    thresholdSha256: selection.thresholdSha256,
    selectorSha256: selection.selectorSha256,
    changeSetSha256: selection.changeSetSha256,
    changedPaths: selection.changedPaths,
    ownerProofUnitIds: selection.ownerProofUnitIds,
    affectedProofUnitIds: selection.affectedProofUnitIds,
    nodeIds: selection.nodeIds,
  };
}

function finalizeSelection({
  effectiveScope,
  decisionCategory,
  reason,
  boundary,
  changedPaths = [],
  ownerProofUnitIds = [],
  affectedProofUnitIds = [],
  nodeIds,
}) {
  const inventory = createExhaustiveWorkloadInventory();
  const base = {
    schemaVersion: 1,
    profile: PROFILE,
    status: "PLANNED",
    authority: "SHADOW",
    requestedScope: "AFFECTED",
    effectiveScope,
    decisionCategory,
    reason,
    baseRevision: boundary.baseRevision,
    headRevision: boundary.headRevision,
    executionRevision: boundary.executionRevision,
    mergeBaseRevision: boundary.mergeBaseRevision,
    inventorySha256: inventory.inventorySha256,
    ownershipSha256: EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256,
    impactGraphSha256: EXPECTED_AFFECTED_IMPACT_GRAPH_SHA256,
    thresholdSha256: EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256,
    selectorSha256: EXPECTED_SHADOW_AFFECTED_SELECTOR_SHA256,
    changeSetSha256: boundary.changeSetSha256,
    changedPaths,
    ownerProofUnitIds,
    affectedProofUnitIds,
    nodeIds,
    workloadCount: nodeIds.length,
    proofUnitCount: affectedProofUnitIds.length,
    strictSubset: effectiveScope === "AFFECTED" && nodeIds.length < inventory.workloadCount,
  };
  const selection = deepFreeze({ ...base, planSha256: sha256(selectionProjection(base)) });
  AUTHENTIC_SELECTIONS.add(selection);
  return selection;
}

function exhaustiveSelection(boundary, decisionCategory, reason) {
  const inventory = createExhaustiveWorkloadInventory();
  return finalizeSelection({
    effectiveScope: "EXHAUSTIVE",
    decisionCategory,
    reason,
    boundary,
    nodeIds: inventory.nodes.map(({ id }) => id),
  });
}

/** Converts an authenticated Git receipt into a non-authoritative affected execution plan. */
export function createShadowAffectedSelection(rawBoundary) {
  let boundary;
  try {
    boundary = captureChangeBoundary(rawBoundary);
  } catch (error) {
    const fallbackBoundary = {
      baseRevision: null,
      headRevision: null,
      executionRevision: null,
      mergeBaseRevision: null,
      changeSetSha256: null,
    };
    return exhaustiveSelection(fallbackBoundary, "INVALID_DIFF", error.code ?? "INPUT_INVALID");
  }
  if (boundary.selection === "EXHAUSTIVE") {
    return exhaustiveSelection(boundary, boundaryDecision(boundary.reason), boundary.reason);
  }

  let ownership;
  try {
    ownership = createAffectedWorkloadOwnership(boundary.trackedPaths);
  } catch (error) {
    return exhaustiveSelection(boundary, "AUTHORITY_DRIFT", error.code ?? "OWNERSHIP_DRIFT");
  }
  const owners = [];
  const categories = new Set();
  for (const change of boundary.changes) {
    let owner;
    try {
      owner = resolveAffectedWorkloadOwner(ownership, change.path);
    } catch (error) {
      return exhaustiveSelection(boundary, "UNKNOWN_PATH", error.code ?? "UNKNOWN_PATH");
    }
    categories.add(owner.category);
    if (owner.disposition === AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE) {
      return exhaustiveSelection(boundary, "POLICY_DRIFT", `FORCE_EXHAUSTIVE_${owner.category}`);
    }
    owners.push(owner.proofUnitId);
  }
  const ownerProofUnitIds = [
    ...new Set(
      createExhaustiveWorkloadInventory()
        .proofUnits.map(({ id }) => id)
        .filter((id) => owners.includes(id)),
    ),
  ];
  if (ownerProofUnitIds.length === 0 || categories.size !== 1 || !categories.has("PROOF_UNIT")) {
    return exhaustiveSelection(boundary, "AMBIGUOUS_OWNER", "OWNER_SET_AMBIGUOUS");
  }

  let impact;
  try {
    impact = createAffectedImpactClosure(ownerProofUnitIds);
  } catch (error) {
    return exhaustiveSelection(boundary, "AUTHORITY_DRIFT", error.code ?? "IMPACT_GRAPH_DRIFT");
  }
  const inventory = createExhaustiveWorkloadInventory();
  if (impact.nodeIds.length >= inventory.workloadCount) {
    return exhaustiveSelection(boundary, "POLICY_DRIFT", "IMPACT_EXPANDED_TO_EXHAUSTIVE");
  }
  return finalizeSelection({
    effectiveScope: "AFFECTED",
    decisionCategory: "AFFECTED",
    reason: "ELIGIBLE_PROOF_UNIT_CLOSURE",
    boundary,
    changedPaths: boundary.changes.map(({ path }) => path),
    ownerProofUnitIds,
    affectedProofUnitIds: impact.proofUnitIds,
    nodeIds: impact.nodeIds,
  });
}

/** Admits only an object returned by the code-owned selector in this process. */
export function validateShadowAffectedSelection(candidate) {
  if (!AUTHENTIC_SELECTIONS.has(candidate)) {
    fail("AFFECTED_SELECTOR_PLAN_UNTRUSTED", "Shadow execution refused a fabricated selection.");
  }
  exactRecord(candidate, SELECTION_KEYS, "Shadow affected selection");
  if (
    candidate.status !== "PLANNED" ||
    candidate.authority !== "SHADOW" ||
    candidate.requestedScope !== "AFFECTED" ||
    !["AFFECTED", "EXHAUSTIVE"].includes(candidate.effectiveScope) ||
    !DECISION_CATEGORIES.includes(candidate.decisionCategory) ||
    candidate.inventorySha256 !== EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256 ||
    candidate.ownershipSha256 !== EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256 ||
    candidate.impactGraphSha256 !== EXPECTED_AFFECTED_IMPACT_GRAPH_SHA256 ||
    candidate.thresholdSha256 !== EXPECTED_AFFECTED_OBSERVATION_THRESHOLD_SHA256 ||
    candidate.selectorSha256 !== EXPECTED_SHADOW_AFFECTED_SELECTOR_SHA256 ||
    candidate.planSha256 !== sha256(selectionProjection(candidate))
  ) {
    fail("AFFECTED_SELECTOR_PLAN_DRIFT", "Shadow affected selection authority drifted.");
  }
  if (
    candidate.workloadCount !== candidate.nodeIds.length ||
    candidate.proofUnitCount !== candidate.affectedProofUnitIds.length ||
    candidate.strictSubset !==
      (candidate.effectiveScope === "AFFECTED" &&
        candidate.workloadCount < createExhaustiveWorkloadInventory().workloadCount)
  ) {
    fail("AFFECTED_SELECTOR_PLAN_DRIFT", "Shadow affected selection counts drifted.");
  }
  return candidate;
}

export { DECISION_CATEGORIES, PROFILE };
