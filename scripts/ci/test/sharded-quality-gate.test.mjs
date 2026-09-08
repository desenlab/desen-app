import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";

import { createExhaustiveWorkloadInventory } from "../exhaustive-workload-inventory.mjs";
import { resolveRequiredQualityGateRoute } from "../run-required-affected-quality-gate.mjs";
import {
  OPTIONAL_AUTHORITY,
  RequiredExhaustiveCancellationError,
  RequiredExhaustiveQualityGateError,
  createRequiredExhaustivePlan,
  createRequiredExhaustiveProcessRegistry,
  createRequiredExhaustiveProcessRunner,
  createRequiredExhaustiveJoinPlan,
  createRequiredExhaustiveProofShardPlan,
  createRequiredExhaustiveTerminalState,
  createSuccessfulExhaustiveStepObservation,
  executeRequiredExhaustiveJoin,
  executeRequiredExhaustiveProofShard,
  runRequiredExhaustivePlan,
  runRequiredExhaustiveJoinPlan,
  runRequiredExhaustiveProofShardPlan,
} from "../run-required-exhaustive-quality-gate.mjs";
import { classifyProofPairState } from "../shared-state-authority.mjs";
import {
  ShardedQualityGateAuthorityError,
  captureHostedRequiredShardJoinAuthority,
  createRequiredProofShardSummary,
  createShardedQualityGatePlan,
  getRequiredProofShard,
  validateRequiredShardJoinNeeds,
  validateHostedRequiredShardJoinAuthority,
} from "../sharded-quality-gate-authority.mjs";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../..");
const SHARD_IDS = Object.freeze(["proof-a", "proof-b", "proof-c"]);
const SAME_BUILD = Object.freeze({ profile: "test.build", digest: "same" });
const SAME_UNTRACKED = Object.freeze({ profile: "test.untracked", digest: "same" });
const HOSTED_CONTEXT = Object.freeze({
  executionRevision: "a".repeat(40),
  headRevision: "b".repeat(40),
  workflowRunId: "34060300431",
  workflowRunAttempt: "2",
});

function successfulNeeds(context = HOSTED_CONTEXT) {
  return {
    "quality-route": { result: "success", outputs: { mode: "EXHAUSTIVE" } },
    ...Object.fromEntries(
      SHARD_IDS.map((id) => [
        id,
        {
          result: "success",
          outputs: { receipt: JSON.stringify(createRequiredProofShardSummary(id, context)) },
        },
      ]),
    ),
  };
}

function changeSummary(needs, shardId, mutate) {
  const summary = JSON.parse(needs[shardId].outputs.receipt);
  mutate(summary);
  needs[shardId].outputs.receipt = JSON.stringify(summary);
  return needs;
}

function guards(overrides = {}) {
  return {
    workspaceRoot: WORKSPACE_ROOT,
    snapshotBuildOutputsFunction: async () => SAME_BUILD,
    assertBuildOutputsUnchangedFunction: (before, after) => assert.equal(before, after),
    snapshotUntrackedStateFunction: async () => SAME_UNTRACKED,
    assertUntrackedStateUnchangedFunction: (before, after) => assert.equal(before, after),
    ...overrides,
  };
}

function shadowPlan(shardId = SHARD_IDS[0]) {
  return createRequiredExhaustiveProofShardPlan(shardId, { authority: OPTIONAL_AUTHORITY });
}

function runShadow(plan, options = {}) {
  return runRequiredExhaustiveProofShardPlan(plan, {
    authority: OPTIONAL_AUTHORITY,
    ...guards(),
    ...options,
  });
}

test("CI-04 three fixed shards preserve all 224 workloads and 107 complete proof pairs", () => {
  const inventory = createExhaustiveWorkloadInventory();
  const full = createRequiredExhaustivePlan();
  const shards = SHARD_IDS.map((id) => createRequiredExhaustiveProofShardPlan(id));
  assert.equal(inventory.workloadCount, 224);
  assert.equal(inventory.proofUnitCount, 107);
  assert.deepEqual(
    shards.map(({ proofPairCount }) => proofPairCount),
    [53, 24, 30],
  );
  const pairIds = shards.flatMap(({ proofPairs }) => proofPairs.map(({ id }) => id));
  assert.equal(pairIds.length, 107);
  assert.equal(new Set(pairIds).size, 107);
  assert.deepEqual(
    pairIds,
    full.proofPairs.map(({ id }) => id),
  );
  const coveredIds = new Set(full.suffix.map(({ id }) => id));
  for (const shard of shards) {
    assert.equal(shard.scope, "EXHAUSTIVE_SHARD");
    assert.equal(shard.authority, "REQUIRED");
    assert.equal(shard.concurrency, 2);
    assert.equal(shard.prefix.length, 8);
    assert.deepEqual(shard.prefix, full.prefix);
    assert.deepEqual(shard.suffix, []);
    assert.equal(shard.stepCount, 8 + shard.proofPairCount * 2);
    assert.equal(shard.nodes.length, shard.stepCount);
    assert.equal(new Set(shard.nodes.map(({ id }) => id)).size, shard.stepCount);
    for (const pair of shard.proofPairs) {
      assert.deepEqual(pair.rootTest.dependencies, [pair.verifier.id]);
    }
    for (const node of shard.nodes) coveredIds.add(node.id);
  }
  assert.deepEqual([...coveredIds].sort(), inventory.nodes.map(({ id }) => id).sort());
  assert.deepEqual(
    shards.map(
      ({ proofPairs }) => proofPairs.filter(({ id }) => classifyProofPairState(id).barrier).length,
    ),
    [11, 0, 0],
  );
});

