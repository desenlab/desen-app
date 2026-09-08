import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  createExhaustiveWorkloadInventory,
  validateExhaustiveWorkloadInventory,
} from "./exhaustive-workload-inventory.mjs";
import { classifyProofPairState } from "./shared-state-authority.mjs";

/** Exact GitHub job identities admitted by the reviewed exhaustive partition. */
export const SHARD_IDS = Object.freeze(["proof-a", "proof-b", "proof-c"]);
/** Reviewed identity of the logical coverage, replicated prerequisites, and static assignment. */
export const SHARDED_QUALITY_GATE_PLAN_SHA256 =
  "2ecb8da28849ce90bb453756ad4853e9b7652887415e579bdafd1e34e37eafd4";
/** Distinct distributed-plan profile; the historical monolithic authority remains unchanged. */
export const SHARDED_QUALITY_GATE_PROFILE = "desen.ci.sharded-quality-gate-plan.v1";
/** Public summary schema, which by itself grants neither hosted nor local-close authority. */
export const REQUIRED_PROOF_SHARD_SUMMARY_PROFILE = "desen.ci.required-proof-shard-summary.v1";
const PARENT_PLAN_SHA256 = "2e58d4792e2e2a5734d573c439101a9b4c12d2faee3895ff7c50693d80f0175b";
const PREFIX_IDS = Object.freeze([
  "orchestrator-contracts",
  "format",
  "lint",
  "structural-validator-artifacts",
  "workspace-graph",
  "package-tests",
  "editor-core-public-package-contract",
  "editor-web-public-package-contract",
]);
const JOIN_PREPARATION_IDS = Object.freeze(["workspace-graph"]);
const SUFFIX_IDS = Object.freeze(["dependency-boundaries", "boundary-fixtures"]);
const CONTEXT_KEYS = Object.freeze([
  "executionRevision",
  "headRevision",
  "workflowRunId",
  "workflowRunAttempt",
]);
const SUMMARY_KEYS = Object.freeze([
  "schemaVersion",
  "profile",
  "authority",
  "status",
  "shardId",
  ...CONTEXT_KEYS,
  "planSha256",
  "inventorySha256",
  "parentPlanSha256",
  "stepCount",
  "observedClosedCount",
  "proofPairCount",
  "prefixCount",
  "barrierCount",
  "workspaceUnchanged",
  "buildOutputsUnchanged",
  "untrackedStateUnchanged",
]);
const MAX_SUMMARY_BYTES = 16 * 1_024;
const MAX_NEEDS_BYTES = 64 * 1_024;
const AUTHENTIC_PLANS = new WeakSet();
const AUTHENTIC_JOIN_AUTHORITIES = new WeakSet();
const AUTHENTIC_HOSTED_JOIN_AUTHORITIES = new WeakSet();

/** Fail-closed error for the fixed CI-04 distributed coverage contract. */
export class ShardedQualityGateAuthorityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ShardedQualityGateAuthorityError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new ShardedQualityGateAuthorityError(code, message);
}

function deepFreeze(value) {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === "object") deepFreeze(child);
  }
  return Object.freeze(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function captureRecord(value, keys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    fail("SHARDED_QUALITY_GATE_INPUT_INVALID", `${label} must be an inert plain record.`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => !keys.includes(key))) {
    fail("SHARDED_QUALITY_GATE_INPUT_INVALID", `${label} has an unreviewed field inventory.`);
  }
  const captured = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !Object.hasOwn(descriptor, "value") ||
      descriptor.enumerable !== true
    ) {
      fail("SHARDED_QUALITY_GATE_INPUT_INVALID", `${label} must not contain accessors.`);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function captureContext(rawContext) {
  const context = captureRecord(rawContext, CONTEXT_KEYS, "The workflow context");
  if (
    typeof context.executionRevision !== "string" ||
    !/^[0-9a-f]{40}$/u.test(context.executionRevision) ||
    typeof context.headRevision !== "string" ||
    (context.headRevision !== "" && !/^[0-9a-f]{40}$/u.test(context.headRevision)) ||
    typeof context.workflowRunId !== "string" ||
    !/^[1-9][0-9]{0,19}$/u.test(context.workflowRunId) ||
    typeof context.workflowRunAttempt !== "string" ||
    !/^[1-9][0-9]{0,5}$/u.test(context.workflowRunAttempt)
  ) {
    fail("SHARDED_QUALITY_GATE_INPUT_INVALID", "The workflow context identity is invalid.");
  }
  return Object.freeze(context);
}

function assertIdsEqual(actual, expected, label) {
  if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) {
    fail("SHARDED_QUALITY_GATE_PLAN_DRIFT", `${label} differs from the reviewed inventory.`);
  }
}

