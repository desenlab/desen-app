import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, readdir, readlink, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify, isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const LISTENER_GUARD_PATH = path.join(MODULE_DIRECTORY, "no-proof-listener.cjs");
const FILESYSTEM_COMPATIBILITY_PATH = path.join(
  MODULE_DIRECTORY,
  "proof-filesystem-compatibility.cjs",
);
const require = createRequire(import.meta.url);
const filesystemCompatibility = require(FILESYSTEM_COMPATIBILITY_PATH);
const {
  FILESYSTEM_COMPATIBILITY_POLICIES,
  POLICY_BY_STEP_ID: FILESYSTEM_COMPATIBILITY_POLICY_BY_STEP_ID,
  expectedPolicyForStep: filesystemCompatibilityPolicyForStep,
} = filesystemCompatibility;
const DEFAULT_MAX_FILES = 50_000;
const DEFAULT_MAX_BYTES = 536_870_912;
const DEFAULT_GIT_OUTPUT_BYTES = 8_388_608;

/** Stable execution classes owned by the I07-02 shared-state authority. */
export const EXECUTION_CLASSES = Object.freeze({
  GLOBAL_EXCLUSIVE: "GLOBAL_EXCLUSIVE",
  WORKSPACE_OUTPUT_EXCLUSIVE: "WORKSPACE_OUTPUT_EXCLUSIVE",
  PACKAGE_TEST_EXCLUSIVE: "PACKAGE_TEST_EXCLUSIVE",
  PROOF_READ_ONLY: "PROOF_READ_ONLY",
  PROOF_OS_TEMP_ISOLATED: "PROOF_OS_TEMP_ISOLATED",
  PROOF_TRACKED_ALIAS_EXCLUSIVE: "PROOF_TRACKED_ALIAS_EXCLUSIVE",
  PROOF_WORKSPACE_TEMP_EXCLUSIVE: "PROOF_WORKSPACE_TEMP_EXCLUSIVE",
});

/** Exact reviewed proof ids in the I07-02 exhaustive workload universe. */
export const PROOF_IDS = Object.freeze([
  "protocol-snapshot",
  "protocol-traceability",
  "protocol-types",
  "protocol-canonicalization",
  "protocol-diagnostics",
  "protocol-structural-validation",
  "protocol-semantic-foundation",
  "protocol-component-contracts",
  "protocol-interaction-contracts",
  "protocol-binding-contracts",
  "protocol-execution-contracts",
  "protocol-official-suite-parity",
  "protocol-validator-diagnostic-micro-vectors",
  "catalog-manifest-registration",
  "web-react-package-digest",
  "reference-catalog-web-components",
  "reference-catalog-web-form-feedback",
  "reference-tokens-and-synthetic-fixtures",
  "reference-sign-in-fixtures-and-host-binding",
  "reference-catalog-web-parity",
  "reference-catalog-web-capability-artifact",
  "sc-01-a2ui-bridge",
  "sc-01-dtcg-compatibility",
  "runtime-core-host-ports",
  "runtime-core-value-resolution",
  "runtime-core-token-format-resolution",
  "runtime-core-predicate-evaluation",
  "runtime-core-variant-style-evaluation",
  "runtime-core-local-state-identity",
  "runtime-core-repeat-materialization",
  "runtime-core-resource-lifecycle",
  "runtime-core-operation-lifecycle",
  "runtime-core-state-navigation-actions",
  "runtime-core-operation-resource-actions",
  "runtime-core-command-event-actions",
  "runtime-core-action-turns",
  "runtime-core-adapter-bridges",
  "runtime-core-reactive-reevaluation",
  "runtime-core-headless-sign-in",
  "runtime-core-audit-hardening",
  "runtime-react-adapter-registry",
  "runtime-react-resolved-props-slots",
  "runtime-react-resolved-styles",
  "runtime-react-interactions",
  "runtime-react-reconciliation-diagnostics",
  "runtime-react-failure-boundary",
  "reference-host-web-shell",
  "reference-host-web-sign-in",
  "reference-host-web-source-audit",
  "publisher-publish-result",
  "publisher-catalog-resolution",
  "publisher-source-preflight",
  "publisher-capability-preflight",
  "publisher-execution-preflight",
  "publisher-source-preservation",
  "publisher-source-normalization",
  "publisher-catalog-pinning",
  "publisher-bundle-publication",
  "publisher-official-golden",
  "publisher-invalid-source-matrix",
  "control-plane-bundle-store",
]);

/** Proof ids whose root tests make no shared or temporary filesystem writes. */
export const READ_ONLY_ROOT_PROOF_IDS = Object.freeze([
  "protocol-canonicalization",
  "protocol-traceability",
  "publisher-catalog-resolution",
  "runtime-core-action-turns",
  "runtime-core-adapter-bridges",
  "runtime-core-operation-lifecycle",
  "runtime-core-operation-resource-actions",
  "runtime-core-repeat-materialization",
  "runtime-core-resource-lifecycle",
  "runtime-core-state-navigation-actions",
]);

/** The sole proof id whose root test currently requires workspace-scoped temporary writes. */
export const WORKSPACE_TEMP_ROOT_PROOF_IDS = Object.freeze(["reference-host-web-source-audit"]);

/** Exact verifier proof ids whose fresh evidence checks execute bounded Node runtime probes. */
export const CHILD_PROCESS_VERIFIER_PROOF_IDS = Object.freeze([
  "publisher-catalog-pinning",
  "publisher-bundle-publication",
  "publisher-official-golden",
  "publisher-invalid-source-matrix",
  "control-plane-bundle-store",
]);

/** The exact proof whose Vite graph observation loads a reviewed native Rolldown addon. */
export const NATIVE_ADDON_PROOF_IDS = Object.freeze(["reference-host-web-source-audit"]);

/** Exact root-test steps that need bounded Node-permission API compatibility. */
export const FILESYSTEM_COMPATIBILITY_ROOT_STEP_IDS = Object.freeze(
  Object.keys(FILESYSTEM_COMPATIBILITY_POLICY_BY_STEP_ID),
);

/** Exact workspace-target rules admitted by the trusted Node-permission compatibility adapter. */
export const FILESYSTEM_COMPATIBILITY_WORKSPACE_SYMLINK_RULES =
  filesystemCompatibility.WORKSPACE_SYMLINK_RULES_BY_STEP_ID;

