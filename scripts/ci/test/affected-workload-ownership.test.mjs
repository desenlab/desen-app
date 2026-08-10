import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  AFFECTED_OWNERSHIP_CATEGORIES,
  AFFECTED_OWNERSHIP_DISPOSITIONS,
  EXPECTED_AFFECTED_PROOF_OWNED_PATH_COUNT,
  EXPECTED_AFFECTED_TRACKED_PATH_COUNT,
  EXPECTED_AFFECTED_TRACKED_PATH_SET_SHA256,
  EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256,
  AffectedWorkloadOwnershipError,
  calculateAffectedTrackedPathSetSha256,
  calculateAffectedWorkloadOwnershipReview,
  calculateAffectedWorkloadOwnershipSha256,
  createAffectedWorkloadOwnership,
  resolveAffectedWorkloadOwner,
  validateAffectedWorkloadOwnership,
} from "../affected-workload-ownership.mjs";
import { createExhaustiveWorkloadInventory } from "../exhaustive-workload-inventory.mjs";

const EXEC_FILE = promisify(execFileCallback);
const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../..");
const EXPECTED_CATEGORY_COUNTS = Object.freeze({
  PROOF_UNIT: 138,
  CI_POLICY: 42,
  DEPENDENCY_POLICY: 30,
  FROZEN_INPUT: 112,
  PACKAGE_OR_APPLICATION: 375,
  SHARED_PROOF_INFRASTRUCTURE: 167,
  PROJECT_DOCUMENTATION: 104,
  REPOSITORY_POLICY: 11,
});