/**
 * Builds the fixed 53/24/32 proof-pair partition from the authenticated 228-node inventory.
 * Its logical coverage remains 228; three prefixes and the join's fresh build execute 245
 * physical workloads. No duplicate preparation is represented as a skipped successful close.
 */
export function createShardedQualityGatePlan(rawOptions = undefined) {
  if (rawOptions !== undefined) {
    fail("SHARDED_QUALITY_GATE_INPUT_INVALID", "The distributed plan accepts no caller policy.");
  }
  const inventory = validateExhaustiveWorkloadInventory(createExhaustiveWorkloadInventory());
  const proofIds = inventory.proofUnits.map(({ id }) => id);
  const nodeById = new Map(inventory.nodes.map((node) => [node.id, node]));
  const prefixSet = new Set(PREFIX_IDS);
  assertIdsEqual(
    inventory.nodes.slice(0, 8).map(({ id }) => id),
    PREFIX_IDS,
    "The prefix",
  );
  assertIdsEqual(
    inventory.nodes.slice(-2).map(({ id }) => id),
    SUFFIX_IDS,
    "The suffix",
  );
  if (inventory.workloadCount !== 228 || inventory.proofUnitCount !== 109) {
    fail("SHARDED_QUALITY_GATE_PLAN_DRIFT", "The exhaustive workload universe changed.");
  }
  const completedPrefix = new Set();
  for (const id of PREFIX_IDS) {
    if (nodeById.get(id).dependencies.some((dependency) => !completedPrefix.has(dependency))) {
      fail("SHARDED_QUALITY_GATE_PLAN_DRIFT", "A prefix dependency would be bypassed.");
    }
    completedPrefix.add(id);
  }
  for (const { verifierNodeId, rootTestNodeId } of inventory.proofUnits) {
    const verifier = nodeById.get(verifierNodeId);
    const rootTest = nodeById.get(rootTestNodeId);
    if (verifier.dependencies.some((dependency) => !prefixSet.has(dependency))) {
      fail("SHARDED_QUALITY_GATE_PLAN_DRIFT", "A proof has an unreviewed cross-shard dependency.");
    }
    assertIdsEqual(rootTest.dependencies, [verifierNodeId], "The verifier/root dependency");
  }
  const ranges = [proofIds.slice(0, 53), proofIds.slice(53, 77), proofIds.slice(77)];
  const shardProjections = ranges.map((proofPairIds, index) => ({
    id: SHARD_IDS[index],
    proofPairIds,
    barrierPairIds: proofPairIds.filter((id) => classifyProofPairState(id).barrier),
  }));
  assertIdsEqual(
    shardProjections.flatMap(({ proofPairIds }) => proofPairIds),
    proofIds,
    "The partition",
  );
  if (
    new Set(shardProjections.flatMap(({ proofPairIds }) => proofPairIds)).size !== 109 ||
    shardProjections.some(
      ({ barrierPairIds }, index) => barrierPairIds.length !== [11, 0, 0][index],
    )
  ) {
    fail(
      "SHARDED_QUALITY_GATE_PLAN_DRIFT",
      "The partition overlaps or changes an exclusive barrier.",
    );
  }
  const projection = {
    schemaVersion: 1,
    profile: SHARDED_QUALITY_GATE_PROFILE,
    authority: "REQUIRED_DISTRIBUTED",
    scope: "EXHAUSTIVE",
    parentPlanSha256: PARENT_PLAN_SHA256,
    inventorySha256: inventory.inventorySha256,
    concurrencyPerShard: 2,
    logicalWorkloadCount: 228,
    proofPairCount: 109,
    prefixIds: PREFIX_IDS,
    joinPreparationIds: JOIN_PREPARATION_IDS,
    suffixIds: SUFFIX_IDS,
    shards: shardProjections,
  };
  const planSha256 = sha256(JSON.stringify(projection));
  if (planSha256 !== SHARDED_QUALITY_GATE_PLAN_SHA256) {
    fail("SHARDED_QUALITY_GATE_PLAN_DRIFT", "The reviewed static partition digest changed.");
  }
  const pairById = new Map(inventory.proofUnits.map((pair) => [pair.id, pair]));
  const shards = shardProjections.map((shard) => {
    const proofNodeIds = shard.proofPairIds.flatMap((id) => {
      const pair = pairById.get(id);
      return [pair.verifierNodeId, pair.rootTestNodeId];
    });
    return {
      ...shard,
      prefixIds: PREFIX_IDS,
      nodeIds: [...PREFIX_IDS, ...proofNodeIds],
      barrierCount: shard.barrierPairIds.length,
      stepCount: PREFIX_IDS.length + proofNodeIds.length,
      proofPairCount: shard.proofPairIds.length,
      planSha256,
      inventorySha256: inventory.inventorySha256,
      parentPlanSha256: PARENT_PLAN_SHA256,
      concurrency: 2,
    };
  });
  const logicalNodeIds = inventory.nodes.map(({ id }) => id);
  const covered = new Set([...shards.flatMap(({ nodeIds }) => nodeIds), ...SUFFIX_IDS]);
  if (covered.size !== 228 || logicalNodeIds.some((id) => !covered.has(id))) {
    fail("SHARDED_QUALITY_GATE_PLAN_DRIFT", "Distributed coverage is not exactly exhaustive.");
  }
  const plan = deepFreeze({
    ...projection,
    planSha256,
    shards,
    logicalNodeIds,
    completedBeforeJoinNodeIds: logicalNodeIds.filter((id) => !SUFFIX_IDS.includes(id)),
    joinNodeIds: [...JOIN_PREPARATION_IDS, ...SUFFIX_IDS],
    stepCount: 228,
    physicalWorkloadCount: 245,
    repeatedPrefixWorkloadCount: 16,
    additionalJoinPreparationCount: 1,
  });
  AUTHENTIC_PLANS.add(plan);
  return plan;
}

