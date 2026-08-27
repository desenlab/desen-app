import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  createQualityGateSteps as createRetainedSequentialSteps,
  validateQualityGatePlan as validateRetainedSequentialPlan,
} from "../run-ci-quality-gate.mjs";
import {
  EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
  createExhaustiveWorkloadInventory,
  validateExhaustiveWorkloadInventory,
} from "./exhaustive-workload-inventory.mjs";

const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_JSON_STRINGIFY = JSON.stringify;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const SAFE_OBJECT_PROTOTYPE = Object.prototype;
const SAFE_REFLECT_OWN_KEYS = Reflect.ownKeys;
const SAFE_UTIL_IS_PROXY = utilTypes.isProxy;

const EQUIVALENCE_OPTION_KEYS = SAFE_OBJECT_FREEZE(["retainedSteps", "neutralInventory"]);
const RECEIPT_KEYS = SAFE_OBJECT_FREEZE([
  "status",
  "inventorySha256",
  "workspace",
  "workloads",
  "failure",
]);
const WORKSPACE_KEYS = SAFE_OBJECT_FREEZE(["beforeDigest", "afterDigest", "trackedFileCount"]);
const WORKLOAD_RECEIPT_KEYS = SAFE_OBJECT_FREEZE(["id", "status", "observedClose"]);
const FAILURE_KEYS = SAFE_OBJECT_FREEZE(["kind", "workloadId", "signal"]);
const WORKLOAD_STATUSES = SAFE_OBJECT_FREEZE([
  "PASS",
  "FAIL",
  "SKIPPED",
  "NOT_RUN",
  "CANCELLED",
  "TIMED_OUT",
]);
const FAILURE_KINDS = SAFE_OBJECT_FREEZE([
  "INVENTORY",
  "WORKLOAD",
  "WORKSPACE",
  "CANCELLATION",
  "TIMEOUT",
]);
const CLOSED_STATUSES = SAFE_OBJECT_FREEZE(["PASS", "FAIL", "CANCELLED", "TIMED_OUT"]);
const NOT_STARTED_STATUSES = SAFE_OBJECT_FREEZE(["SKIPPED", "NOT_RUN"]);
const SIGNALS = SAFE_OBJECT_FREEZE(["SIGINT", "SIGTERM", "ABORT"]);
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const REQUIRED_WORKLOAD_COUNT = 178;

/** Retained sequential-plan digest used only as an equivalence and rollback anchor. */
export const EXPECTED_RETAINED_PLAN_SHA256 =
  "264117dbe5e03165997673e2065b459d9e383c66d145431c95feee70e90e372d";

/** Digest of all 178 workload ids in their canonical inventory order. */
export const EXPECTED_REQUIRED_WORKLOAD_SET_SHA256 =
  "2636e037e8c0b491a4efc49e965a6700bfcfa18e8a8ae904afeb74ff2de219e2";

/** Error raised when exhaustive inventories or terminal receipts are not equivalent. */
export class RequiredExhaustiveEquivalenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RequiredExhaustiveEquivalenceError";
    this.code = code;
    this.details = SAFE_OBJECT_FREEZE({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new RequiredExhaustiveEquivalenceError(code, message, details);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
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
    fail("REQUIRED_EQUIVALENCE_INPUT_INVALID", label + " must be one inert plain object.");
  }
  const ownKeys = SAFE_REFLECT_OWN_KEYS(value);
  if (
    ownKeys.length !== expectedKeys.length ||
    ownKeys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    fail("REQUIRED_EQUIVALENCE_INPUT_INVALID", label + " fields drifted.", {
      expected: expectedKeys,
      actual: ownKeys,
    });
  }
  const captured = {};
  for (const key of expectedKeys) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail("REQUIRED_EQUIVALENCE_INPUT_INVALID", label + "." + key + " must be inert own data.");
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
    value.length > maximumLength
  ) {
    fail("REQUIRED_EQUIVALENCE_INPUT_INVALID", label + " must be one bounded inert array.");
  }
  const ownKeys = SAFE_REFLECT_OWN_KEYS(value);
  if (ownKeys.length !== value.length + 1 || ownKeys.at(-1) !== "length") {
    fail(
      "REQUIRED_EQUIVALENCE_INPUT_INVALID",
      label + " must not be sparse or carry extra properties.",
    );
  }
  const captured = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, String(index));
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail("REQUIRED_EQUIVALENCE_INPUT_INVALID", label + "[" + index + "] must be inert own data.");
    }
    captured.push(descriptor.value);
  }
  return captured;
}