test("CI-04 static shard membership agrees with executable membership and stays immutable", () => {
  const partition = createShardedQualityGatePlan();
  assert.equal(Object.isFrozen(partition), true);
  assert.equal(partition.logicalWorkloadCount, 224);
  assert.equal(partition.physicalWorkloadCount, 241);
  assert.equal(partition.repeatedPrefixWorkloadCount, 16);
  assert.equal(partition.additionalJoinPreparationCount, 1);
  for (const shardId of SHARD_IDS) {
    const shard = getRequiredProofShard(shardId);
    const executable = createRequiredExhaustiveProofShardPlan(shardId);
    assert.equal(Object.isFrozen(shard), true);
    assert.equal(Object.isFrozen(shard.proofPairIds), true);
    assert.equal(Object.isFrozen(shard.prefixIds), true);
    assert.deepEqual(
      shard.proofPairIds,
      executable.proofPairs.map(({ id }) => id),
    );
    assert.deepEqual(
      shard.prefixIds,
      executable.prefix.map(({ id }) => id),
    );
    assert.equal(shard.stepCount, executable.stepCount);
    assert.equal(shard.proofPairCount, executable.proofPairCount);
    assert.equal(shard.inventorySha256, executable.inventorySha256);
  }
});

test("CI-04 successful same-run needs admit a distinct join authority, including non-PR context", () => {
  for (const context of [HOSTED_CONTEXT, { ...HOSTED_CONTEXT, headRevision: "" }]) {
    const needs = successfulNeeds(context);
    const before = JSON.stringify(needs);
    const joined = validateRequiredShardJoinNeeds(needs, context);
    assert.equal(typeof joined, "object");
    assert.notEqual(joined, null);
    assert.equal(Object.isFrozen(joined), true);
    assert.equal(JSON.stringify(needs), before);
    assert.equal(Object.hasOwn(joined, "observedClose"), false);
    assert.equal(Object.hasOwn(joined, "completedIds"), false);
  }
});

test("CI-04 absent, extra, substituted, and non-successful jobs cannot be joined", () => {
  for (const jobId of ["quality-route", ...SHARD_IDS]) {
    const missing = successfulNeeds();
    Reflect.deleteProperty(missing, jobId);
    assert.throws(() => validateRequiredShardJoinNeeds(missing, HOSTED_CONTEXT));
    for (const result of ["failure", "cancelled", "skipped", "timed_out", "", "PASS", undefined]) {
      const needs = successfulNeeds();
      needs[jobId].result = result;
      assert.throws(
        () => validateRequiredShardJoinNeeds(needs, HOSTED_CONTEXT),
        `${jobId}: ${result}`,
      );
    }
  }
  const extra = successfulNeeds();
  extra["proof-d"] = extra["proof-a"];
  assert.throws(() => validateRequiredShardJoinNeeds(extra, HOSTED_CONTEXT));
  const substituted = successfulNeeds();
  substituted["proof-b"].outputs.receipt = substituted["proof-a"].outputs.receipt;
  assert.throws(() => validateRequiredShardJoinNeeds(substituted, HOSTED_CONTEXT));
  for (const mode of ["AFFECTED", "LEGACY", "SHADOW", "exhaustive", ""]) {
    const needs = successfulNeeds();
    needs["quality-route"].outputs.mode = mode;
    assert.throws(() => validateRequiredShardJoinNeeds(needs, HOSTED_CONTEXT));
  }
});

test("CI-04 foreign revision, head, workflow run, or future attempt cannot reuse successful shards", () => {
  for (const [field, value] of [
    ["executionRevision", "c".repeat(40)],
    ["headRevision", "d".repeat(40)],
    ["workflowRunId", "34060300432"],
    ["workflowRunAttempt", "3"],
  ]) {
    for (const shardId of SHARD_IDS) {
      const needs = changeSummary(successfulNeeds(), shardId, (summary) => {
        summary[field] = value;
      });
      assert.throws(
        () => validateRequiredShardJoinNeeds(needs, HOSTED_CONTEXT),
        `${shardId}: ${field}`,
      );
    }
    if (field !== "workflowRunAttempt") {
      assert.throws(() =>
        validateRequiredShardJoinNeeds(successfulNeeds(), { ...HOSTED_CONTEXT, [field]: value }),
      );
    }
  }
});