/** Returns only one code-owned shard; arbitrary ids and caller-defined partitions fail closed. */
export function getRequiredProofShard(id) {
  if (typeof id !== "string" || !SHARD_IDS.includes(id)) {
    fail("SHARDED_QUALITY_GATE_SHARD_INVALID", "The requested proof shard is not reviewed.");
  }
  return createShardedQualityGatePlan().shards.find((shard) => shard.id === id);
}

/** Validates plan provenance without treating a serialized plan as executable authority. */
export function validateShardedQualityGatePlan(plan) {
  if (!AUTHENTIC_PLANS.has(plan)) {
    fail("SHARDED_QUALITY_GATE_AUTHORITY_UNTRUSTED", "The distributed plan is not code-owned.");
  }
  return plan;
}

/**
 * Constructs the public summary shape, not execution authority. Only the runner may emit this
 * summary after its authentic process-close and closing-guard result passes. The join additionally
 * requires GitHub's successful static dependency status; this JSON alone cannot authorize a gate.
 */
export function createRequiredProofShardSummary(shardId, rawContext) {
  const context = captureContext(rawContext);
  const shard = getRequiredProofShard(shardId);
  return deepFreeze({
    schemaVersion: 1,
    profile: REQUIRED_PROOF_SHARD_SUMMARY_PROFILE,
    authority: "REQUIRED_SHARD",
    status: "PASS",
    shardId,
    ...context,
    planSha256: shard.planSha256,
    inventorySha256: shard.inventorySha256,
    parentPlanSha256: shard.parentPlanSha256,
    stepCount: shard.stepCount,
    observedClosedCount: shard.stepCount,
    proofPairCount: shard.proofPairCount,
    prefixCount: shard.prefixIds.length,
    barrierCount: shard.barrierCount,
    workspaceUnchanged: true,
    buildOutputsUnchanged: true,
    untrackedStateUnchanged: true,
  });
}