/** Closed behavior vocabulary for reviewed workspace-target symlink calls. */
export const FILESYSTEM_COMPATIBILITY_WORKSPACE_SYMLINK_BEHAVIORS =
  filesystemCompatibility.WORKSPACE_SYMLINK_BEHAVIORS;

/** Exact root-test steps whose historical semantics require a real tracked workspace alias. */
export const FILESYSTEM_COMPATIBILITY_TRACKED_ALIAS_STEP_IDS = Object.freeze(
  Object.entries(FILESYSTEM_COMPATIBILITY_WORKSPACE_SYMLINK_RULES)
    .filter(([, rules]) =>
      rules.some(
        ({ behavior }) =>
          behavior === FILESYSTEM_COMPATIBILITY_WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS,
      ),
    )
    .map(([stepId]) => stepId),
);

if (FILESYSTEM_COMPATIBILITY_ROOT_STEP_IDS.length !== 18) {
  throw new Error("The reviewed filesystem compatibility workload set drifted.");
}
if (FILESYSTEM_COMPATIBILITY_TRACKED_ALIAS_STEP_IDS.length !== 10) {
  throw new Error("The reviewed tracked-alias workload set drifted.");
}

const READ_ONLY_ROOT_PROOF_ID_SET = new Set(READ_ONLY_ROOT_PROOF_IDS);
const WORKSPACE_TEMP_ROOT_PROOF_ID_SET = new Set(WORKSPACE_TEMP_ROOT_PROOF_IDS);
const CHILD_PROCESS_VERIFIER_PROOF_ID_SET = new Set(CHILD_PROCESS_VERIFIER_PROOF_IDS);
const NATIVE_ADDON_PROOF_ID_SET = new Set(NATIVE_ADDON_PROOF_IDS);
const FILESYSTEM_COMPATIBILITY_TRACKED_ALIAS_STEP_ID_SET = new Set(
  FILESYSTEM_COMPATIBILITY_TRACKED_ALIAS_STEP_IDS,
);

/** Proof ids whose root tests receive OS-temp authority without a direct workspace-write grant. */
export const OS_TEMP_ROOT_PROOF_IDS = Object.freeze(
  PROOF_IDS.filter(
    (id) => !READ_ONLY_ROOT_PROOF_ID_SET.has(id) && !WORKSPACE_TEMP_ROOT_PROOF_ID_SET.has(id),
  ),
);

const GLOBAL_EXCLUSIVE_STEP_IDS = Object.freeze([
  "orchestrator-contracts",
  "format",
  "lint",
  "structural-validator-artifacts",
  "dependency-boundaries",
  "boundary-fixtures",
]);
const WORKSPACE_OUTPUT_EXCLUSIVE_STEP_IDS = Object.freeze(["workspace-graph"]);
const PACKAGE_TEST_EXCLUSIVE_STEP_IDS = Object.freeze(["package-tests"]);

/** Exact build and Turbo output roots guarded by the shared build-output seal. */
export const BUILD_OUTPUT_ROOTS = Object.freeze([
  ".turbo",
  "apps/control-plane-api/dist",
  "apps/control-plane-api/.turbo",
  "apps/desen-app/dist",
  "apps/desen-app/.turbo",
  "apps/desen-run/dist",
  "apps/desen-run/.turbo",
  "apps/reference-host-web/dist",
  "apps/reference-host-web/.turbo",
  "packages/catalog-sdk/dist",
  "packages/catalog-sdk/.turbo",
  "packages/desen/dist",
  "packages/desen/.turbo",
  "packages/editor-core/dist",
  "packages/editor-core/.turbo",
  "packages/editor-web/dist",
  "packages/editor-web/.turbo",
  "packages/protocol/dist",
  "packages/protocol/.turbo",
  "packages/publisher/dist",
  "packages/publisher/.turbo",
  "packages/reference-catalog-web/dist",
  "packages/reference-catalog-web/.turbo",
  "packages/runtime-core/dist",
  "packages/runtime-core/.turbo",
  "packages/runtime-react/dist",
  "packages/runtime-react/.turbo",
  "packages/runtime-web/dist",
  "packages/runtime-web/.turbo",
  "packages/testkit/dist",
  "packages/testkit/.turbo",
  "packages/validator/dist",
  "packages/validator/.turbo",
]);

const EXECUTION_CLASS_SET = new Set(Object.values(EXECUTION_CLASSES));
const TEMP_POLICIES = Object.freeze({
  NONE: "NONE",
  RUNNER_SCOPED_OS: "RUNNER_SCOPED_OS",
  RUNNER_SCOPED_OS_AND_WORKSPACE: "RUNNER_SCOPED_OS_AND_WORKSPACE",
});
const CHILD_PROCESS_POLICIES = Object.freeze({
  NONE: "NONE",
  VERIFIER_RUNTIME_PROBE: "VERIFIER_RUNTIME_PROBE",
  NODE_TEST_HARNESS: "NODE_TEST_HARNESS",
  NODE_TEST_HARNESS_AND_MKFIFO: "NODE_TEST_HARNESS_AND_MKFIFO",
  TOOLCHAIN_EXCLUSIVE: "TOOLCHAIN_EXCLUSIVE",
});
const NATIVE_ADDON_POLICIES = Object.freeze({
  NONE: "NONE",
  REFERENCE_HOST_WEB_SOURCE_AUDIT: "REFERENCE_HOST_WEB_SOURCE_AUDIT",
});