function exactString(value, label, maximumLength = 256) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximumLength) {
    fail("REQUIRED_EQUIVALENCE_INPUT_INVALID", label + " must be one bounded nonempty string.");
  }
  return value;
}

function nullableString(value, label, maximumLength = 256) {
  return value === null ? null : exactString(value, label, maximumLength);
}

function assertUnique(values, label) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) {
    fail("REQUIRED_EQUIVALENCE_DUPLICATE", label + " contains duplicates.", {
      duplicates: [...new Set(duplicates)],
    });
  }
}

function sha256(value) {
  return createHash("sha256").update(SAFE_JSON_STRINGIFY(value)).digest("hex");
}

function workloadProjection(workloads) {
  return workloads.map(({ id, label, command, args }) => ({
    id,
    label,
    command,
    args: [...args],
  }));
}

function captureEquivalenceOptions(rawOptions) {
  if (rawOptions === undefined) return {};
  if (
    rawOptions === null ||
    typeof rawOptions !== "object" ||
    SAFE_ARRAY_IS_ARRAY(rawOptions) ||
    SAFE_UTIL_IS_PROXY(rawOptions) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(rawOptions) !== SAFE_OBJECT_PROTOTYPE
  ) {
    fail(
      "REQUIRED_EQUIVALENCE_INPUT_INVALID",
      "Equivalence options must be one inert plain object.",
    );
  }
  const ownKeys = SAFE_REFLECT_OWN_KEYS(rawOptions);
  if (ownKeys.some((key) => typeof key !== "string" || !EQUIVALENCE_OPTION_KEYS.includes(key))) {
    fail("REQUIRED_EQUIVALENCE_INPUT_INVALID", "Equivalence options contain unknown fields.");
  }
  const captured = {};
  for (const key of ownKeys) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(rawOptions, key);
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(
        "REQUIRED_EQUIVALENCE_INPUT_INVALID",
        "Equivalence option " + key + " must be inert own data.",
      );
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

/**
 * Proves ordered and exactly-once equality between retained and neutral workload authorities.
 *
 * The adapter is evidence-only. Required execution imports the neutral inventory directly.
 */
export function verifyRequiredExhaustiveInventoryEquivalence(rawOptions) {
  const options = captureEquivalenceOptions(rawOptions);
  const retainedSteps = options.retainedSteps ?? createRetainedSequentialSteps();
  const neutralInventory = validateExhaustiveWorkloadInventory(
    options.neutralInventory ?? createExhaustiveWorkloadInventory(),
  );
  const retainedPlan = validateRetainedSequentialPlan(retainedSteps);
  if (
    retainedPlan.stepCount !== REQUIRED_WORKLOAD_COUNT ||
    retainedPlan.planSha256 !== EXPECTED_RETAINED_PLAN_SHA256
  ) {
    fail("REQUIRED_EQUIVALENCE_RETAINED_PLAN_DRIFT", "The retained plan digest drifted.", {
      expected: EXPECTED_RETAINED_PLAN_SHA256,
      actual: retainedPlan.planSha256,
      stepCount: retainedPlan.stepCount,
    });
  }

  const retainedProjection = workloadProjection(retainedSteps);
  const neutralProjection = workloadProjection(neutralInventory.nodes);
  const retainedIds = retainedProjection.map(({ id }) => id);
  const neutralIds = neutralProjection.map(({ id }) => id);
  assertUnique(retainedIds, "Retained workload ids");
  assertUnique(neutralIds, "Neutral workload ids");
  if (
    retainedProjection.length !== REQUIRED_WORKLOAD_COUNT ||
    neutralProjection.length !== REQUIRED_WORKLOAD_COUNT
  ) {
    fail(
      "REQUIRED_EQUIVALENCE_WORKLOAD_COUNT_DRIFT",
      "The exhaustive workload count is incomplete.",
      {
        retained: retainedProjection.length,
        neutral: neutralProjection.length,
      },
    );
  }

  const retainedSet = [...retainedIds].sort();
  const neutralSet = [...neutralIds].sort();
  if (SAFE_JSON_STRINGIFY(retainedSet) !== SAFE_JSON_STRINGIFY(neutralSet)) {
    fail(
      "REQUIRED_EQUIVALENCE_WORKLOAD_SET_DRIFT",
      "The retained and neutral workload sets differ.",
    );
  }
  if (SAFE_JSON_STRINGIFY(retainedProjection) !== SAFE_JSON_STRINGIFY(neutralProjection)) {
    fail(
      "REQUIRED_EQUIVALENCE_ORDERED_PROJECTION_DRIFT",
      "The exact ordered workload projections differ.",
    );
  }

  const workloadSetSha256 = sha256(neutralIds);
  if (workloadSetSha256 !== EXPECTED_REQUIRED_WORKLOAD_SET_SHA256) {
    fail("REQUIRED_EQUIVALENCE_WORKLOAD_SET_DRIFT", "The canonical workload-id digest drifted.", {
      expected: EXPECTED_REQUIRED_WORKLOAD_SET_SHA256,
      actual: workloadSetSha256,
    });
  }
  if (neutralInventory.inventorySha256 !== EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256) {
    fail("REQUIRED_EQUIVALENCE_INVENTORY_DRIFT", "The neutral inventory digest drifted.", {
      expected: EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
      actual: neutralInventory.inventorySha256,
    });
  }

  return deepFreeze({
    status: "PASS",
    workloadCount: REQUIRED_WORKLOAD_COUNT,
    exactlyOnce: true,
    retainedPlanSha256: retainedPlan.planSha256,
    neutralInventorySha256: neutralInventory.inventorySha256,
    orderedProjectionSha256: sha256(neutralProjection),
    workloadSetSha256,
  });
}

function captureWorkspace(rawWorkspace) {
  const workspace = exactRecord(rawWorkspace, WORKSPACE_KEYS, "Execution workspace");
  workspace.beforeDigest = exactString(workspace.beforeDigest, "workspace.beforeDigest", 64);
  workspace.afterDigest = exactString(workspace.afterDigest, "workspace.afterDigest", 64);
  if (
    !SHA256_PATTERN.test(workspace.beforeDigest) ||
    !SHA256_PATTERN.test(workspace.afterDigest) ||
    !Number.isSafeInteger(workspace.trackedFileCount) ||
    workspace.trackedFileCount < 0 ||
    workspace.trackedFileCount > 16_384
  ) {
    fail("REQUIRED_EQUIVALENCE_WORKSPACE_INVALID", "The execution workspace receipt is invalid.");
  }
  return workspace;
}

function captureWorkloadReceipt(rawReceipt, index) {
  const receipt = exactRecord(rawReceipt, WORKLOAD_RECEIPT_KEYS, "Workload receipt " + index);
  receipt.id = exactString(receipt.id, "Workload receipt " + index + ".id");
  receipt.status = exactString(receipt.status, "Workload receipt " + index + ".status", 32);
  if (!WORKLOAD_STATUSES.includes(receipt.status) || typeof receipt.observedClose !== "boolean") {
    fail(
      "REQUIRED_EQUIVALENCE_WORKLOAD_RECEIPT_INVALID",
      "Workload receipt " + index + " has an unknown status or close state.",
    );
  }
  if (
    (CLOSED_STATUSES.includes(receipt.status) && receipt.observedClose !== true) ||
    (NOT_STARTED_STATUSES.includes(receipt.status) && receipt.observedClose !== false)
  ) {
    fail(
      "REQUIRED_EQUIVALENCE_WORKLOAD_UNCLOSED",
      "Workload receipt " + receipt.id + " has an invalid observed-close state.",
      { status: receipt.status, observedClose: receipt.observedClose },
    );
  }
  return receipt;
}

function captureFailure(rawFailure, canonicalIds) {
  if (rawFailure === null) return null;
  const failure = exactRecord(rawFailure, FAILURE_KEYS, "Execution failure");
  failure.kind = exactString(failure.kind, "failure.kind", 32);
  failure.workloadId = nullableString(failure.workloadId, "failure.workloadId");
  failure.signal = nullableString(failure.signal, "failure.signal", 32);
  if (!FAILURE_KINDS.includes(failure.kind)) {
    fail("REQUIRED_EQUIVALENCE_FAILURE_INVALID", "The failure kind is unknown.", {
      kind: failure.kind,
    });
  }
  if (failure.workloadId !== null && !canonicalIds.includes(failure.workloadId)) {
    fail("REQUIRED_EQUIVALENCE_FAILURE_INVALID", "The failure names an unknown workload.", {
      workloadId: failure.workloadId,
    });
  }
  if (failure.signal !== null && !SIGNALS.includes(failure.signal)) {
    fail("REQUIRED_EQUIVALENCE_FAILURE_INVALID", "The failure signal is unknown.", {
      signal: failure.signal,
    });
  }
  return failure;
}

function assertFailureConsistency(receipt) {
  const byId = new Map(receipt.workloads.map((workload) => [workload.id, workload]));
  const statuses = receipt.workloads.map(({ status }) => status);
  const failure = receipt.failure;
  if (failure.kind === "INVENTORY") {
    if (
      failure.workloadId !== null ||
      failure.signal !== null ||
      statuses.some((status) => status !== "NOT_RUN")
    ) {
      fail(
        "REQUIRED_EQUIVALENCE_FAILURE_INVALID",
        "An inventory failure cannot claim a workload, signal, or started execution.",
      );
    }
    return;
  }
  if (failure.kind === "WORKLOAD") {
    if (
      failure.workloadId === null ||
      failure.signal !== null ||
      byId.get(failure.workloadId)?.status !== "FAIL"
    ) {
      fail(
        "REQUIRED_EQUIVALENCE_FAILURE_INVALID",
        "A workload failure must identify one failed and closed workload.",
      );
    }
    return;
  }
  if (failure.kind === "WORKSPACE") {
    if (
      failure.workloadId !== null ||
      failure.signal !== null ||
      receipt.workspace.beforeDigest === receipt.workspace.afterDigest ||
      statuses.some((status) => status !== "PASS")
    ) {
      fail(
        "REQUIRED_EQUIVALENCE_FAILURE_INVALID",
        "A workspace failure must follow closed successful workloads and carry changed bytes.",
      );
    }
    return;
  }
  if (failure.kind === "CANCELLATION") {
    if (
      failure.signal === null ||
      !statuses.includes("CANCELLED") ||
      (failure.workloadId !== null && byId.get(failure.workloadId)?.status !== "CANCELLED")
    ) {
      fail(
        "REQUIRED_EQUIVALENCE_FAILURE_INVALID",
        "A cancellation failure must retain its signal and a closed cancelled workload.",
      );
    }
    return;
  }
  if (
    failure.kind === "TIMEOUT" &&
    (failure.signal !== null ||
      failure.workloadId === null ||
      byId.get(failure.workloadId)?.status !== "TIMED_OUT")
  ) {
    fail(
      "REQUIRED_EQUIVALENCE_FAILURE_INVALID",
      "A timeout failure must identify one timed-out and closed workload.",
    );
  }
}

/**
 * Validates and canonicalizes one required exhaustive execution receipt.
 *
 * Concurrent completion order and durations are deliberately absent. Every workload id is sorted
 * back to inventory order before terminal authority is calculated.
 */
export function normalizeRequiredExecutionReceipt(rawReceipt) {
  const receipt = exactRecord(rawReceipt, RECEIPT_KEYS, "Required execution receipt");
  receipt.status = exactString(receipt.status, "receipt.status", 16);
  if (!["PASS", "FAIL"].includes(receipt.status)) {
    fail("REQUIRED_EQUIVALENCE_STATUS_INVALID", "The terminal status is unknown.");
  }
  receipt.inventorySha256 = exactString(receipt.inventorySha256, "receipt.inventorySha256", 64);
  if (receipt.inventorySha256 !== EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256) {
    fail(
      "REQUIRED_EQUIVALENCE_INVENTORY_DRIFT",
      "The execution receipt names an unknown inventory.",
      {
        expected: EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
        actual: receipt.inventorySha256,
      },
    );
  }
  receipt.workspace = captureWorkspace(receipt.workspace);
  receipt.workloads = exactArray(
    receipt.workloads,
    "Execution workloads",
    REQUIRED_WORKLOAD_COUNT,
  ).map(captureWorkloadReceipt);

  const canonicalIds = createExhaustiveWorkloadInventory().nodes.map(({ id }) => id);
  const receivedIds = receipt.workloads.map(({ id }) => id);
  assertUnique(receivedIds, "Execution workload ids");
  if (
    receivedIds.length !== REQUIRED_WORKLOAD_COUNT ||
    receivedIds.some((id) => !canonicalIds.includes(id))
  ) {
    fail(
      "REQUIRED_EQUIVALENCE_WORKLOAD_SET_DRIFT",
      "The execution receipt omits or substitutes a required workload.",
      {
        expectedCount: REQUIRED_WORKLOAD_COUNT,
        actualCount: receivedIds.length,
      },
    );
  }
  const receiptById = new Map(receipt.workloads.map((workload) => [workload.id, workload]));
  receipt.workloads = canonicalIds.map((id) => receiptById.get(id));
  receipt.failure = captureFailure(receipt.failure, canonicalIds);

  if (receipt.status === "PASS") {
    if (
      receipt.failure !== null ||
      receipt.workspace.beforeDigest !== receipt.workspace.afterDigest ||
      receipt.workloads.some(
        ({ status, observedClose }) => status !== "PASS" || observedClose !== true,
      )
    ) {
      fail(
        "REQUIRED_EQUIVALENCE_FALSE_PASS",
        "A passing receipt requires all 178 workloads closed with PASS and an unchanged workspace.",
      );
    }
  } else {
    if (receipt.failure === null) {
      fail(
        "REQUIRED_EQUIVALENCE_FAILURE_INVALID",
        "A failing receipt must retain one terminal authority reason.",
      );
    }
    assertFailureConsistency(receipt);
  }

  const workloadSetSha256 = sha256(canonicalIds);
  if (workloadSetSha256 !== EXPECTED_REQUIRED_WORKLOAD_SET_SHA256) {
    fail("REQUIRED_EQUIVALENCE_WORKLOAD_SET_DRIFT", "The required workload-id authority drifted.");
  }
  return deepFreeze({
    schemaVersion: 1,
    status: receipt.status,
    inventorySha256: receipt.inventorySha256,
    workloadSetSha256,
    workspace: receipt.workspace,
    workloads: receipt.workloads,
    failure: receipt.failure,
  });
}

/**
 * Projects a validated receipt to terminal comparison authority.
 *
 * The projection ignores durations and input completion order while retaining exact outcomes,
 * workspace identity, failure category, workload identity, cancellation signal, and timeout.
 */
export function normalizeRequiredTerminalAuthority(rawReceipt) {
  const receipt = normalizeRequiredExecutionReceipt(rawReceipt);
  return deepFreeze({
    status: receipt.status,
    inventorySha256: receipt.inventorySha256,
    workloadSetSha256: receipt.workloadSetSha256,
    workloadOutcomesSha256: sha256(
      receipt.workloads.map(({ id, status, observedClose }) => ({
        id,
        status,
        observedClose,
      })),
    ),
    workspace: {
      beforeDigest: receipt.workspace.beforeDigest,
      afterDigest: receipt.workspace.afterDigest,
      trackedFileCount: receipt.workspace.trackedFileCount,
      unchanged: receipt.workspace.beforeDigest === receipt.workspace.afterDigest,
    },
    failure: receipt.failure,
  });
}

/**
 * Requires two execution receipts to have the same normalized terminal authority.
 */
export function assertRequiredTerminalAuthorityEquivalent(leftReceipt, rightReceipt) {
  const left = normalizeRequiredTerminalAuthority(leftReceipt);
  const right = normalizeRequiredTerminalAuthority(rightReceipt);
  if (SAFE_JSON_STRINGIFY(left) !== SAFE_JSON_STRINGIFY(right)) {
    fail("REQUIRED_EQUIVALENCE_TERMINAL_DRIFT", "The exhaustive terminal authorities differ.", {
      left,
      right,
    });
  }
  return deepFreeze({ status: "EQUIVALENT", authority: left });
}