function parseSummary(rawSummary) {
  if (
    typeof rawSummary !== "string" ||
    rawSummary.length === 0 ||
    rawSummary.length > MAX_SUMMARY_BYTES ||
    Buffer.byteLength(rawSummary, "utf8") > MAX_SUMMARY_BYTES
  ) {
    fail("SHARDED_QUALITY_GATE_JOIN_REJECTED", "A shard summary is missing or exceeds its bound.");
  }
  let parsed;
  try {
    parsed = JSON.parse(rawSummary);
  } catch {
    fail("SHARDED_QUALITY_GATE_JOIN_REJECTED", "A shard summary is not JSON.");
  }
  if (JSON.stringify(parsed) !== rawSummary) {
    fail(
      "SHARDED_QUALITY_GATE_JOIN_REJECTED",
      "A shard summary is not canonical duplicate-free JSON.",
    );
  }
  return captureRecord(parsed, SUMMARY_KEYS, "The shard summary");
}

/**
 * Validates the exact four dependency summaries without granting REQUIRED hosted authority.
 * Caller-supplied needs and context receive only a TEST handle, even when every field says PASS.
 * A retained shard may name an earlier positive attempt of the same run and exact execution/head
 * revisions; a future attempt, another run, or another revision is rejected. Returned dependency
 * observations are never rehydrated as local child-process close authority.
 */
export function validateRequiredShardJoinNeeds(rawNeeds, rawExpectedContext) {
  const context = captureContext(rawExpectedContext);
  const needs = captureRecord(rawNeeds, ["quality-route", ...SHARD_IDS], "The GitHub dependencies");
  const route = captureRecord(needs["quality-route"], ["result", "outputs"], "The route job");
  const routeOutputs = captureRecord(route.outputs, ["mode"], "The route outputs");
  if (route.result !== "success" || routeOutputs.mode !== "EXHAUSTIVE") {
    fail("SHARDED_QUALITY_GATE_JOIN_REJECTED", "The route did not authorize exhaustive execution.");
  }
  const producerAttempts = {};
  const dependencyReceipts = [];
  for (const shardId of SHARD_IDS) {
    const job = captureRecord(needs[shardId], ["result", "outputs"], "The shard job");
    if (job.result !== "success") {
      fail("SHARDED_QUALITY_GATE_JOIN_REJECTED", "Every required shard must succeed in GitHub.");
    }
    const outputs = captureRecord(job.outputs, ["receipt"], "The shard job outputs");
    const summary = parseSummary(outputs.receipt);
    const producerContext = captureContext(
      Object.fromEntries(CONTEXT_KEYS.map((key) => [key, summary[key]])),
    );
    if (
      producerContext.executionRevision !== context.executionRevision ||
      producerContext.headRevision !== context.headRevision ||
      producerContext.workflowRunId !== context.workflowRunId ||
      Number(producerContext.workflowRunAttempt) > Number(context.workflowRunAttempt)
    ) {
      fail(
        "SHARDED_QUALITY_GATE_JOIN_REJECTED",
        "A shard belongs to a foreign or future execution.",
      );
    }
    const expected = createRequiredProofShardSummary(shardId, producerContext);
    if (
      SUMMARY_KEYS.some((key) => summary[key] !== expected[key]) ||
      JSON.stringify(expected) !== outputs.receipt
    ) {
      fail(
        "SHARDED_QUALITY_GATE_JOIN_REJECTED",
        "A shard summary changed its exact execution contract.",
      );
    }
    producerAttempts[shardId] = producerContext.workflowRunAttempt;
    dependencyReceipts.push({
      shardId,
      producerAttempt: producerContext.workflowRunAttempt,
      summarySha256: sha256(outputs.receipt),
      observedClosedCount: summary.observedClosedCount,
      proofPairCount: summary.proofPairCount,
    });
  }
  const plan = createShardedQualityGatePlan();
  const authority = deepFreeze({
    schemaVersion: 1,
    profile: "desen.ci.required-shard-join-authority.v1",
    authority: "TEST_GITHUB_DEPENDENCIES",
    status: "ADMITTED",
    ...context,
    planSha256: plan.planSha256,
    inventorySha256: plan.inventorySha256,
    parentPlanSha256: plan.parentPlanSha256,
    completedNodeIds: plan.completedBeforeJoinNodeIds,
    logicalWorkloadCount: plan.logicalWorkloadCount,
    proofPairCount: plan.proofPairCount,
    physicalWorkloadCount: plan.physicalWorkloadCount,
    producerAttempts,
    dependencyReceipts,
    localProcessCloseAuthority: false,
    trustedWorkflowContext: false,
  });
  AUTHENTIC_JOIN_AUTHORITIES.add(authority);
  return authority;
}