/** Stable failure raised when shared-state authority cannot be established safely. */
export class SharedStateAuthorityError extends Error {
  /**
   * @param {string} code stable failure code
   * @param {string} message human-readable failure summary
   * @param {Record<string, unknown>} [details] bounded failure context
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "SharedStateAuthorityError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new SharedStateAuthorityError(code, message, details);
}

function frozenArray(values) {
  return Object.freeze([...values]);
}

function createMetadata({
  stepId,
  executionClass,
  workspaceReads = ["."],
  workspaceWrites = [],
  tempPolicy = TEMP_POLICIES.NONE,
  tempKey = null,
  ports = [],
  childProcessPolicy = CHILD_PROCESS_POLICIES.NONE,
  nativeAddonPolicy = NATIVE_ADDON_POLICIES.NONE,
  filesystemCompatibilityPolicy = FILESYSTEM_COMPATIBILITY_POLICIES.NONE,
  barrier = false,
}) {
  return Object.freeze({
    schemaVersion: 2,
    stepId,
    executionClass,
    workspaceReads: frozenArray(workspaceReads),
    workspaceWrites: frozenArray(workspaceWrites),
    tempPolicy,
    tempKey,
    ports: frozenArray(ports),
    childProcessPolicy,
    nativeAddonPolicy,
    filesystemCompatibilityPolicy,
    barrier,
  });
}

const METADATA_BY_STEP_ID = new Map();

for (const stepId of GLOBAL_EXCLUSIVE_STEP_IDS) {
  METADATA_BY_STEP_ID.set(
    stepId,
    createMetadata({
      stepId,
      executionClass: EXECUTION_CLASSES.GLOBAL_EXCLUSIVE,
      tempPolicy:
        stepId === "orchestrator-contracts" ? TEMP_POLICIES.RUNNER_SCOPED_OS : TEMP_POLICIES.NONE,
      tempKey: stepId === "orchestrator-contracts" ? stepId : null,
      childProcessPolicy:
        stepId === "orchestrator-contracts" || stepId === "boundary-fixtures"
          ? CHILD_PROCESS_POLICIES.TOOLCHAIN_EXCLUSIVE
          : CHILD_PROCESS_POLICIES.NONE,
      barrier: true,
    }),
  );
}

for (const stepId of WORKSPACE_OUTPUT_EXCLUSIVE_STEP_IDS) {
  METADATA_BY_STEP_ID.set(
    stepId,
    createMetadata({
      stepId,
      executionClass: EXECUTION_CLASSES.WORKSPACE_OUTPUT_EXCLUSIVE,
      workspaceWrites: ["."],
      childProcessPolicy: CHILD_PROCESS_POLICIES.TOOLCHAIN_EXCLUSIVE,
      barrier: true,
    }),
  );
}

for (const stepId of PACKAGE_TEST_EXCLUSIVE_STEP_IDS) {
  METADATA_BY_STEP_ID.set(
    stepId,
    createMetadata({
      stepId,
      executionClass: EXECUTION_CLASSES.PACKAGE_TEST_EXCLUSIVE,
      workspaceWrites: ["."],
      tempPolicy: TEMP_POLICIES.RUNNER_SCOPED_OS,
      tempKey: stepId,
      childProcessPolicy: CHILD_PROCESS_POLICIES.TOOLCHAIN_EXCLUSIVE,
      barrier: true,
    }),
  );
}

for (const proofId of PROOF_IDS) {
  const verifierStepId = `verify-${proofId}`;
  const verifierUsesRuntimeProbe = CHILD_PROCESS_VERIFIER_PROOF_ID_SET.has(proofId);
  METADATA_BY_STEP_ID.set(
    verifierStepId,
    createMetadata({
      stepId: verifierStepId,
      executionClass: verifierUsesRuntimeProbe
        ? EXECUTION_CLASSES.PROOF_OS_TEMP_ISOLATED
        : EXECUTION_CLASSES.PROOF_READ_ONLY,
      tempPolicy: verifierUsesRuntimeProbe ? TEMP_POLICIES.RUNNER_SCOPED_OS : TEMP_POLICIES.NONE,
      tempKey: verifierUsesRuntimeProbe ? verifierStepId : null,
      childProcessPolicy: verifierUsesRuntimeProbe
        ? CHILD_PROCESS_POLICIES.VERIFIER_RUNTIME_PROBE
        : CHILD_PROCESS_POLICIES.NONE,
      nativeAddonPolicy: NATIVE_ADDON_PROOF_ID_SET.has(proofId)
        ? NATIVE_ADDON_POLICIES.REFERENCE_HOST_WEB_SOURCE_AUDIT
        : NATIVE_ADDON_POLICIES.NONE,
    }),
  );

  const testStepId = `test-${proofId}`;
  if (WORKSPACE_TEMP_ROOT_PROOF_ID_SET.has(proofId)) {
    METADATA_BY_STEP_ID.set(
      testStepId,
      createMetadata({
        stepId: testStepId,
        executionClass: EXECUTION_CLASSES.PROOF_WORKSPACE_TEMP_EXCLUSIVE,
        workspaceWrites: ["."],
        tempPolicy: TEMP_POLICIES.RUNNER_SCOPED_OS_AND_WORKSPACE,
        tempKey: testStepId,
        childProcessPolicy: CHILD_PROCESS_POLICIES.NODE_TEST_HARNESS_AND_MKFIFO,
        nativeAddonPolicy: NATIVE_ADDON_POLICIES.REFERENCE_HOST_WEB_SOURCE_AUDIT,
        barrier: true,
      }),
    );
  } else {
    const readOnly = READ_ONLY_ROOT_PROOF_ID_SET.has(proofId);
    const trackedAliasExclusive =
      FILESYSTEM_COMPATIBILITY_TRACKED_ALIAS_STEP_ID_SET.has(testStepId);
    const trackedAliasWorkspaceWrites = trackedAliasExclusive
      ? Object.freeze([
          ...new Set(
            FILESYSTEM_COMPATIBILITY_WORKSPACE_SYMLINK_RULES[testStepId]
              .filter(
                ({ behavior }) =>
                  behavior === FILESYSTEM_COMPATIBILITY_WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS,
              )
              .map(({ relativeTarget }) => relativeTarget),
          ),
        ])
      : Object.freeze([]);
    METADATA_BY_STEP_ID.set(
      testStepId,
      createMetadata({
        stepId: testStepId,
        executionClass: readOnly
          ? EXECUTION_CLASSES.PROOF_READ_ONLY
          : trackedAliasExclusive
            ? EXECUTION_CLASSES.PROOF_TRACKED_ALIAS_EXCLUSIVE
            : EXECUTION_CLASSES.PROOF_OS_TEMP_ISOLATED,
        workspaceWrites: trackedAliasWorkspaceWrites,
        tempPolicy: TEMP_POLICIES.RUNNER_SCOPED_OS,
        tempKey: testStepId,
        childProcessPolicy: CHILD_PROCESS_POLICIES.NODE_TEST_HARNESS,
        filesystemCompatibilityPolicy: filesystemCompatibilityPolicyForStep(testStepId),
        barrier: trackedAliasExclusive,
      }),
    );
  }
}

if (METADATA_BY_STEP_ID.size !== 130) {
  fail("SHARED_STATE_INTERNAL_INVALID", "Shared-state authority does not own exactly 130 steps.", {
    actual: METADATA_BY_STEP_ID.size,
  });
}

function exactOwnDataKeys(value, expectedKeys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} must be a plain object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} has an unsupported prototype.`);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} contains symbol-owned state.`);
  }
  const actual = [...keys].sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} fields drifted.`, { expected, actual });
  }
  for (const key of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) {
      fail("SHARED_STATE_METADATA_INVALID", `${label}.${key} is accessor-backed.`);
    }
  }
}

function validateRelativeResourcePath(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > 256) {
    fail("SHARED_STATE_PATH_INVALID", `${label} is not a bounded relative path.`);
  }
  if (
    value.includes("\0") ||
    value.includes("\\") ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value.split("/").includes("..")
  ) {
    fail("SHARED_STATE_PATH_INVALID", `${label} is unsafe.`, { value });
  }
}

function validateStringArray(value, label, validator = undefined) {
  if (!Array.isArray(value) || value.length > 64) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} must be a bounded array.`);
  }
  const seen = new Set();
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string") {
      fail("SHARED_STATE_METADATA_INVALID", `${label}[${index}] is not inert string data.`);
    }
    validator?.(descriptor.value, `${label}[${index}]`);
    if (seen.has(descriptor.value)) {
      fail("SHARED_STATE_METADATA_INVALID", `${label} contains a duplicate.`, {
        value: descriptor.value,
      });
    }
    seen.add(descriptor.value);
  }
}

function validateMetadataShape(metadata, label = "Shared-state metadata") {
  exactOwnDataKeys(
    metadata,
    [
      "schemaVersion",
      "stepId",
      "executionClass",
      "workspaceReads",
      "workspaceWrites",
      "tempPolicy",
      "tempKey",
      "ports",
      "childProcessPolicy",
      "nativeAddonPolicy",
      "filesystemCompatibilityPolicy",
      "barrier",
    ],
    label,
  );
  if (metadata.schemaVersion !== 2) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} has an unknown schema version.`);
  }
  if (typeof metadata.stepId !== "string" || metadata.stepId.length === 0) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} has no step id.`);
  }
  if (!EXECUTION_CLASS_SET.has(metadata.executionClass)) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} has an unknown execution class.`);
  }
  validateStringArray(
    metadata.workspaceReads,
    `${label}.workspaceReads`,
    validateRelativeResourcePath,
  );
  validateStringArray(
    metadata.workspaceWrites,
    `${label}.workspaceWrites`,
    validateRelativeResourcePath,
  );
  if (!Object.values(TEMP_POLICIES).includes(metadata.tempPolicy)) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} has an unknown temp policy.`);
  }
  if (
    metadata.tempKey !== null &&
    (typeof metadata.tempKey !== "string" || metadata.tempKey === "")
  ) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} has an invalid temp key.`);
  }
  if (metadata.tempPolicy === TEMP_POLICIES.NONE && metadata.tempKey !== null) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} assigns a temp key without temp authority.`);
  }
  if (metadata.tempPolicy !== TEMP_POLICIES.NONE && metadata.tempKey === null) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} omits its isolated temp key.`);
  }
  if (!Array.isArray(metadata.ports) || metadata.ports.length > 32) {
    fail("SHARED_STATE_METADATA_INVALID", `${label}.ports must be a bounded array.`);
  }
  const ports = new Set();
  for (let index = 0; index < metadata.ports.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(metadata.ports, String(index));
    const port = descriptor?.value;
    if (
      !descriptor ||
      !("value" in descriptor) ||
      !Number.isSafeInteger(port) ||
      port < 1 ||
      port > 65_535
    ) {
      fail("SHARED_STATE_METADATA_INVALID", `${label}.ports[${index}] is invalid.`);
    }
    if (ports.has(port)) {
      fail("SHARED_STATE_METADATA_INVALID", `${label}.ports contains a duplicate.`, { port });
    }
    ports.add(port);
  }
  if (!Object.values(CHILD_PROCESS_POLICIES).includes(metadata.childProcessPolicy)) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} has an unknown child-process policy.`);
  }
  if (!Object.values(NATIVE_ADDON_POLICIES).includes(metadata.nativeAddonPolicy)) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} has an unknown native-addon policy.`);
  }
  if (
    !Object.values(FILESYSTEM_COMPATIBILITY_POLICIES).includes(
      metadata.filesystemCompatibilityPolicy,
    )
  ) {
    fail(
      "SHARED_STATE_METADATA_INVALID",
      `${label} has an unknown filesystem compatibility policy.`,
    );
  }
  if (
    metadata.filesystemCompatibilityPolicy !== filesystemCompatibilityPolicyForStep(metadata.stepId)
  ) {
    fail("SHARED_STATE_METADATA_INVALID", `${label} has unauthorized filesystem compatibility.`);
  }
  if (typeof metadata.barrier !== "boolean") {
    fail("SHARED_STATE_METADATA_INVALID", `${label}.barrier must be boolean.`);
  }
  return metadata;
}

function stepIdFromWorkload(workloadOrStepId) {
  if (typeof workloadOrStepId === "string") {
    return workloadOrStepId;
  }
  if (workloadOrStepId === null || typeof workloadOrStepId !== "object") {
    fail("SHARED_STATE_WORKLOAD_UNKNOWN", "A workload id is required.");
  }
  const descriptor = Object.getOwnPropertyDescriptor(workloadOrStepId, "id");
  if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string") {
    fail("SHARED_STATE_WORKLOAD_UNKNOWN", "The workload id must be inert string data.");
  }
  return descriptor.value;
}

/**
 * Returns the exact code-owned shared-state classification for a reviewed workload.
 *
 * @param {string | {id: string}} workloadOrStepId reviewed step or its stable id
 */
export function classifyWorkloadStateMetadata(workloadOrStepId) {
  const stepId = stepIdFromWorkload(workloadOrStepId);
  const metadata = METADATA_BY_STEP_ID.get(stepId);
  if (!metadata) {
    fail("SHARED_STATE_WORKLOAD_UNKNOWN", "The workload has no shared-state owner.", { stepId });
  }
  return metadata;
}

/**
 * Authenticates caller-supplied metadata against the exact code-owned workload classification.
 *
 * @param {string | {id: string}} workloadOrStepId reviewed step or its stable id
 * @param {unknown} candidate untrusted metadata candidate
 */
export function validateWorkloadStateMetadata(workloadOrStepId, candidate) {
  const expected = classifyWorkloadStateMetadata(workloadOrStepId);
  validateMetadataShape(candidate);
  if (!isDeepStrictEqual(candidate, expected)) {
    fail("SHARED_STATE_METADATA_DRIFT", "Workload shared-state metadata drifted.", {
      stepId: expected.stepId,
    });
  }
  return expected;
}

function resourcesOverlap(left, right) {
  return (
    left === "." ||
    right === "." ||
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  );
}

function conflictingPath(left, right) {
  for (const leftPath of left) {
    for (const rightPath of right) {
      if (resourcesOverlap(leftPath, rightPath)) return [leftPath, rightPath];
    }
  }
  return undefined;
}

/**
 * Rejects a concurrent workload group unless every declared resource is pairwise compatible.
 *
 * @param {ReadonlyArray<unknown>} candidates validated or synthetic metadata records
 * @param {{concurrency?: number}} [options] fixed scheduler bound
 */
export function assertConcurrentWorkloadsSafe(candidates, { concurrency = 2 } = {}) {
  if (!Number.isSafeInteger(concurrency) || concurrency !== 2) {
    fail("SHARED_STATE_CONCURRENCY_INVALID", "I07-02 concurrency must remain exactly two.", {
      concurrency,
    });
  }
  if (!Array.isArray(candidates) || candidates.length === 0 || candidates.length > concurrency) {
    fail("SHARED_STATE_CONCURRENCY_INVALID", "Concurrent workload group is empty or too wide.");
  }
  const metadata = candidates.map((candidate, index) =>
    validateMetadataShape(candidate, `Concurrent metadata ${index}`),
  );
  const ids = metadata.map(({ stepId }) => stepId);
  if (new Set(ids).size !== ids.length) {
    fail("SHARED_STATE_CONFLICT", "Concurrent workload group duplicates a step id.", { ids });
  }
  if (metadata.length > 1 && metadata.some(({ barrier }) => barrier)) {
    fail("SHARED_STATE_BARRIER_REQUIRED", "An exclusive workload requires a drained scheduler.", {
      ids,
    });
  }

  for (let leftIndex = 0; leftIndex < metadata.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < metadata.length; rightIndex += 1) {
      const left = metadata[leftIndex];
      const right = metadata[rightIndex];
      const writeWrite = conflictingPath(left.workspaceWrites, right.workspaceWrites);
      const leftWriteRead = conflictingPath(left.workspaceWrites, right.workspaceReads);
      const rightWriteRead = conflictingPath(right.workspaceWrites, left.workspaceReads);
      if (writeWrite || leftWriteRead || rightWriteRead) {
        fail(
          "SHARED_STATE_PATH_CONFLICT",
          "Concurrent workloads have overlapping workspace state.",
          {
            left: left.stepId,
            right: right.stepId,
            paths: writeWrite ?? leftWriteRead ?? rightWriteRead,
          },
        );
      }
      if (left.tempKey !== null && left.tempKey === right.tempKey) {
        fail("SHARED_STATE_TEMP_CONFLICT", "Concurrent workloads share a temp authority.", {
          left: left.stepId,
          right: right.stepId,
          tempKey: left.tempKey,
        });
      }
      const sharedPort = left.ports.find((port) => right.ports.includes(port));
      if (sharedPort !== undefined) {
        fail("SHARED_STATE_PORT_CONFLICT", "Concurrent workloads share a fixed port.", {
          left: left.stepId,
          right: right.stepId,
          port: sharedPort,
        });
      }
    }
  }
  return Object.freeze({ concurrency, stepIds: frozenArray(ids) });
}