async function currentTrackedPaths() {
  const { stdout } = await EXEC_FILE("git", ["ls-files", "-z"], {
    cwd: WORKSPACE_ROOT,
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout.toString("utf8").split("\0").filter(Boolean);
}

async function currentAuthority() {
  return createAffectedWorkloadOwnership(await currentTrackedPaths());
}

function expectCode(code) {
  return (error) => {
    assert.ok(error instanceof AffectedWorkloadOwnershipError);
    assert.equal(error.code, code);
    return true;
  };
}

function assertDeepFrozen(value, visited = new Set()) {
  if (value === null || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const key of Reflect.ownKeys(value)) assertDeepFrozen(value[key], visited);
}

test("freezes exact-one ownership for all 979 reviewed tracked paths", async () => {
  const paths = await currentTrackedPaths();
  const authority = createAffectedWorkloadOwnership(paths);

  assert.equal(paths.length, EXPECTED_AFFECTED_TRACKED_PATH_COUNT);
  assert.equal(authority.schemaVersion, 1);
  assert.equal(authority.profile, "desen.ci.affected-workload-ownership.v1");
  assert.equal(authority.trackedPathCount, EXPECTED_AFFECTED_TRACKED_PATH_COUNT);
  assert.equal(authority.entries.length, EXPECTED_AFFECTED_TRACKED_PATH_COUNT);
  assert.equal(authority.proofOwnedPathCount, EXPECTED_AFFECTED_PROOF_OWNED_PATH_COUNT);
  assert.equal(authority.trackedPathSetSha256, EXPECTED_AFFECTED_TRACKED_PATH_SET_SHA256);
  assert.equal(authority.ownershipSha256, EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256);
  assert.equal(calculateAffectedTrackedPathSetSha256(paths), authority.trackedPathSetSha256);
  assert.equal(calculateAffectedWorkloadOwnershipSha256(authority), authority.ownershipSha256);
  assert.deepEqual(authority.categoryCounts, EXPECTED_CATEGORY_COUNTS);
  assert.deepEqual(calculateAffectedWorkloadOwnershipReview(paths), {
    trackedPathCount: EXPECTED_AFFECTED_TRACKED_PATH_COUNT,
    trackedPathSetSha256: EXPECTED_AFFECTED_TRACKED_PATH_SET_SHA256,
    proofOwnedPathCount: EXPECTED_AFFECTED_PROOF_OWNED_PATH_COUNT,
    categoryCounts: EXPECTED_CATEGORY_COUNTS,
    ownershipSha256: EXPECTED_AFFECTED_WORKLOAD_OWNERSHIP_SHA256,
  });
  assert.equal(new Set(authority.entries.map(({ path: trackedPath }) => trackedPath)).size, 979);
  assert.deepEqual(
    authority.entries.map(({ path: trackedPath }) => trackedPath),
    paths,
  );
  assertDeepFrozen(authority);
});

test("permits strict selection only for exact verifier and root-test proof inputs", async () => {
  const authority = await currentAuthority();
  const inventory = createExhaustiveWorkloadInventory();
  const nodeById = new Map(inventory.nodes.map((workload) => [workload.id, workload]));
  const proofEntries = authority.entries.filter(
    ({ category }) => category === AFFECTED_OWNERSHIP_CATEGORIES.PROOF_UNIT,
  );

  assert.equal(proofEntries.length, 138);
  for (const entry of proofEntries) {
    assert.equal(entry.disposition, AFFECTED_OWNERSHIP_DISPOSITIONS.SELECT_PROOF_UNIT);
    const verifier = nodeById.get(entry.verifierNodeId);
    const rootTest = nodeById.get(entry.rootTestNodeId);
    assert.ok(verifier);
    assert.ok(rootTest);
    assert.ok([verifier.args[0], rootTest.args.at(-1)].includes(entry.path));
    assert.equal(
      inventory.proofUnits.some(
        (unit) =>
          unit.id === entry.proofUnitId &&
          unit.verifierNodeId === entry.verifierNodeId &&
          unit.rootTestNodeId === entry.rootTestNodeId,
      ),
      true,
    );
  }

  for (const entry of authority.entries.filter(
    ({ category }) => category !== AFFECTED_OWNERSHIP_CATEGORIES.PROOF_UNIT,
  )) {
    assert.equal(entry.disposition, AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE);
    assert.equal(entry.proofUnitId, null);
    assert.equal(entry.verifierNodeId, null);
    assert.equal(entry.rootTestNodeId, null);
  }
});

test("keeps all eight threshold categories populated and mutually exclusive", async () => {
  const authority = await currentAuthority();
  assert.deepEqual(
    Object.keys(authority.categoryCounts),
    Object.values(AFFECTED_OWNERSHIP_CATEGORIES),
  );
  assert.equal(
    Object.values(authority.categoryCounts).reduce((total, count) => total + count, 0),
    authority.trackedPathCount,
  );
  for (const category of Object.values(AFFECTED_OWNERSHIP_CATEGORIES)) {
    assert.ok(authority.categoryCounts[category] > 0, `${category} must own at least one path`);
  }
});

test("resolves only records inside the frozen path authority", async () => {
  const authority = await currentAuthority();
  const expected = authority.entries.find(
    ({ path: trackedPath }) => trackedPath === "scripts/verify-protocol-snapshot.mjs",
  );
  assert.deepEqual(resolveAffectedWorkloadOwner(authority, expected.path), expected);
  assert.throws(
    () => resolveAffectedWorkloadOwner(authority, "new/unreviewed-path.ts"),
    expectCode("AFFECTED_OWNERSHIP_PATH_UNOWNED"),
  );
});

test("rejects a missing ownership record as a coverage gap", async () => {
  const candidate = structuredClone(await currentAuthority());
  candidate.entries.pop();
  assert.throws(
    () => validateAffectedWorkloadOwnership(candidate),
    expectCode("AFFECTED_OWNERSHIP_PATH_COVERAGE_GAP"),
  );
});

test("rejects duplicate ownership records as ambiguous", async () => {
  const candidate = structuredClone(await currentAuthority());
  candidate.entries[1] = structuredClone(candidate.entries[0]);
  assert.throws(
    () => validateAffectedWorkloadOwnership(candidate),
    expectCode("AFFECTED_OWNERSHIP_PATH_AMBIGUOUS"),
  );
});

test("rejects unknown or substituted proof-unit owners", async () => {
  const candidate = structuredClone(await currentAuthority());
  const proofEntry = candidate.entries.find(
    ({ category }) => category === AFFECTED_OWNERSHIP_CATEGORIES.PROOF_UNIT,
  );
  proofEntry.proofUnitId = "unknown-proof-unit";
  assert.throws(
    () => validateAffectedWorkloadOwnership(candidate),
    expectCode("AFFECTED_OWNERSHIP_PROOF_OWNER_UNKNOWN"),
  );
});

test("rejects category and FORCE_EXHAUSTIVE disposition substitutions", async () => {
  const authority = await currentAuthority();
  const categoryCandidate = structuredClone(authority);
  const packageEntry = categoryCandidate.entries.find(
    ({ category }) => category === AFFECTED_OWNERSHIP_CATEGORIES.PACKAGE_OR_APPLICATION,
  );
  packageEntry.category = AFFECTED_OWNERSHIP_CATEGORIES.PROJECT_DOCUMENTATION;
  assert.throws(
    () => validateAffectedWorkloadOwnership(categoryCandidate),
    expectCode("AFFECTED_OWNERSHIP_RULE_SUBSTITUTED"),
  );

  const dispositionCandidate = structuredClone(authority);
  const policyEntry = dispositionCandidate.entries.find(
    ({ category }) => category === AFFECTED_OWNERSHIP_CATEGORIES.CI_POLICY,
  );
  policyEntry.disposition = AFFECTED_OWNERSHIP_DISPOSITIONS.SELECT_PROOF_UNIT;
  assert.throws(
    () => validateAffectedWorkloadOwnership(dispositionCandidate),
    expectCode("AFFECTED_OWNERSHIP_RULE_SUBSTITUTED"),
  );
});

test("rejects tracked-path, category-count, and ownership digest drift", async () => {
  const authority = await currentAuthority();

  const pathDigestCandidate = structuredClone(authority);
  pathDigestCandidate.trackedPathSetSha256 = "0".repeat(64);
  assert.throws(
    () => validateAffectedWorkloadOwnership(pathDigestCandidate),
    expectCode("AFFECTED_OWNERSHIP_TRACKED_PATH_SET_DRIFT"),
  );

  const categoryCountCandidate = structuredClone(authority);
  categoryCountCandidate.categoryCounts.REPOSITORY_POLICY += 1;
  assert.throws(
    () => validateAffectedWorkloadOwnership(categoryCountCandidate),
    expectCode("AFFECTED_OWNERSHIP_CATEGORY_COUNT_DRIFT"),
  );

  const ownershipDigestCandidate = structuredClone(authority);
  ownershipDigestCandidate.ownershipSha256 = "f".repeat(64);
  assert.throws(
    () => validateAffectedWorkloadOwnership(ownershipDigestCandidate),
    expectCode("AFFECTED_OWNERSHIP_DIGEST_DRIFT"),
  );
});

test("rejects added, reordered, traversal, and non-normalized paths", async () => {
  const paths = await currentTrackedPaths();
  assert.throws(
    () => createAffectedWorkloadOwnership([...paths, "new/unreviewed-path.ts"]),
    AffectedWorkloadOwnershipError,
  );
  assert.throws(
    () => createAffectedWorkloadOwnership([...paths].reverse()),
    expectCode("AFFECTED_OWNERSHIP_PATH_ORDER_INVALID"),
  );
  for (const unsafePath of ["../escape", "nested/../escape", "/absolute", "a//b", "a\\b"]) {
    assert.throws(
      () => calculateAffectedTrackedPathSetSha256([unsafePath]),
      expectCode("AFFECTED_OWNERSHIP_PATH_INVALID"),
    );
  }
  assert.throws(
    () => calculateAffectedTrackedPathSetSha256(["docs/e\u0301vidence.md"]),
    expectCode("AFFECTED_OWNERSHIP_PATH_INVALID"),
  );
});

test("rejects oversized and sparse tracked-path containers", () => {
  assert.throws(
    () => createAffectedWorkloadOwnership(Array(16_385).fill("same")),
    expectCode("AFFECTED_OWNERSHIP_INPUT_OVER_BUDGET"),
  );
  const sparse = [];
  sparse.length = 2;
  sparse[1] = "README.md";
  assert.throws(
    () => createAffectedWorkloadOwnership(sparse),
    expectCode("AFFECTED_OWNERSHIP_INPUT_OVER_BUDGET"),
  );
});

test("does not invoke accessor-backed ownership data", async () => {
  const candidate = structuredClone(await currentAuthority());
  let getterCalls = 0;
  Object.defineProperty(candidate.entries[0], "path", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "README.md";
    },
  });
  assert.throws(
    () => validateAffectedWorkloadOwnership(candidate),
    expectCode("AFFECTED_OWNERSHIP_INPUT_INVALID"),
  );
  assert.equal(getterCalls, 0);
});