test("CI-04 retained successful needs from an earlier same-run attempt remain explicit remote authority", () => {
  const prior = { ...HOSTED_CONTEXT, workflowRunAttempt: "1" };
  const admitted = validateRequiredShardJoinNeeds(successfulNeeds(prior), HOSTED_CONTEXT);
  assert.equal(admitted.status, "ADMITTED");
  assert.equal(admitted.localProcessCloseAuthority, false);
  for (const workflowRunAttempt of ["0", "-1", "01", "2.5", "", 1]) {
    const needs = changeSummary(successfulNeeds(), "proof-a", (summary) => {
      summary.workflowRunAttempt = workflowRunAttempt;
    });
    assert.throws(() => validateRequiredShardJoinNeeds(needs, HOSTED_CONTEXT));
  }
});

test("CI-04 forged shard totals, identities, guards, or serialized status never authorize a join", () => {
  const sample = createRequiredProofShardSummary("proof-a", HOSTED_CONTEXT);
  const mutations = [
    ["schemaVersion", 2],
    ["profile", "forged"],
    ["authority", "SHADOW"],
    ["status", "FAIL"],
    ["shardId", "proof-b"],
    ["planSha256", "0".repeat(64)],
    ["inventorySha256", "0".repeat(64)],
    ["parentPlanSha256", "0".repeat(64)],
    ["stepCount", sample.stepCount - 1],
    ["observedClosedCount", sample.observedClosedCount - 1],
    ["proofPairCount", sample.proofPairCount - 1],
    ["prefixCount", 0],
    ["barrierCount", 0],
    ["workspaceUnchanged", false],
    ["buildOutputsUnchanged", false],
    ["untrackedStateUnchanged", false],
  ];
  for (const [field, value] of mutations) {
    const needs = changeSummary(successfulNeeds(), "proof-a", (summary) => {
      summary[field] = value;
    });
    assert.throws(() => validateRequiredShardJoinNeeds(needs, HOSTED_CONTEXT), field);
  }
  for (const field of Object.keys(sample)) {
    const needs = changeSummary(successfulNeeds(), "proof-a", (summary) => {
      Reflect.deleteProperty(summary, field);
    });
    assert.throws(() => validateRequiredShardJoinNeeds(needs, HOSTED_CONTEXT), field);
  }
  const extra = changeSummary(successfulNeeds(), "proof-a", (summary) => {
    summary.completedIds = [];
  });
  assert.throws(() => validateRequiredShardJoinNeeds(extra, HOSTED_CONTEXT));
});

test("CI-04 malformed, oversized, and duplicate-key receipt JSON is rejected", () => {
  const valid = successfulNeeds()["proof-a"].outputs.receipt;
  for (const receipt of [
    "",
    "null",
    "[]",
    "{",
    "true",
    " ".repeat(16 * 1024 + 1),
    `{"schemaVersion":999,${valid.slice(1)}`,
    JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(valid)).reverse())),
    JSON.stringify({ ...JSON.parse(valid), extra: "x".repeat(16 * 1024) }),
  ]) {
    const needs = successfulNeeds();
    needs["proof-a"].outputs.receipt = receipt;
    assert.throws(() => validateRequiredShardJoinNeeds(needs, HOSTED_CONTEXT));
  }
});

test("CI-04 join admission rejects accessors and proxies without invoking caller code", () => {
  let traps = 0;
  const needs = successfulNeeds();
  Object.defineProperty(needs["proof-a"], "result", {
    enumerable: true,
    get() {
      traps += 1;
      return "success";
    },
  });
  assert.throws(() => validateRequiredShardJoinNeeds(needs, HOSTED_CONTEXT));
  const hostile = new Proxy(successfulNeeds(), {
    getPrototypeOf() {
      traps += 1;
      throw new Error("proxy trap must not run");
    },
    ownKeys() {
      traps += 1;
      throw new Error("proxy trap must not run");
    },
    get() {
      traps += 1;
      throw new Error("proxy trap must not run");
    },
  });
  assert.throws(() => validateRequiredShardJoinNeeds(hostile, HOSTED_CONTEXT));
  const context = Object.defineProperty({ ...HOSTED_CONTEXT }, "executionRevision", {
    enumerable: true,
    get() {
      traps += 1;
      return HOSTED_CONTEXT.executionRevision;
    },
  });
  assert.throws(() => validateRequiredShardJoinNeeds(successfulNeeds(), context));
  assert.equal(traps, 0);
});