/**
 * Returns the two-step aggregate classification for one reviewed proof pair.
 *
 * @param {string} proofId exact proof id
 */
export function classifyProofPairState(proofId) {
  if (!PROOF_IDS.includes(proofId)) {
    fail("SHARED_STATE_WORKLOAD_UNKNOWN", "The proof pair has no shared-state owner.", { proofId });
  }
  const verifier = classifyWorkloadStateMetadata(`verify-${proofId}`);
  const rootTest = classifyWorkloadStateMetadata(`test-${proofId}`);
  return Object.freeze({
    proofId,
    barrier: rootTest.barrier,
    verifier,
    rootTest,
  });
}

/**
 * Proves that two complete proof pairs may overlap under the fixed concurrency-two policy.
 *
 * @param {string} leftProofId first exact proof id
 * @param {string} rightProofId second exact proof id
 */
export function assertProofPairsCanRunConcurrently(leftProofId, rightProofId) {
  const left = classifyProofPairState(leftProofId);
  const right = classifyProofPairState(rightProofId);
  if (left.barrier || right.barrier) {
    fail("SHARED_STATE_BARRIER_REQUIRED", "A proof pair requires an exclusive scheduler barrier.", {
      left: leftProofId,
      right: rightProofId,
    });
  }
  assertConcurrentWorkloadsSafe([left.verifier, right.verifier]);
  assertConcurrentWorkloadsSafe([left.verifier, right.rootTest]);
  assertConcurrentWorkloadsSafe([left.rootTest, right.verifier]);
  assertConcurrentWorkloadsSafe([left.rootTest, right.rootTest]);
  return Object.freeze({ concurrency: 2, proofIds: frozenArray([leftProofId, rightProofId]) });
}

