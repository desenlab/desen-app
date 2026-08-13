import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
const WORKSPACE_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const REQUIRED_QUALITY_COMMAND =
  "timeout --signal=TERM --kill-after=30s 18m node scripts/ci/run-required-affected-quality-gate.mjs";
const RETAINED_LEGACY_COMMAND = "node scripts/run-ci-quality-gate.mjs";
const REQUIRED_EXHAUSTIVE_ENTRYPOINT = "scripts/ci/run-required-exhaustive-quality-gate.mjs";
const REQUIRED_QUALITY_ENTRYPOINT = "scripts/ci/run-required-affected-quality-gate.mjs";
const RETIRED_SHADOW_ENTRYPOINT = "scripts/ci/run-shadow-affected-quality-gate.mjs";
const RETAINED_LEGACY_ENTRYPOINT = "scripts/run-ci-quality-gate.mjs";

const RETIRED_CUTOVER_PATHS = Object.freeze([
  ".github/workflows/ci-v2-shadow.yml",
  "scripts/ci/run-modular-quality-gate.mjs",
  "scripts/ci/test/modular-quality-gate.test.mjs",
]);

function extractMappingBlock(document, key, indentation) {
  const lines = document.split(/\r?\n/u);
  const prefix = " ".repeat(indentation);
  const start = lines.findIndex((line) => line === `${prefix}${key}:`);
  assert.notEqual(start, -1, `Expected ${key} at indentation ${indentation}`);

  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      end += 1;
      continue;
    }

    const currentIndentation = line.length - line.trimStart().length;
    if (currentIndentation <= indentation) {
      break;
    }
    end += 1;
  }

  return lines.slice(start, end).join("\n");
}

function directMappingKeys(block, indentation) {
  const matcher = new RegExp(`^ {${indentation}}([A-Za-z0-9_-]+):(?:\\s.*)?$`, "u");
  return block
    .split(/\r?\n/u)
    .map((line) => matcher.exec(line)?.[1] ?? null)
    .filter((key) => key !== null);
}

function scalarValue(block, key, indentation) {
  const prefix = " ".repeat(indentation);
  const line = block.split(/\r?\n/u).find((candidate) => candidate.startsWith(`${prefix}${key}:`));
  assert.ok(line, `Expected scalar ${key} at indentation ${indentation}`);
  const value = line.slice(`${prefix}${key}:`.length).trim();
  assert.notEqual(value, "", `Expected a value for ${key}`);
  return value;
}

function sequenceValues(block, indentation) {
  const matcher = new RegExp(`^ {${indentation}}- (.+)$`, "u");
  return block
    .split(/\r?\n/u)
    .map((line) => matcher.exec(line)?.[1] ?? null)
    .filter((value) => value !== null);
}

function exactRunCount(workflow, command) {
  return workflow.split(/\r?\n/u).filter((line) => line.trim() === `run: ${command}`).length;
}

function exactTextCount(document, value) {
  return document.split(value).length - 1;
}

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