test("CI-04 join observes only a fresh local build and ordered suffix after remote admission", async () => {
  const githubAuthority = validateRequiredShardJoinNeeds(successfulNeeds(), HOSTED_CONTEXT);
  const plan = createRequiredExhaustiveJoinPlan(githubAuthority, { authority: OPTIONAL_AUTHORITY });
  assert.equal(plan.scope, "EXHAUSTIVE_JOIN");
  assert.equal(plan.stepCount, 3);
  assert.equal(plan.proofPairCount, 0);
  assert.deepEqual(
    plan.nodes.map(({ id }) => id),
    ["workspace-graph", "dependency-boundaries", "boundary-fixtures"],
  );
  const started = [];
  let active = 0;
  let maximumActive = 0;
  const receipt = await runRequiredExhaustiveJoinPlan(plan, {
    authority: OPTIONAL_AUTHORITY,
    ...guards(),
    runStep: async (node) => {
      started.push(node.id);
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await nextTurn();
      active -= 1;
      return createSuccessfulExhaustiveStepObservation(node);
    },
  });
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 3);
  assert.equal(receipt.githubPrerequisites, githubAuthority);
  assert.equal(receipt.githubPrerequisites.localProcessCloseAuthority, false);
  assert.equal(maximumActive, 1);
  assert.deepEqual(
    started,
    plan.nodes.map(({ id }) => id),
  );
  assert.deepEqual(
    receipt.steps.map(({ id }) => id),
    started,
  );
  assert.equal(
    receipt.steps.every(({ observedClose }) => observedClose),
    true,
  );
});

test("CI-04 cloned and raw SHADOW join authority cannot authorize REQUIRED execution", async () => {
  const admitted = validateRequiredShardJoinNeeds(successfulNeeds(), HOSTED_CONTEXT);
  for (const candidate of [
    undefined,
    {},
    structuredClone(admitted),
    { ...admitted, localProcessCloseAuthority: true },
  ]) {
    assert.throws(
      () => createRequiredExhaustiveJoinPlan(candidate, { authority: OPTIONAL_AUTHORITY }),
      ShardedQualityGateAuthorityError,
    );
  }
  assert.equal(admitted.trustedWorkflowContext, false);
  assert.throws(() => createRequiredExhaustiveJoinPlan(admitted), ShardedQualityGateAuthorityError);
  assert.throws(
    () => validateHostedRequiredShardJoinAuthority(admitted),
    ShardedQualityGateAuthorityError,
  );
  let starts = 0;
  await assert.rejects(
    executeRequiredExhaustiveJoin({
      githubAuthority: admitted,
      ...guards(),
      runStep: async (node) => {
        starts += 1;
        return createSuccessfulExhaustiveStepObservation(node);
      },
    }),
    ShardedQualityGateAuthorityError,
  );
  assert.equal(starts, 0);
});