/** Accepts a genuine TEST or hosted dependency handle, never a cloned JSON claim. */
export function validateRequiredShardJoinAuthority(authority) {
  if (!AUTHENTIC_JOIN_AUTHORITIES.has(authority)) {
    fail(
      "SHARDED_QUALITY_GATE_AUTHORITY_UNTRUSTED",
      "The join dependency handle is not authenticated.",
    );
  }
  return authority;
}

function environmentString(key, fallback = undefined) {
  const descriptor = Object.getOwnPropertyDescriptor(process.env, key);
  if (descriptor === undefined && fallback !== undefined) return fallback;
  if (
    descriptor === undefined ||
    !Object.hasOwn(descriptor, "value") ||
    typeof descriptor.value !== "string"
  ) {
    fail("SHARDED_QUALITY_GATE_HOST_INVALID", "Required hosted workflow context is missing.");
  }
  return descriptor.value;
}

/**
 * Captures REQUIRED join admission exclusively from the final job's ambient GitHub context.
 * The workflow must inject DESEN_REQUIRED_SHARD_JOIN_NEEDS from toJSON(needs). This is an explicit
 * trust in GitHub's workflow environment, not cryptographic authentication of arbitrary JSON or
 * permission for public callers to supply successful dependency claims as function arguments.
 */
export function captureHostedRequiredShardJoinAuthority() {
  if (arguments.length !== 0) {
    fail("SHARDED_QUALITY_GATE_HOST_INVALID", "Hosted join admission accepts no caller arguments.");
  }
  if (
    environmentString("GITHUB_ACTIONS") !== "true" ||
    environmentString("GITHUB_JOB") !== "quality"
  ) {
    fail(
      "SHARDED_QUALITY_GATE_HOST_INVALID",
      "Only the hosted final Quality gate admits REQUIRED dependencies.",
    );
  }
  const context = captureContext({
    executionRevision: environmentString("GITHUB_SHA"),
    headRevision: environmentString("DESEN_REQUIRED_HEAD_REVISION", ""),
    workflowRunId: environmentString("GITHUB_RUN_ID"),
    workflowRunAttempt: environmentString("GITHUB_RUN_ATTEMPT"),
  });
  const rawNeeds = environmentString("DESEN_REQUIRED_SHARD_JOIN_NEEDS");
  if (
    rawNeeds.length === 0 ||
    rawNeeds.length > MAX_NEEDS_BYTES ||
    Buffer.byteLength(rawNeeds, "utf8") > MAX_NEEDS_BYTES
  ) {
    fail("SHARDED_QUALITY_GATE_HOST_INVALID", "Hosted dependency context exceeds its byte bound.");
  }
  let needs;
  try {
    needs = JSON.parse(rawNeeds);
  } catch {
    fail("SHARDED_QUALITY_GATE_HOST_INVALID", "Hosted dependency context is not JSON.");
  }
  const validated = validateRequiredShardJoinNeeds(needs, context);
  const authority = deepFreeze({
    ...validated,
    authority: "GITHUB_SUCCESSFUL_DEPENDENCIES",
    trustedWorkflowContext: true,
  });
  AUTHENTIC_JOIN_AUTHORITIES.add(authority);
  AUTHENTIC_HOSTED_JOIN_AUTHORITIES.add(authority);
  return authority;
}

/** Rejects TEST/raw-validator handles even when their self-reported fields match hosted context. */
export function validateHostedRequiredShardJoinAuthority(authority) {
  if (!AUTHENTIC_HOSTED_JOIN_AUTHORITIES.has(authority)) {
    fail(
      "SHARDED_QUALITY_GATE_AUTHORITY_UNTRUSTED",
      "REQUIRED execution needs ambient hosted dependency authority.",
    );
  }
  return authority;
}
