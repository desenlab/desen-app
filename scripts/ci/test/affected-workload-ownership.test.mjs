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
  PROOF_UNIT: 164,
  CI_POLICY: 45,
  DEPENDENCY_POLICY: 31,
  FROZEN_INPUT: 126,
  PACKAGE_OR_APPLICATION: 444,
  SHARED_PROOF_INFRASTRUCTURE: 201,
  PROJECT_DOCUMENTATION: 118,
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

test("freezes exact-one ownership for all 1140 reviewed tracked paths", async () => {
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
  assert.equal(new Set(authority.entries.map(({ path: trackedPath }) => trackedPath)).size, 1140);
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

  assert.equal(proofEntries.length, 164);
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "reference-host-web-channel-consumption")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-reference-host-web-channel-consumption.mjs",
      "tests/reference-host-web-channel-consumption.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "editor-core-source-document")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-editor-core-source-document.mjs",
      "tests/editor-core-source-document.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "editor-core-event-action-edits")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-editor-core-event-action-edits.mjs",
      "tests/editor-core-event-action-edits.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "editor-core-authoring-round-trip")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-editor-core-authoring-round-trip.mjs",
      "tests/editor-core-authoring-round-trip.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "editor-core-persistence")
      .map(({ path: trackedPath }) => trackedPath),
    ["scripts/verify-editor-core-persistence.mjs", "tests/editor-core-persistence.test.mjs"],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "editor-core-continuous-validation")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-editor-core-continuous-validation.mjs",
      "tests/editor-core-continuous-validation.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "editor-core-terminal-integration")
      .map(({ path: trackedPath }) => trackedPath),
    [
      "scripts/verify-editor-core-terminal-integration.mjs",
      "tests/editor-core-terminal-integration.test.mjs",
    ],
  );
  assert.deepEqual(
    proofEntries
      .filter(({ proofUnitId }) => proofUnitId === "desen-app-shell-navigation")
      .map(({ path: trackedPath }) => trackedPath),
    ["scripts/verify-desen-app-shell-navigation.mjs", "tests/desen-app-shell-navigation.test.mjs"],
  );
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

