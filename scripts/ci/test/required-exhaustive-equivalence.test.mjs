import assert from "node:assert/strict";
import test from "node:test";

import { createQualityGateSteps as createRetainedSequentialSteps } from "../../run-ci-quality-gate.mjs";
import {
  EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
  createExhaustiveWorkloadInventory,
} from "../exhaustive-workload-inventory.mjs";
import {
  EXPECTED_REQUIRED_WORKLOAD_SET_SHA256,
  EXPECTED_RETAINED_PLAN_SHA256,
  RequiredExhaustiveEquivalenceError,
  assertRequiredTerminalAuthorityEquivalent,
  normalizeRequiredExecutionReceipt,
  normalizeRequiredTerminalAuthority,
  verifyRequiredExhaustiveInventoryEquivalence,
} from "../required-exhaustive-equivalence.mjs";

const UNCHANGED_DIGEST = "a".repeat(64);
const CHANGED_DIGEST = "b".repeat(64);

function canonicalIds() {
  return createExhaustiveWorkloadInventory().nodes.map(({ id }) => id);
}

function workloadReceipt(id, status = "PASS") {
  return {
    id,
    status,
    observedClose: ["PASS", "FAIL", "CANCELLED", "TIMED_OUT"].includes(status),
  };
}

function receipt({
  status = "PASS",
  statuses = new Map(),
  order = canonicalIds(),
  beforeDigest = UNCHANGED_DIGEST,
  afterDigest = UNCHANGED_DIGEST,
  failure = null,
} = {}) {
  return {
    status,
    inventorySha256: EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
    workspace: {
      beforeDigest,
      afterDigest,
      trackedFileCount: 900,
    },
    workloads: order.map((id) => workloadReceipt(id, statuses.get(id) ?? "PASS")),
    failure,
  };
}

function expectEquivalenceError(code) {
  return (error) => {
    assert.ok(error instanceof RequiredExhaustiveEquivalenceError);
    assert.equal(error.code, code);
    return true;
  };
}

test("proves all 130 exact ordered commands and both reviewed digests", () => {
  const result = verifyRequiredExhaustiveInventoryEquivalence();

  assert.deepEqual(result, {
    status: "PASS",
    workloadCount: 130,
    exactlyOnce: true,
    retainedPlanSha256: EXPECTED_RETAINED_PLAN_SHA256,
    neutralInventorySha256: EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
    orderedProjectionSha256: "ce784ee7dfecc97777f04b7a571ab413ff151d98bf94311ca8c4b1e575e77bab",
    workloadSetSha256: EXPECTED_REQUIRED_WORKLOAD_SET_SHA256,
  });
  assert.equal(
    EXPECTED_RETAINED_PLAN_SHA256,
    "448102bdfc5e0ed331f09038a2c554dcb930300ec560d35ac94469fc89d5897f",
  );
  assert.equal(
    EXPECTED_REQUIRED_WORKLOAD_SET_SHA256,
    "4fc8b2cdf84742022b973ff705fdcb587590f64188828f71bd460d9cce3699db",
  );
  assert.equal(Object.isFrozen(result), true);
});

test("retained-plan omission, reorder, argv substitution, and duplicate fail closed", () => {
  const omitted = structuredClone(createRetainedSequentialSteps());
  omitted.pop();
  assert.throws(() => verifyRequiredExhaustiveInventoryEquivalence({ retainedSteps: omitted }));

  const reordered = structuredClone(createRetainedSequentialSteps());
  [reordered[6], reordered[7]] = [reordered[7], reordered[6]];
  assert.throws(() => verifyRequiredExhaustiveInventoryEquivalence({ retainedSteps: reordered }));

  const changedArgv = structuredClone(createRetainedSequentialSteps());
  changedArgv[0].args.push("unreviewed");
  assert.throws(() => verifyRequiredExhaustiveInventoryEquivalence({ retainedSteps: changedArgv }));

  const duplicated = structuredClone(createRetainedSequentialSteps());
  duplicated[1] = structuredClone(duplicated[0]);
  assert.throws(() => verifyRequiredExhaustiveInventoryEquivalence({ retainedSteps: duplicated }));
});