test("CI-04 hosted join capture rejects caller arguments and confines ambient authority to the quality job", () => {
  for (const argument of [undefined, {}, successfulNeeds()]) {
    assert.throws(
      () => captureHostedRequiredShardJoinAuthority(argument),
      ShardedQualityGateAuthorityError,
    );
  }
  const moduleUrl = new URL("../sharded-quality-gate-authority.mjs", import.meta.url).href;
  const source = `
    import assert from 'node:assert/strict';
    import {
      captureHostedRequiredShardJoinAuthority,
      validateHostedRequiredShardJoinAuthority,
      ShardedQualityGateAuthorityError,
    } from ${JSON.stringify(moduleUrl)};
    const admitted = captureHostedRequiredShardJoinAuthority();
    assert.equal(admitted.trustedWorkflowContext, true);
    assert.equal(admitted.authority, 'GITHUB_SUCCESSFUL_DEPENDENCIES');
    assert.equal(validateHostedRequiredShardJoinAuthority(admitted), admitted);
    assert.throws(() => validateHostedRequiredShardJoinAuthority(structuredClone(admitted)), ShardedQualityGateAuthorityError);
    for (const [key, value] of [
      ['GITHUB_ACTIONS', 'false'], ['GITHUB_JOB', 'proof-a'], ['GITHUB_JOB', ''],
      ['GITHUB_SHA', 'c'.repeat(40)], ['GITHUB_RUN_ID', '34060300432'],
      ['GITHUB_RUN_ATTEMPT', '0'], ['GITHUB_RUN_ATTEMPT', '1'],
      ['DESEN_REQUIRED_HEAD_REVISION', 'd'.repeat(40)],
      ['DESEN_REQUIRED_SHARD_JOIN_NEEDS', '{'],
      ['DESEN_REQUIRED_SHARD_JOIN_NEEDS', ' '.repeat(65537)],
      ['DESEN_REQUIRED_SHARD_JOIN_NEEDS', undefined],
    ]) {
      const previous = process.env[key];
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
      assert.throws(() => captureHostedRequiredShardJoinAuthority(), ShardedQualityGateAuthorityError, key);
      if (previous === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = previous;
    }
    process.stdout.write('host-capture-contracts-checked\\n');
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      GITHUB_ACTIONS: "true",
      GITHUB_JOB: "quality",
      GITHUB_SHA: HOSTED_CONTEXT.executionRevision,
      GITHUB_RUN_ID: HOSTED_CONTEXT.workflowRunId,
      GITHUB_RUN_ATTEMPT: HOSTED_CONTEXT.workflowRunAttempt,
      DESEN_REQUIRED_HEAD_REVISION: HOSTED_CONTEXT.headRevision,
      DESEN_REQUIRED_SHARD_JOIN_NEEDS: JSON.stringify(successfulNeeds()),
    },
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.signal, null);
  assert.equal(child.stdout, "host-capture-contracts-checked\n");
});

test("CI-04 join preparation failure and post-suffix build drift cannot report success", async () => {
  const admitted = validateRequiredShardJoinNeeds(successfulNeeds(), HOSTED_CONTEXT);
  const plan = createRequiredExhaustiveJoinPlan(admitted, { authority: OPTIONAL_AUTHORITY });
  const failure = new Error("fresh join build failed");
  const started = [];
  await assert.rejects(
    runRequiredExhaustiveJoinPlan(plan, {
      authority: OPTIONAL_AUTHORITY,
      ...guards(),
      runStep: async (node) => {
        started.push(node.id);
        throw failure;
      },
    }),
    (error) => error === failure,
  );
  assert.deepEqual(started, ["workspace-graph"]);
  let closes = 0;
  let buildChecks = 0;
  const drift = new Error("post-suffix build drift");
  await assert.rejects(
    runRequiredExhaustiveJoinPlan(plan, {
      authority: OPTIONAL_AUTHORITY,
      ...guards({
        assertBuildOutputsUnchangedFunction: () => {
          buildChecks += 1;
          if (closes === 3) throw drift;
        },
      }),
      runStep: async (node) => {
        closes += 1;
        return createSuccessfulExhaustiveStepObservation(node);
      },
    }),
    (error) => error === drift,
  );
  assert.equal(closes, 3);
  assert.ok(buildChecks > 0);
});

test("CI-04 the live join boundary rejects a checkout revision foreign to its admitted needs", async () => {
  const githubAuthority = validateRequiredShardJoinNeeds(successfulNeeds(), HOSTED_CONTEXT);
  await assert.rejects(
    executeRequiredExhaustiveJoin({
      githubAuthority,
      authority: OPTIONAL_AUTHORITY,
      expectedRevision: "f".repeat(40),
    }),
    (error) => error.code === "REQUIRED_EXHAUSTIVE_JOIN_DRIFT",
  );
});

test("CI-04 routing rejects injected, unknown, accessor, and proxy options before promotion", async () => {
  let called = 0;
  for (const options of [
    { unknown: true },
    { testSeams: {} },
    {
      runStep: () => {
        called += 1;
      },
    },
    { workspaceRoot: WORKSPACE_ROOT },
    Object.defineProperty({}, "eventName", {
      enumerable: true,
      get() {
        called += 1;
        return "push";
      },
    }),
    new Proxy(
      {},
      {
        getPrototypeOf() {
          called += 1;
          throw new Error("proxy trap must not run");
        },
        ownKeys() {
          called += 1;
          throw new Error("proxy trap must not run");
        },
      },
    ),
  ]) {
    await assert.rejects(resolveRequiredQualityGateRoute(options), (error) =>
      ["REQUIRED_AFFECTED_OPTIONS_INVALID", "REQUIRED_AFFECTED_AUTHORITY_INJECTED"].includes(
        error.code,
      ),
    );
  }
  assert.equal(called, 0);
});

test("CI-04 live push and untrusted pull-request routing remain fresh exhaustive decisions", async () => {
  assert.deepEqual(await resolveRequiredQualityGateRoute({ eventName: "push" }), {
    mode: "EXHAUSTIVE",
  });
  assert.deepEqual(
    await resolveRequiredQualityGateRoute({
      eventName: "pull_request",
      sameRepository: false,
      baseRevision: "c".repeat(40),
      headRevision: "d".repeat(40),
      executionRevision: "e".repeat(40),
    }),
    { mode: "EXHAUSTIVE" },
  );
});

test("CI-04 hosted workflow keeps exact shards and an always-run required join", async () => {
  const workflow = await readFile(path.join(WORKSPACE_ROOT, ".github/workflows/ci.yml"), "utf8");
  for (const shardId of SHARD_IDS) {
    assert.equal(workflow.split(`  ${shardId}:\n`).length - 1, 1);
    assert.equal(
      workflow.split(`run-required-sharded-quality-gate.mjs shard ${shardId}`).length - 1,
      1,
    );
  }
  assert.match(workflow, /needs: \[quality-route, proof-a, proof-b, proof-c\]/u);
  assert.match(workflow, /if: \$\{\{ always\(\) &&/u);
  assert.match(workflow, /name: Quality gate\n/u);
  assert.match(workflow, /run-required-affected-quality-gate\.mjs --route/u);
  assert.match(workflow, /run-required-sharded-quality-gate\.mjs join/u);
  assert.match(workflow, /DESEN_REQUIRED_SHARD_JOIN_NEEDS: \$\{\{ toJSON\(needs\) \}\}/u);
});

test("CI-04 the shard CLI emits summaries only after real REQUIRED execution and closing guards", async () => {
  const source = await readFile(
    path.join(WORKSPACE_ROOT, "scripts/ci/run-required-sharded-quality-gate.mjs"),
    "utf8",
  );
  const shardStart = source.indexOf('if (args.length === 2 && args[0] === "shard")');
  const joinStart = source.indexOf('} else if (args.length === 1 && args[0] === "join")');
  assert.ok(shardStart >= 0 && joinStart > shardStart);
  const shard = source.slice(shardStart, joinStart);
  const execution = shard.indexOf("await executeRequiredExhaustiveProofShard(");
  const closed = shard.indexOf("assertClosedExecution(boundary, plan, context)");
  const cancellation = shard.indexOf("if (cancellation.terminalState.winner())");
  const output = shard.indexOf("appendFileSync(outputPath,");
  assert.ok(execution >= 0 && closed > execution && cancellation > closed && output > cancellation);
  assert.doesNotMatch(source, /DESEN_CI_AUTHORITY|OPTIONAL_AUTHORITY|runStep:|testSeams:/u);
  assert.match(source, /execution\.authority !== "REQUIRED"/u);
  assert.match(source, /step\.observedClose !== true/u);
  assert.match(source, /boundary\.workspaceBefore\.digest !== boundary\.workspaceAfter\?\.digest/u);
});

test("CI-04 unknown shards and cloned, omitted, duplicated, or cross-scope plans cannot execute", async () => {
  for (const id of ["", "proof-d", "proof-a ", "../proof-a", 0, undefined]) {
    assert.throws(
      () => createRequiredExhaustiveProofShardPlan(id),
      ShardedQualityGateAuthorityError,
    );
  }
  const plan = shadowPlan();
  let starts = 0;
  const runStep = async (node) => {
    starts += 1;
    return createSuccessfulExhaustiveStepObservation(node);
  };
  for (const candidate of [
    structuredClone(plan),
    { ...plan, proofPairs: plan.proofPairs.slice(1) },
    { ...plan, proofPairs: [...plan.proofPairs, plan.proofPairs[0]] },
    createRequiredExhaustivePlan({ authority: OPTIONAL_AUTHORITY }),
  ]) {
    await assert.rejects(runShadow(candidate, { runStep }), RequiredExhaustiveQualityGateError);
  }
  await assert.rejects(
    runRequiredExhaustivePlan(plan, { authority: OPTIONAL_AUTHORITY, runStep, ...guards() }),
    RequiredExhaustiveQualityGateError,
  );
  assert.equal(starts, 0);
});

test("CI-04 REQUIRED shards reject injected execution instead of promoting SHADOW closes", async () => {
  let starts = 0;
  for (const id of SHARD_IDS) {
    await assert.rejects(
      runRequiredExhaustiveProofShardPlan(createRequiredExhaustiveProofShardPlan(id), {
        runStep: async (node) => {
          starts += 1;
          return createSuccessfulExhaustiveStepObservation(node);
        },
        ...guards(),
      }),
      RequiredExhaustiveQualityGateError,
    );
  }
  assert.equal(starts, 0);
});

test("CI-04 every shard and join wrapper rejects unsafe option records without invoking caller code", async () => {
  const shard = shadowPlan();
  const githubAuthority = validateRequiredShardJoinNeeds(successfulNeeds(), HOSTED_CONTEXT);
  const join = createRequiredExhaustiveJoinPlan(githubAuthority, { authority: OPTIONAL_AUTHORITY });
  let callerCode = 0;
  const executionOptions = {
    authority: OPTIONAL_AUTHORITY,
    ...guards(),
    runStep: async () => {
      callerCode += 1;
      throw new Error("injected runner must not execute");
    },
  };
  const wrappers = [
    [
      "create shard",
      (options) => createRequiredExhaustiveProofShardPlan("proof-a", options),
      { authority: OPTIONAL_AUTHORITY },
    ],
    [
      "create join",
      (options) => createRequiredExhaustiveJoinPlan(githubAuthority, options),
      { authority: OPTIONAL_AUTHORITY },
    ],
    [
      "run shard",
      (options) => runRequiredExhaustiveProofShardPlan(shard, options),
      executionOptions,
    ],
    ["run join", (options) => runRequiredExhaustiveJoinPlan(join, options), executionOptions],
    [
      "execute shard",
      executeRequiredExhaustiveProofShard,
      { ...executionOptions, shardId: "proof-a" },
    ],
    ["execute join", executeRequiredExhaustiveJoin, { ...executionOptions, githubAuthority }],
  ];
  for (const [label, invoke, base] of wrappers) {
    const accessor = Object.defineProperty({ ...base }, "authority", {
      enumerable: true,
      get() {
        callerCode += 1;
        return OPTIONAL_AUTHORITY;
      },
    });
    const proxy = new Proxy(
      { ...base },
      {
        getPrototypeOf() {
          callerCode += 1;
          throw new Error("proxy trap must not run");
        },
        ownKeys() {
          callerCode += 1;
          throw new Error("proxy trap must not run");
        },
        get() {
          callerCode += 1;
          throw new Error("proxy trap must not run");
        },
      },
    );
    for (const options of [
      null,
      [],
      { ...base, unknown: true },
      { ...base, [Symbol("unknown")]: true },
      accessor,
      proxy,
    ]) {
      await assert.rejects(
        async () => invoke(options),
        (error) => error.code === "REQUIRED_EXHAUSTIVE_AUTHORITY_INVALID",
        label,
      );
    }
  }
  assert.equal(callerCode, 0);
});

for (const shardId of SHARD_IDS) {
  test(`CI-04 ${shardId} runs every assigned step fresh with two workers and drained barriers`, async () => {
    const plan = shadowPlan(shardId);
    const started = new Set();
    const closed = new Set();
    const barrierSteps = new Set(
      plan.proofPairs
        .filter(({ id }) => classifyProofPairState(id).barrier)
        .flatMap(({ verifier, rootTest }) => [verifier.id, rootTest.id]),
    );
    const seenBarriers = new Set();
    let active = 0;
    let maximumActive = 0;
    let activeBarrier = false;
    const receipt = await runShadow(plan, {
      runStep: async (node) => {
        assert.equal(started.has(node.id), false, `duplicate start ${node.id}`);
        for (const dependency of node.dependencies) {
          assert.equal(
            closed.has(dependency),
            true,
            `${node.id} started before ${dependency} closed`,
          );
        }
        started.add(node.id);
        assert.equal(activeBarrier, false, `${node.id} overlapped a barrier`);
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        if (node.executionClass !== "CONCURRENT_PROOF" || barrierSteps.has(node.id)) {
          assert.equal(active, 1);
          activeBarrier = true;
          if (barrierSteps.has(node.id)) seenBarriers.add(node.id);
        }
        await nextTurn();
        if (node.executionClass !== "CONCURRENT_PROOF" || barrierSteps.has(node.id))
          activeBarrier = false;
        active -= 1;
        closed.add(node.id);
        return createSuccessfulExhaustiveStepObservation(node);
      },
    });
    assert.equal(receipt.status, "PASS");
    assert.equal(receipt.observedClosedCount, plan.stepCount);
    assert.equal(maximumActive, 2);
    assert.equal(active, 0);
    assert.deepEqual([...seenBarriers].sort(), [...barrierSteps].sort());
    assert.deepEqual([...started].sort(), plan.nodes.map(({ id }) => id).sort());
    assert.deepEqual([...closed].sort(), [...started].sort());
  });
}

test("CI-04 first shard proof failure drains its sibling and admits no root or later pair", async () => {
  const plan = shadowPlan();
  const failure = new Error("injected shard proof failure");
  const started = [];
  let releaseBoth;
  const bothStarted = new Promise((resolve) => {
    releaseBoth = resolve;
  });
  let siblingClosed = false;
  await assert.rejects(
    runShadow(plan, {
      runStep: async (node, { signal }) => {
        if (node.executionClass !== "CONCURRENT_PROOF")
          return createSuccessfulExhaustiveStepObservation(node);
        const first = started.length === 0;
        started.push(node.id);
        if (started.length === 2) releaseBoth();
        await bothStarted;
        if (first) throw failure;
        await new Promise((resolve) => {
          signal.addEventListener("abort", resolve, { once: true });
        });
        await nextTurn();
        siblingClosed = true;
        throw signal.reason;
      },
    }),
    (error) => error === failure,
  );
  assert.equal(siblingClosed, true);
  assert.equal(started.length, 2);
  assert.equal(
    started.every((id) => id.startsWith("verify-")),
    true,
  );
});

test("CI-04 cancelled or failed prefixes cannot start proof work", async () => {
  const plan = shadowPlan();
  const controller = new AbortController();
  controller.abort(new RequiredExhaustiveCancellationError("SIGTERM"));
  let starts = 0;
  await assert.rejects(
    runShadow(plan, {
      signal: controller.signal,
      runStep: async (node) => {
        starts += 1;
        return createSuccessfulExhaustiveStepObservation(node);
      },
    }),
    RequiredExhaustiveCancellationError,
  );
  assert.equal(starts, 0);
  const failure = new Error("package tests failed");
  const started = [];
  await assert.rejects(
    runShadow(plan, {
      runStep: async (node) => {
        started.push(node.id);
        if (node.id === "package-tests") throw failure;
        return createSuccessfulExhaustiveStepObservation(node);
      },
    }),
    (error) => error === failure,
  );
  assert.deepEqual(
    started,
    plan.prefix.slice(0, 6).map(({ id }) => id),
  );
});

test("CI-04 cancellation drains both active shard workers without launching their roots", async () => {
  const plan = shadowPlan("proof-c");
  const controller = new AbortController();
  const cancellation = new RequiredExhaustiveCancellationError("SIGINT");
  const started = [];
  const drained = [];
  await assert.rejects(
    runShadow(plan, {
      signal: controller.signal,
      runStep: async (node, { signal }) => {
        if (node.executionClass !== "CONCURRENT_PROOF")
          return createSuccessfulExhaustiveStepObservation(node);
        started.push(node.id);
        if (started.length === 2) controller.abort(cancellation);
        if (!signal.aborted)
          await new Promise((resolve) => {
            signal.addEventListener("abort", resolve, { once: true });
          });
        await nextTurn();
        drained.push(node.id);
        throw signal.reason;
      },
    }),
    (error) => error === cancellation,
  );
  assert.equal(started.length, 2);
  assert.equal(
    started.every((id) => id.startsWith("verify-")),
    true,
  );
  assert.deepEqual([...drained].sort(), [...started].sort());
});

test("CI-04 missing close observations cannot advance a shard", async () => {
  const plan = shadowPlan();
  for (const candidate of [undefined, { status: "PASS" }]) {
    const started = [];
    await assert.rejects(
      runShadow(plan, {
        runStep: async (node) => {
          started.push(node.id);
          return candidate;
        },
      }),
      RequiredExhaustiveQualityGateError,
    );
    assert.deepEqual(started, [plan.prefix[0].id]);
  }
});

test("CI-04 final build and untracked guards still reject after every shard step closes", async () => {
  const plan = shadowPlan("proof-c");
  for (const guard of [
    "assertBuildOutputsUnchangedFunction",
    "assertUntrackedStateUnchangedFunction",
  ]) {
    const failure = new Error(`${guard} detected drift`);
    let closed = 0;
    await assert.rejects(
      runShadow(plan, {
        [guard]: () => {
          throw failure;
        },
        runStep: async (node) => {
          closed += 1;
          return createSuccessfulExhaustiveStepObservation(node);
        },
      }),
      (error) => error === failure,
    );
    assert.equal(closed, plan.stepCount);
  }
});

for (const exitCode of [0, 7]) {
  test(`CI-04 a real child close ${exitCode} determines the SHADOW shard outcome`, async () => {
    const plan = shadowPlan("proof-c");
    const registry = createRequiredExhaustiveProcessRegistry();
    const terminal = createRequiredExhaustiveTerminalState({ processRegistry: registry });
    let children = 0;
    const childRunner = createRequiredExhaustiveProcessRunner({
      processRegistry: registry,
      terminalState: terminal,
      spawnFunction: (_command, _args, options) => {
        children += 1;
        return spawn(process.execPath, ["-e", `process.exit(${exitCode})`], options);
      },
      prepareStepEnvironment: async () => undefined,
      printCommandFunction: null,
      stepTimeoutMs: 10_000,
    });
    const started = [];
    const running = runShadow(plan, {
      terminalState: terminal,
      runStep: async (node, options) => {
        started.push(node.id);
        return node.id === plan.prefix[0].id
          ? await childRunner(node, options)
          : createSuccessfulExhaustiveStepObservation(node);
      },
    });
    if (exitCode === 0) {
      const receipt = await running;
      assert.equal(receipt.status, "PASS");
      assert.equal(receipt.observedClosedCount, plan.stepCount);
    } else {
      await assert.rejects(running, (error) => error.exitCode === exitCode);
      assert.deepEqual(started, [plan.prefix[0].id]);
    }
    assert.equal(children, 1);
    assert.equal(registry.activeCount(), 0);
  });
}