test("the reviewed M09 successor preserves the historical I07-04 ownership projection", async () => {
  const currentPaths = await currentTrackedPaths();
  const current = createAffectedWorkloadOwnership(currentPaths);
  const promotedPaths = [
    "docs/proof/baselines/i07-04-affected-selector-promotion.json",
    "scripts/ci/affected-selector-promotion-evidence.mjs",
    "scripts/ci/run-required-affected-quality-gate.mjs",
    "scripts/ci/test/affected-selector-promotion-evidence.test.mjs",
    "scripts/ci/test/required-affected-quality-gate.test.mjs",
    "scripts/ci/verify-affected-selector-promotion-evidence.mjs",
  ];
  const successorPaths = [
    "docs/proof/EDITOR-CORE-SOURCE-DOCUMENT.md",
    "docs/proof/artifacts/editor-core-0.1.0-source-document.json",
    "packages/editor-core/src/source-document.ts",
    "packages/editor-core/test/public-package.mjs",
    "packages/editor-core/test/public-package.types.mts",
    "packages/editor-core/test/source-document.test.ts",
    "packages/editor-core/test/source-document.types.ts",
    "packages/editor-core/tsconfig.public-package.json",
    "scripts/generate-editor-core-source-document-proof.mjs",
    "scripts/lib/editor-core-source-document-proof.mjs",
    "scripts/verify-editor-core-source-document.mjs",
    "tests/editor-core-source-document.test.mjs",
    "docs/proof/EDITOR-CORE-STABLE-ID-INSERT.md",
    "docs/proof/artifacts/editor-core-0.1.0-stable-id-insert.json",
    "packages/editor-core/src/stable-id-insert.ts",
    "packages/editor-core/test/stable-id-insert.test.ts",
    "packages/editor-core/test/stable-id-insert.types.ts",
    "scripts/generate-editor-core-stable-id-insert-proof.mjs",
    "scripts/lib/editor-core-stable-id-insert-proof.mjs",
    "scripts/verify-editor-core-stable-id-insert.mjs",
    "tests/editor-core-stable-id-insert.test.mjs",
    "docs/proof/EDITOR-CORE-STRUCTURAL-EDITS.md",
    "docs/proof/artifacts/editor-core-0.1.0-structural-edits.json",
    "packages/editor-core/src/structural-edits.ts",
    "packages/editor-core/test/structural-edits.test.ts",
    "packages/editor-core/test/structural-edits.types.ts",
    "scripts/generate-editor-core-structural-edits-proof.mjs",
    "scripts/lib/editor-core-structural-edits-proof.mjs",
    "scripts/verify-editor-core-structural-edits.mjs",
    "tests/editor-core-structural-edits.test.mjs",
    "docs/proof/EDITOR-CORE-CONTENT-EDITS.md",
    "docs/proof/artifacts/editor-core-0.1.0-content-edits.json",
    "packages/editor-core/src/content-edits.ts",
    "packages/editor-core/test/content-edits.test.ts",
    "packages/editor-core/test/content-edits.types.ts",
    "scripts/generate-editor-core-content-edits-proof.mjs",
    "scripts/lib/editor-core-content-edits-proof.mjs",
    "scripts/verify-editor-core-content-edits.mjs",
    "tests/editor-core-content-edits.test.mjs",
    "docs/proof/EDITOR-CORE-STATE-BINDING-EDITS.md",
    "docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json",
    "packages/editor-core/src/state-binding-edits.ts",
    "packages/editor-core/test/state-binding-edits.test.ts",
    "packages/editor-core/test/state-binding-edits.types.ts",
    "scripts/generate-editor-core-state-binding-edits-proof.mjs",
    "scripts/lib/editor-core-state-binding-edits-proof.mjs",
    "scripts/verify-editor-core-state-binding-edits.mjs",
    "tests/editor-core-state-binding-edits.test.mjs",
    "docs/proof/EDITOR-CORE-EVENT-ACTION-EDITS.md",
    "docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json",
    "packages/editor-core/src/event-action-edits.ts",
    "packages/editor-core/test/event-action-edits.test.ts",
    "packages/editor-core/test/event-action-edits.types.ts",
    "scripts/generate-editor-core-event-action-edits-proof.mjs",
    "scripts/lib/editor-core-event-action-edits-proof.mjs",
    "scripts/verify-editor-core-event-action-edits.mjs",
    "tests/editor-core-event-action-edits.test.mjs",
    "docs/proof/EDITOR-CORE-AUTHORING-ROUND-TRIP.md",
    "docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json",
    "packages/editor-core/test/authoring-round-trip.test.ts",
    "packages/editor-core/test/authoring-round-trip.types.ts",
    "scripts/generate-editor-core-authoring-round-trip-proof.mjs",
    "scripts/lib/editor-core-authoring-round-trip-proof.mjs",
    "scripts/verify-editor-core-authoring-round-trip.mjs",
    "tests/editor-core-authoring-round-trip.test.mjs",
    "docs/proof/EDITOR-CORE-PERSISTENCE.md",
    "docs/proof/artifacts/editor-core-0.1.0-persistence.json",
    "packages/editor-core/src/persistence.ts",
    "packages/editor-core/test/persistence.test.ts",
    "packages/editor-core/test/persistence.types.ts",
    "packages/editor-web/src/local-source-json.ts",
    "packages/editor-web/src/local-source-persistence.ts",
    "packages/editor-web/test/local-source-persistence.test.ts",
    "packages/editor-web/test/public-package.mjs",
    "packages/editor-web/test/public-package.types.mts",
    "packages/editor-web/tsconfig.public-package.json",
    "scripts/generate-editor-core-persistence-proof.mjs",
    "scripts/lib/editor-core-persistence-proof.mjs",
    "scripts/verify-editor-core-persistence.mjs",
    "tests/editor-core-persistence.test.mjs",
    "docs/proof/EDITOR-CORE-CONTINUOUS-VALIDATION.md",
    "docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json",
    "packages/editor-core/src/continuous-validation.ts",
    "packages/editor-core/test/continuous-validation.test.ts",
    "packages/editor-core/test/continuous-validation.types.ts",
    "scripts/generate-editor-core-continuous-validation-proof.mjs",
    "scripts/lib/editor-core-continuous-validation-proof.mjs",
    "scripts/verify-editor-core-continuous-validation.mjs",
    "tests/editor-core-continuous-validation.test.mjs",
    "docs/proof/EDITOR-CORE-TERMINAL-INTEGRATION.md",
    "docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json",
    "packages/editor-core/test/terminal-integration.test.ts",
    "scripts/generate-editor-core-terminal-integration-proof.mjs",
    "scripts/lib/editor-core-terminal-integration-proof.mjs",
    "scripts/verify-editor-core-terminal-integration.mjs",
    "tests/editor-core-terminal-integration.test.mjs",
    "apps/desen-app/index.html",
    "apps/desen-app/src/assets/breadcrumb-separator.svg",
    "apps/desen-app/src/assets/desen-logo.svg",
    "apps/desen-app/src/assets/plus.svg",
    "apps/desen-app/src/assets/settings.svg",
    "apps/desen-app/src/assets/theme.svg",
    "apps/desen-app/src/application.module.css",
    "apps/desen-app/src/application.tsx",
    "apps/desen-app/src/main.tsx",
    "apps/desen-app/src/project-data.ts",
    "apps/desen-app/src/project-navigation.ts",
    "apps/desen-app/src/styles.css",
    "apps/desen-app/test/application.test.tsx",
    "apps/desen-app/test/main-lifecycle.test.tsx",
    "apps/desen-app/test/project-navigation.test.ts",
    "docs/proof/DESEN-APP-SHELL-NAVIGATION.md",
    "docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json",
    "scripts/generate-desen-app-shell-navigation-proof.mjs",
    "scripts/lib/desen-app-shell-navigation-proof.mjs",
    "scripts/verify-desen-app-shell-navigation.mjs",
    "tests/desen-app-shell-navigation.test.mjs",
  ];
  for (const promotedPath of promotedPaths) {
    const entry = current.entries.find(({ path: candidate }) => candidate === promotedPath);
    assert.ok(entry, `${promotedPath} must be tracked by the promoted authority`);
    assert.equal(entry.disposition, AFFECTED_OWNERSHIP_DISPOSITIONS.FORCE_EXHAUSTIVE);
    assert.equal(entry.proofUnitId, null);
  }

  for (const successorPath of successorPaths) {
    assert.ok(
      current.entries.some(({ path: candidate }) => candidate === successorPath),
      `${successorPath} must be tracked by the reviewed M09 successor`,
    );
  }

  const historicalPaths = currentPaths.filter(
    (candidate) => !promotedPaths.includes(candidate) && !successorPaths.includes(candidate),
  );
  historicalPaths.push(
    "scripts/ci/run-shadow-affected-quality-gate.mjs",
    "scripts/ci/test/shadow-affected-quality-gate.test.mjs",
  );
  historicalPaths.sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  assert.deepEqual(calculateAffectedWorkloadOwnershipReview(historicalPaths), {
    trackedPathCount: 1019,
    trackedPathSetSha256: "d752922fa22db81f3f76fc93d4562a17b65589e614f3281844287aa8d6656679",
    proofOwnedPathCount: 142,
    categoryCounts: {
      PROOF_UNIT: 142,
      CI_POLICY: 42,
      DEPENDENCY_POLICY: 31,
      FROZEN_INPUT: 114,
      PACKAGE_OR_APPLICATION: 393,
      SHARED_PROOF_INFRASTRUCTURE: 179,
      PROJECT_DOCUMENTATION: 107,
      REPOSITORY_POLICY: 11,
    },
    ownershipSha256: "729b84436be134709db7bf8793e232bee4dab4a27efcb61e61cd0afeaed83ee8",
  });
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