test("PASS requires every exact workload closed successfully and ignores arrival order", () => {
  const canonical = receipt();
  const reversed = receipt({ order: [...canonicalIds()].reverse() });
  const normalized = normalizeRequiredExecutionReceipt(reversed);

  assert.equal(normalized.status, "PASS");
  assert.equal(normalized.workloads.length, 130);
  assert.deepEqual(
    normalized.workloads.map(({ id }) => id),
    canonicalIds(),
  );
  assert.equal(
    normalized.workloads.every(({ status, observedClose }) => status === "PASS" && observedClose),
    true,
  );
  assert.deepEqual(assertRequiredTerminalAuthorityEquivalent(canonical, reversed), {
    status: "EQUIVALENT",
    authority: normalizeRequiredTerminalAuthority(canonical),
  });
});

test("missing and duplicate workload receipts cannot produce terminal authority", () => {
  const missing = receipt();
  missing.workloads.pop();
  assert.throws(
    () => normalizeRequiredExecutionReceipt(missing),
    expectEquivalenceError("REQUIRED_EQUIVALENCE_WORKLOAD_SET_DRIFT"),
  );

  const duplicated = receipt();
  duplicated.workloads[1] = structuredClone(duplicated.workloads[0]);
  assert.throws(
    () => normalizeRequiredExecutionReceipt(duplicated),
    expectEquivalenceError("REQUIRED_EQUIVALENCE_DUPLICATE"),
  );
});

test("non-pass, not-run, cancelled, timed-out, and unclosed statuses cannot claim PASS", () => {
  const targetId = canonicalIds()[10];
  for (const status of ["FAIL", "SKIPPED", "NOT_RUN", "CANCELLED", "TIMED_OUT"]) {
    const candidate = receipt({ statuses: new Map([[targetId, status]]) });
    assert.throws(
      () => normalizeRequiredExecutionReceipt(candidate),
      expectEquivalenceError("REQUIRED_EQUIVALENCE_FALSE_PASS"),
    );
  }

  const unclosed = receipt();
  unclosed.workloads[0].observedClose = false;
  assert.throws(
    () => normalizeRequiredExecutionReceipt(unclosed),
    expectEquivalenceError("REQUIRED_EQUIVALENCE_WORKLOAD_UNCLOSED"),
  );
});

test("terminal normalization retains each injected failure authority without timing or order", () => {
  const [firstId, secondId, thirdId] = canonicalIds().slice(10, 13);
  const cases = [
    receipt({
      status: "FAIL",
      statuses: new Map(canonicalIds().map((id) => [id, "NOT_RUN"])),
      failure: { kind: "INVENTORY", workloadId: null, signal: null },
    }),
    receipt({
      status: "FAIL",
      statuses: new Map([[firstId, "FAIL"]]),
      failure: { kind: "WORKLOAD", workloadId: firstId, signal: null },
    }),
    receipt({
      status: "FAIL",
      afterDigest: CHANGED_DIGEST,
      failure: { kind: "WORKSPACE", workloadId: null, signal: null },
    }),
    receipt({
      status: "FAIL",
      statuses: new Map([[secondId, "CANCELLED"]]),
      failure: { kind: "CANCELLATION", workloadId: secondId, signal: "SIGTERM" },
    }),
    receipt({
      status: "FAIL",
      statuses: new Map([[thirdId, "TIMED_OUT"]]),
      failure: { kind: "TIMEOUT", workloadId: thirdId, signal: null },
    }),
  ];

  assert.deepEqual(
    cases.map((candidate) => normalizeRequiredTerminalAuthority(candidate).failure.kind),
    ["INVENTORY", "WORKLOAD", "WORKSPACE", "CANCELLATION", "TIMEOUT"],
  );
  for (const candidate of cases) {
    const reordered = structuredClone(candidate);
    reordered.workloads.reverse();
    assert.equal(
      assertRequiredTerminalAuthorityEquivalent(candidate, reordered).status,
      "EQUIVALENT",
    );
  }
});

test("terminal authority comparison detects a different failing workload", () => {
  const [firstId, secondId] = canonicalIds().slice(20, 22);
  const first = receipt({
    status: "FAIL",
    statuses: new Map([[firstId, "FAIL"]]),
    failure: { kind: "WORKLOAD", workloadId: firstId, signal: null },
  });
  const second = receipt({
    status: "FAIL",
    statuses: new Map([[secondId, "FAIL"]]),
    failure: { kind: "WORKLOAD", workloadId: secondId, signal: null },
  });

  assert.throws(
    () => assertRequiredTerminalAuthorityEquivalent(first, second),
    expectEquivalenceError("REQUIRED_EQUIVALENCE_TERMINAL_DRIFT"),
  );
});