async function canonicalDirectory(directory, label) {
  if (typeof directory !== "string" || directory.length === 0 || directory.includes("\0")) {
    fail("SHARED_STATE_PATH_INVALID", `${label} is invalid.`);
  }
  const resolved = path.resolve(directory);
  const entry = await lstat(resolved, { bigint: true }).catch((error) => {
    fail("SHARED_STATE_PATH_UNSAFE", `${label} cannot be authenticated.`, {
      cause: String(error),
    });
  });
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    fail("SHARED_STATE_PATH_UNSAFE", `${label} must be a real directory.`);
  }
  const canonical = await realpath(resolved);
  const darwinSystemVarAlias =
    process.platform === "darwin" &&
    (resolved === "/var" || resolved.startsWith("/var/")) &&
    canonical === `/private${resolved}`;
  if (canonical !== resolved && !darwinSystemVarAlias) {
    fail("SHARED_STATE_PATH_UNSAFE", `${label} must not traverse a symlink or alias.`, {
      resolved,
      canonical,
    });
  }
  return Object.freeze({
    path: canonical,
    permissionPaths: frozenArray(darwinSystemVarAlias ? [resolved, canonical] : [canonical]),
    dev: entry.dev,
    ino: entry.ino,
  });
}

async function authenticateFilesystemCompatibilityPath(workspaceRoot) {
  const candidatePath = path.join(workspaceRoot, "scripts/ci/proof-filesystem-compatibility.cjs");
  const candidateEntry = await lstat(candidatePath, { bigint: true }).catch((error) => {
    fail(
      "SHARED_STATE_COMPATIBILITY_PRELOAD_INVALID",
      "The workspace filesystem compatibility preload is missing.",
      { cause: String(error) },
    );
  });
  if (
    !candidateEntry.isFile() ||
    candidateEntry.isSymbolicLink() ||
    candidateEntry.size < 1n ||
    candidateEntry.size > 1_048_576n ||
    (await realpath(candidatePath)) !== candidatePath
  ) {
    fail(
      "SHARED_STATE_COMPATIBILITY_PRELOAD_INVALID",
      "The workspace filesystem compatibility preload is unsafe.",
    );
  }
  if (candidatePath !== FILESYSTEM_COMPATIBILITY_PATH) {
    const [authorityBytes, candidateBytes] = await Promise.all([
      readFile(FILESYSTEM_COMPATIBILITY_PATH),
      readFile(candidatePath),
    ]);
    const authoritySha256 = createHash("sha256").update(authorityBytes).digest("hex");
    const candidateSha256 = createHash("sha256").update(candidateBytes).digest("hex");
    if (candidateSha256 !== authoritySha256) {
      fail(
        "SHARED_STATE_COMPATIBILITY_PRELOAD_INVALID",
        "The workspace filesystem compatibility preload differs from code-owned authority.",
      );
    }
  }
  return candidatePath;
}