test("proves all 150 exact ordered commands and both reviewed digests", () => {
  const result = verifyRequiredExhaustiveInventoryEquivalence();

  assert.deepEqual(result, {
    status: "PASS",
    workloadCount: 150,
    exactlyOnce: true,
    retainedPlanSha256: EXPECTED_RETAINED_PLAN_SHA256,
    neutralInventorySha256: EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
    orderedProjectionSha256: "c4717c9db7a184595be7b6c2b30f0536c965837fcfa6fdd909cb0ec3bc3844a1",
    workloadSetSha256: EXPECTED_REQUIRED_WORKLOAD_SET_SHA256,
  });
  assert.equal(
    EXPECTED_RETAINED_PLAN_SHA256,
    "8a08431ea00f10137c5d5e9cc69484d1aed5f7f9ba7370cd74af0e447e0e8e75",
  );
  assert.equal(
    EXPECTED_REQUIRED_WORKLOAD_SET_SHA256,
    "c02f945ad3d655226ebf1d4547e91f156b5877ae26c32d1a1f78b10bf3f36165",
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
  assert.equal(normalized.workloads.length, 150);
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

test("official CI admits only required exhaustive authority and a manual legacy rollback", async () => {
  const workflow = await readFile(resolve(WORKSPACE_ROOT, ".github/workflows/ci.yml"), "utf8");

  const triggers = extractMappingBlock(workflow, "on", 0);
  assert.deepEqual(directMappingKeys(triggers, 2), ["pull_request", "push", "workflow_dispatch"]);

  const pullRequest = extractMappingBlock(triggers, "pull_request", 2);
  assert.deepEqual(directMappingKeys(pullRequest, 4), ["branches"]);
  assert.deepEqual(sequenceValues(pullRequest, 6), ["main"]);

  const push = extractMappingBlock(triggers, "push", 2);
  assert.deepEqual(directMappingKeys(push, 4), ["branches"]);
  assert.deepEqual(sequenceValues(push, 6), ["main"]);

  const workflowDispatch = extractMappingBlock(triggers, "workflow_dispatch", 2);
  assert.deepEqual(directMappingKeys(workflowDispatch, 4), ["inputs"]);
  const inputs = extractMappingBlock(workflowDispatch, "inputs", 4);
  assert.deepEqual(directMappingKeys(inputs, 6), ["mode"]);
  const mode = extractMappingBlock(inputs, "mode", 6);
  assert.deepEqual(directMappingKeys(mode, 8), [
    "description",
    "required",
    "default",
    "type",
    "options",
  ]);
  assert.equal(scalarValue(mode, "required", 8), "true");
  assert.equal(scalarValue(mode, "default", 8), "required");
  assert.equal(scalarValue(mode, "type", 8), "choice");
  assert.deepEqual(sequenceValues(extractMappingBlock(mode, "options", 8), 10), [
    "required",
    "legacy-rollback",
  ]);

  const concurrency = extractMappingBlock(workflow, "concurrency", 0);
  assert.deepEqual(directMappingKeys(concurrency, 2), ["group", "cancel-in-progress"]);
  assert.equal(
    scalarValue(concurrency, "group", 2),
    "${{ github.workflow }}-${{ github.event_name }}-${{ inputs.mode || 'required' }}-${{ github.event.pull_request.number || github.ref }}",
  );
  assert.equal(scalarValue(concurrency, "cancel-in-progress", 2), "true");

  const jobs = extractMappingBlock(workflow, "jobs", 0);
  assert.deepEqual(directMappingKeys(jobs, 2), ["quality", "legacy-rollback"]);

  const requiredJob = extractMappingBlock(jobs, "quality", 2);
  assert.equal(
    scalarValue(requiredJob, "if", 4),
    "${{ github.event_name != 'workflow_dispatch' || inputs.mode == 'required' }}",
  );
  assert.equal(exactRunCount(requiredJob, REQUIRED_QUALITY_COMMAND), 1);
  assert.equal(exactRunCount(requiredJob, RETAINED_LEGACY_COMMAND), 0);
  assert.equal(scalarValue(requiredJob, "timeout-minutes", 4), "25");
  assert.match(requiredJob, /fetch-depth: 0/u);
  assert.match(requiredJob, /DESEN_REQUIRED_BASE_REVISION/u);
  assert.match(requiredJob, /DESEN_REQUIRED_HEAD_REVISION/u);
  assert.match(requiredJob, /DESEN_REQUIRED_SAME_REPOSITORY/u);
  assert.doesNotMatch(requiredJob, /DESEN_CI_(?:BASE_SHA|HEAD_SHA|SAME_REPOSITORY)/u);
  assert.match(requiredJob, /actions\/cache\/save/u);

  const legacyJob = extractMappingBlock(jobs, "legacy-rollback", 2);
  assert.equal(
    scalarValue(legacyJob, "if", 4),
    "${{ github.event_name == 'workflow_dispatch' && inputs.mode == 'legacy-rollback' }}",
  );
  assert.equal(exactRunCount(legacyJob, RETAINED_LEGACY_COMMAND), 1);
  assert.equal(exactRunCount(legacyJob, REQUIRED_QUALITY_COMMAND), 0);

  assert.equal(exactRunCount(workflow, REQUIRED_QUALITY_COMMAND), 1);
  assert.equal(exactRunCount(workflow, RETAINED_LEGACY_COMMAND), 1);
  assert.equal(exactTextCount(workflow, REQUIRED_QUALITY_ENTRYPOINT), 1);
  assert.equal(exactTextCount(workflow, REQUIRED_EXHAUSTIVE_ENTRYPOINT), 0);
  assert.equal(exactTextCount(workflow, RETIRED_SHADOW_ENTRYPOINT), 0);
  assert.equal(exactTextCount(workflow, RETAINED_LEGACY_ENTRYPOINT), 1);
  assert.equal(workflow.includes("DESEN_CI_AUTHORITY"), false);

  for (const retiredPath of RETIRED_CUTOVER_PATHS) {
    await assert.rejects(access(resolve(WORKSPACE_ROOT, retiredPath)), { code: "ENOENT" });
  }
});