test("does not read hostile proxy-backed authorities or arrays", async () => {
  const authority = await currentAuthority();
  let authorityReads = 0;
  const proxiedAuthority = new Proxy(structuredClone(authority), {
    get(target, property, receiver) {
      authorityReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  assert.throws(
    () => validateAffectedWorkloadOwnership(proxiedAuthority),
    expectCode("AFFECTED_OWNERSHIP_INPUT_INVALID"),
  );
  assert.equal(authorityReads, 0);

  let arrayReads = 0;
  const proxiedPaths = new Proxy(await currentTrackedPaths(), {
    get(target, property, receiver) {
      arrayReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  assert.throws(
    () => createAffectedWorkloadOwnership(proxiedPaths),
    expectCode("AFFECTED_OWNERSHIP_INPUT_OVER_BUDGET"),
  );
  assert.equal(arrayReads, 0);
});

test("rejects extra fields and unknown authority profiles", async () => {
  const authority = await currentAuthority();
  const extraField = structuredClone(authority);
  extraField.unreviewed = true;
  assert.throws(
    () => validateAffectedWorkloadOwnership(extraField),
    expectCode("AFFECTED_OWNERSHIP_INPUT_INVALID"),
  );

  const unknownProfile = structuredClone(authority);
  unknownProfile.profile = "desen.ci.affected-workload-ownership.v2";
  assert.throws(
    () => validateAffectedWorkloadOwnership(unknownProfile),
    expectCode("AFFECTED_OWNERSHIP_PROFILE_UNKNOWN"),
  );
});