function quoteNodeOption(token) {
  if (typeof token !== "string" || token.length === 0 || /[\0\r\n]/u.test(token)) {
    fail("SHARED_STATE_NODE_OPTIONS_INVALID", "A generated Node option is unsafe.");
  }
  return /[\s"\\]/u.test(token) ? JSON.stringify(token) : token;
}

function proofWorkloadKind(stepId) {
  if (stepId.startsWith("verify-")) return "verifier";
  if (stepId.startsWith("test-")) return "root-test";
  fail("SHARED_STATE_WORKLOAD_UNKNOWN", "Only proof workloads receive proof isolation.", {
    stepId,
  });
}

function safeEnvironment(baseEnvironment) {
  if (
    baseEnvironment === null ||
    typeof baseEnvironment !== "object" ||
    Array.isArray(baseEnvironment)
  ) {
    fail("SHARED_STATE_ENVIRONMENT_INVALID", "The base environment is invalid.");
  }
  const environment = {};
  for (const key of Object.keys(baseEnvironment)) {
    const value = baseEnvironment[key];
    if (typeof value !== "string") continue;
    environment[key] = value;
  }
  if (environment.NODE_OPTIONS && environment.NODE_OPTIONS.trim() !== "") {
    fail(
      "SHARED_STATE_ENVIRONMENT_INVALID",
      "Proof isolation rejects inherited NODE_OPTIONS authority.",
    );
  }
  return environment;
}

/**
 * Creates a runner-owned proof environment without changing the reviewed command or argument vector.
 *
 * @param {{
 *   workspaceRoot: string,
 *   workload: {id: string, command?: string, args?: readonly string[]} | string,
 *   baseEnvironment?: Record<string, string | undefined>,
 *   tempBaseDirectory?: string
 * }} input proof isolation input
 */
export async function createProofStepIsolationContext({
  workspaceRoot,
  workload,
  baseEnvironment = process.env,
  tempBaseDirectory = tmpdir(),
}) {
  const metadata = classifyWorkloadStateMetadata(workload);
  proofWorkloadKind(metadata.stepId);
  const workspace = await canonicalDirectory(workspaceRoot, "Workspace root");
  const filesystemCompatibilityPath =
    metadata.filesystemCompatibilityPolicy === FILESYSTEM_COMPATIBILITY_POLICIES.NONE
      ? undefined
      : await authenticateFilesystemCompatibilityPath(workspace.path);
  const tempBase = await canonicalDirectory(tempBaseDirectory, "Temp base directory");
  const createdTemp = await mkdtemp(path.join(tempBase.path, `desen-ci-${metadata.stepId}-`));
  const temp = await canonicalDirectory(createdTemp, "Runner-owned step temp root");
  const environment = safeEnvironment(baseEnvironment);
  environment.TMPDIR = temp.path;
  environment.TMP = temp.path;
  environment.TEMP = temp.path;
  environment.DESEN_CI_STEP_ID = metadata.stepId;

  const nodeOptions = [
    "--permission",
    ...workspace.permissionPaths.map((allowedPath) => `--allow-fs-read=${allowedPath}`),
    ...temp.permissionPaths.map((allowedPath) => `--allow-fs-read=${allowedPath}`),
    `--allow-fs-read=${LISTENER_GUARD_PATH}`,
    `--require=${LISTENER_GUARD_PATH}`,
  ];
  if (metadata.filesystemCompatibilityPolicy !== FILESYSTEM_COMPATIBILITY_POLICIES.NONE) {
    environment.DESEN_CI_FILESYSTEM_COMPATIBILITY = metadata.filesystemCompatibilityPolicy;
    environment.DESEN_CI_WORKSPACE_ROOT = workspace.path;
    nodeOptions.push(
      `--allow-fs-read=${filesystemCompatibilityPath}`,
      `--require=${filesystemCompatibilityPath}`,
    );
  } else {
    delete environment.DESEN_CI_FILESYSTEM_COMPATIBILITY;
    delete environment.DESEN_CI_WORKSPACE_ROOT;
  }
  if (metadata.tempPolicy !== TEMP_POLICIES.NONE) {
    nodeOptions.push(
      ...temp.permissionPaths.map((allowedPath) => `--allow-fs-write=${allowedPath}`),
    );
  }
  let suppressSecurityWarning = false;
  if (metadata.childProcessPolicy !== CHILD_PROCESS_POLICIES.NONE) {
    nodeOptions.push("--allow-child-process");
    suppressSecurityWarning = true;
  }
  if (metadata.nativeAddonPolicy !== NATIVE_ADDON_POLICIES.NONE) {
    nodeOptions.push("--allow-addons");
    suppressSecurityWarning = true;
  }
  if (suppressSecurityWarning) {
    nodeOptions.push("--disable-warning=SecurityWarning");
  }
  if (metadata.executionClass === EXECUTION_CLASSES.PROOF_WORKSPACE_TEMP_EXCLUSIVE) {
    nodeOptions.push(
      ...workspace.permissionPaths.map((allowedPath) => `--allow-fs-write=${allowedPath}`),
    );
    environment.DESEN_CI_WORKSPACE_TEMP_ROOT = workspace.path;
  }
  environment.NODE_OPTIONS = nodeOptions.map(quoteNodeOption).join(" ");

  const workloadRecord = typeof workload === "string" ? undefined : workload;
  const originalCommand = workloadRecord?.command;
  const originalArgs = workloadRecord?.args;
  let disposed = false;

  const dispose = async () => {
    if (disposed) return;
    const current = await lstat(temp.path, { bigint: true }).catch((error) =>
      error?.code === "ENOENT" ? undefined : Promise.reject(error),
    );
    if (current) {
      if (
        !current.isDirectory() ||
        current.isSymbolicLink() ||
        current.dev !== temp.dev ||
        current.ino !== temp.ino
      ) {
        fail(
          "SHARED_STATE_TEMP_IDENTITY_DRIFT",
          "Runner-owned temp identity changed before cleanup.",
          { stepId: metadata.stepId },
        );
      }
      await rm(temp.path, { recursive: true, force: false });
    }
    disposed = true;
  };

  return Object.freeze({
    metadata,
    command: originalCommand,
    args: originalArgs,
    env: Object.freeze(environment),
    tempRoot: temp.path,
    dispose,
  });
}

function updateFramedHash(hash, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  hash.update(`${bytes.byteLength}:`);
  hash.update(bytes);
  hash.update("\0");
}

async function readStableRegularFile(filePath, limits, label) {
  const before = await lstat(filePath, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
    fail("SHARED_STATE_SNAPSHOT_UNSAFE", `${label} is not a regular file.`, { filePath });
  }
  if (before.size > BigInt(limits.remainingBytes)) {
    fail("SHARED_STATE_SNAPSHOT_LIMIT", `${label} exceeds the snapshot byte budget.`);
  }
  const bytes = await readFile(filePath);
  const after = await lstat(filePath, { bigint: true });
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeNs !== after.mtimeNs ||
    before.ctimeNs !== after.ctimeNs
  ) {
    fail("SHARED_STATE_SNAPSHOT_RACE", `${label} changed while it was read.`, { filePath });
  }
  limits.remainingBytes -= bytes.byteLength;
  limits.fileCount += 1;
  if (limits.fileCount > limits.maxFiles) {
    fail("SHARED_STATE_SNAPSHOT_LIMIT", `${label} exceeds the snapshot file budget.`);
  }
  return Object.freeze({ bytes, mode: Number(before.mode & 0o777n) });
}

async function walkOutputRoot(workspaceRoot, relativeRoot, hash, limits) {
  validateRelativeResourcePath(relativeRoot, "Build-output root");
  const absoluteRoot = path.join(workspaceRoot, ...relativeRoot.split("/"));
  const rootEntry = await lstat(absoluteRoot, { bigint: true }).catch((error) =>
    error?.code === "ENOENT" ? undefined : Promise.reject(error),
  );
  updateFramedHash(hash, relativeRoot);
  if (!rootEntry) {
    updateFramedHash(hash, "missing");
    return;
  }
  if (!rootEntry.isDirectory() || rootEntry.isSymbolicLink()) {
    fail("SHARED_STATE_SNAPSHOT_UNSAFE", "Build-output root is not a real directory.", {
      relativeRoot,
    });
  }
  updateFramedHash(hash, "directory");

  const walk = async (absoluteDirectory, relativeDirectory) => {
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const absolutePath = path.join(absoluteDirectory, entry.name);
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      const stats = await lstat(absolutePath, { bigint: true });
      if (stats.isSymbolicLink()) {
        fail("SHARED_STATE_SNAPSHOT_UNSAFE", "Build output contains a symlink.", {
          relativePath,
        });
      }
      updateFramedHash(hash, relativePath);
      if (stats.isDirectory()) {
        updateFramedHash(hash, "directory");
        await walk(absolutePath, relativePath);
      } else if (stats.isFile()) {
        const stable = await readStableRegularFile(absolutePath, limits, "Build output");
        updateFramedHash(hash, "file");
        updateFramedHash(hash, stable.mode);
        updateFramedHash(hash, stable.bytes);
      } else {
        fail("SHARED_STATE_SNAPSHOT_UNSAFE", "Build output contains a special file.", {
          relativePath,
        });
      }
    }
  };
  await walk(absoluteRoot, relativeRoot);
}

/**
 * Hashes every reviewed app/package dist and Turbo output root with bounded no-follow reads.
 *
 * @param {string} workspaceRoot canonical workspace root
 * @param {{outputRoots?: readonly string[], maxFiles?: number, maxBytes?: number}} [options] bounded test injection
 */
export async function snapshotBuildOutputs(
  workspaceRoot,
  {
    outputRoots = BUILD_OUTPUT_ROOTS,
    maxFiles = DEFAULT_MAX_FILES,
    maxBytes = DEFAULT_MAX_BYTES,
  } = {},
) {
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1 || maxFiles > DEFAULT_MAX_FILES) {
    fail("SHARED_STATE_SNAPSHOT_LIMIT", "Build-output file budget is invalid.");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > DEFAULT_MAX_BYTES) {
    fail("SHARED_STATE_SNAPSHOT_LIMIT", "Build-output byte budget is invalid.");
  }
  validateStringArray(outputRoots, "Build-output roots", validateRelativeResourcePath);
  const workspace = await canonicalDirectory(workspaceRoot, "Workspace root");
  const hash = createHash("sha256");
  const limits = { maxFiles, fileCount: 0, remainingBytes: maxBytes };
  updateFramedHash(hash, "desen.ci.build-output-seal.v1");
  for (const relativeRoot of outputRoots) {
    await walkOutputRoot(workspace.path, relativeRoot, hash, limits);
  }
  return Object.freeze({
    schemaVersion: 1,
    profile: "desen.ci.build-output-seal.v1",
    digest: hash.digest("hex"),
    rootCount: outputRoots.length,
    fileCount: limits.fileCount,
    byteCount: maxBytes - limits.remainingBytes,
  });
}

/**
 * Rejects any build-output byte, path, mode, presence, or count drift across the proof phase.
 *
 * @param {unknown} before pre-proof seal
 * @param {unknown} after post-proof seal
 */
export function assertBuildOutputsUnchanged(before, after) {
  if (!isDeepStrictEqual(before, after)) {
    fail("SHARED_STATE_BUILD_OUTPUT_DRIFT", "Build outputs changed during proof execution.", {
      before,
      after,
    });
  }
}

async function gitUntrackedPaths(workspaceRoot, maxOutputBytes) {
  let result;
  try {
    result = await execFileAsync(
      "git",
      ["ls-files", "--others", "--exclude-standard", "-z", "--"],
      {
        cwd: workspaceRoot,
        encoding: null,
        maxBuffer: maxOutputBytes,
      },
    );
  } catch (error) {
    fail("SHARED_STATE_UNTRACKED_GIT_FAILED", "Git could not enumerate untracked state.", {
      cause: String(error),
    });
  }
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout);
  if (stdout.byteLength >= maxOutputBytes) {
    fail("SHARED_STATE_SNAPSHOT_LIMIT", "Untracked path inventory reached its output budget.");
  }
  const text = stdout.toString("utf8");
  if (text.includes("\uFFFD")) {
    fail("SHARED_STATE_SNAPSHOT_UNSAFE", "Untracked path inventory is not valid UTF-8.");
  }
  return text.split("\0").filter(Boolean);
}

/**
 * Hashes every non-ignored untracked file and symlink without trusting ignored build output.
 *
 * @param {string} workspaceRoot canonical Git workspace root
 * @param {{maxFiles?: number, maxBytes?: number, maxGitOutputBytes?: number}} [options] bounded limits
 */
export async function snapshotNonIgnoredUntrackedState(
  workspaceRoot,
  {
    maxFiles = DEFAULT_MAX_FILES,
    maxBytes = DEFAULT_MAX_BYTES,
    maxGitOutputBytes = DEFAULT_GIT_OUTPUT_BYTES,
  } = {},
) {
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1 || maxFiles > DEFAULT_MAX_FILES) {
    fail("SHARED_STATE_SNAPSHOT_LIMIT", "Untracked file budget is invalid.");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > DEFAULT_MAX_BYTES) {
    fail("SHARED_STATE_SNAPSHOT_LIMIT", "Untracked byte budget is invalid.");
  }
  if (
    !Number.isSafeInteger(maxGitOutputBytes) ||
    maxGitOutputBytes < 1 ||
    maxGitOutputBytes > DEFAULT_GIT_OUTPUT_BYTES
  ) {
    fail("SHARED_STATE_SNAPSHOT_LIMIT", "Git output budget is invalid.");
  }
  const workspace = await canonicalDirectory(workspaceRoot, "Workspace root");
  const paths = await gitUntrackedPaths(workspace.path, maxGitOutputBytes);
  if (paths.length > maxFiles || new Set(paths).size !== paths.length) {
    fail("SHARED_STATE_SNAPSHOT_LIMIT", "Untracked path inventory is duplicated or too large.");
  }
  const sorted = [...paths].sort();
  const hash = createHash("sha256");
  const limits = { maxFiles, fileCount: 0, remainingBytes: maxBytes };
  updateFramedHash(hash, "desen.ci.nonignored-untracked.v1");
  for (const relativePath of sorted) {
    validateRelativeResourcePath(relativePath, "Untracked path");
    const absolutePath = path.join(workspace.path, ...relativePath.split("/"));
    const entry = await lstat(absolutePath, { bigint: true });
    updateFramedHash(hash, relativePath);
    if (entry.isSymbolicLink()) {
      updateFramedHash(hash, "symlink");
      updateFramedHash(hash, await readlink(absolutePath));
      limits.fileCount += 1;
    } else if (entry.isFile()) {
      const stable = await readStableRegularFile(absolutePath, limits, "Untracked file");
      updateFramedHash(hash, "file");
      updateFramedHash(hash, stable.mode);
      updateFramedHash(hash, stable.bytes);
    } else {
      fail("SHARED_STATE_SNAPSHOT_UNSAFE", "Untracked state contains a special entry.", {
        relativePath,
      });
    }
    if (limits.fileCount > maxFiles) {
      fail("SHARED_STATE_SNAPSHOT_LIMIT", "Untracked state exceeds its file budget.");
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    profile: "desen.ci.nonignored-untracked.v1",
    digest: hash.digest("hex"),
    entryCount: limits.fileCount,
    byteCount: maxBytes - limits.remainingBytes,
  });
}

/**
 * Rejects non-ignored untracked residue or replacement across an execution region.
 *
 * @param {unknown} before pre-execution snapshot
 * @param {unknown} after post-execution snapshot
 */
export function assertNonIgnoredUntrackedStateUnchanged(before, after) {
  if (!isDeepStrictEqual(before, after)) {
    fail(
      "SHARED_STATE_UNTRACKED_DRIFT",
      "Non-ignored untracked workspace state changed during execution.",
      { before, after },
    );
  }
}
