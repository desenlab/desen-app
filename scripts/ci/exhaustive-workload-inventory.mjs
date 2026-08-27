import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

const PROFILE = "desen.ci.exhaustive-workload-inventory.v1";
const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_JSON_STRINGIFY = JSON.stringify;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const SAFE_OBJECT_HAS_OWN = Object.hasOwn;
const SAFE_OBJECT_PROTOTYPE = Object.prototype;
const SAFE_REFLECT_OWN_KEYS = Reflect.ownKeys;
const SAFE_UTIL_IS_PROXY = utilTypes.isProxy;

const NODE_KEYS = SAFE_OBJECT_FREEZE([
  "id",
  "label",
  "command",
  "args",
  "dependencies",
  "executionClass",
  "sharedState",
]);
const SHARED_STATE_KEYS = SAFE_OBJECT_FREEZE([
  "trackedWorkspace",
  "buildOutputs",
  "temporaryPaths",
  "ports",
]);
const PROOF_UNIT_KEYS = SAFE_OBJECT_FREEZE(["id", "verifierNodeId", "rootTestNodeId"]);
const ROOT_KEYS = SAFE_OBJECT_FREEZE([
  "schemaVersion",
  "profile",
  "inventorySha256",
  "workloadCount",
  "proofUnitCount",
  "nodes",
  "proofUnits",
]);
const EXECUTION_CLASSES = SAFE_OBJECT_FREEZE([
  "SERIAL_GLOBAL",
  "SERIAL_BUILD_WRITER",
  "CONCURRENT_PROOF",
]);
const TRACKED_WORKSPACE_CLASSES = SAFE_OBJECT_FREEZE(["READ_ONLY_GUARDED"]);
const BUILD_OUTPUT_CLASSES = SAFE_OBJECT_FREEZE([
  "NONE",
  "SHARED_WRITE_SERIALIZED",
  "SHARED_READ_AFTER_PREFIX",
]);
const TEMPORARY_PATH_CLASSES = SAFE_OBJECT_FREEZE(["NONE", "PROCESS_ISOLATED", "TOOL_SCOPED"]);
const PORT_CLASSES = SAFE_OBJECT_FREEZE(["NONE"]);
const REPOSITORY_INPUT_KEYS = SAFE_OBJECT_FREEZE([
  "packageJson",
  "verifierFiles",
  "rootTestFiles",
  "workspacePackages",
  "testConfigurationFiles",
  "workspaceManifestText",
]);
const FOCUSED_PACKAGE_PREREQUISITES = SAFE_OBJECT_FREEZE({
  "runtime-react-reconciliation-diagnostics": SAFE_OBJECT_FREEZE({
    packageName: "@desen/runtime-react",
    task: "test:reconciliation-diagnostics",
  }),
  "runtime-react-failure-boundary": SAFE_OBJECT_FREEZE({
    packageName: "@desen/runtime-react",
    task: "test:failure-boundary",
  }),
});
const DIRECT_PROOF_VERIFIER_PREREQUISITES = SAFE_OBJECT_FREEZE({
  "desen-app-catalog-panel-layer-tree": SAFE_OBJECT_FREEZE([
    "node scripts/verify-desen-app-shell-navigation.mjs",
    "node scripts/verify-reference-catalog-web-capability-artifact.mjs",
  ]),
  "desen-app-real-adapter-canvas": SAFE_OBJECT_FREEZE([
    "node scripts/verify-desen-app-shell-navigation.mjs",
    "node scripts/verify-reference-host-web-source-audit.mjs",
  ]),
});
const EXPECTED_CHECK_SUFFIX = SAFE_OBJECT_FREEZE([
  "pnpm lint",
  "pnpm typecheck",
  "pnpm build",
  "pnpm test",
  "pnpm boundaries",
]);
const EXPECTED_CI_CONTRACT_SCRIPTS = SAFE_OBJECT_FREEZE(
  [
    ["ci:required", "node scripts/ci/run-required-affected-quality-gate.mjs"],
    ["test:ci-quality-gate", "node --test scripts/test/ci-quality-gate.test.mjs"],
    [
      "verify:affected-selector-promotion-evidence",
      "node scripts/ci/verify-affected-selector-promotion-evidence.mjs",
    ],
    [
      "test:affected-selector-promotion-evidence",
      "node --test scripts/ci/test/affected-selector-promotion-evidence.test.mjs",
    ],
    [
      "test:required-affected-quality-gate",
      "node --test scripts/ci/test/required-affected-quality-gate.test.mjs",
    ],
  ].map(([name, command]) => SAFE_OBJECT_FREEZE({ name, command })),
);
export const EXPECTED_CI_CONTRACT_SCRIPT_SHA256 =
  "92bcdb9435a1cb6492c20e5ad82013ac7d65479a15a5f5b5321b8e59351f6014";
const EXPECTED_PREREQUISITE_SHA256 =
  "8e1f08ea689d33520b7dd905bc124a3dcb842abf5e40873da254013d9fb2ccbd";
const EXPECTED_LEAF_INVOCATION_SHA256 =
  "bcb1a99cd6832975955719a794c8c44a154d97f3e784ce9a5775502bfba210e2";
const EXPECTED_DISTINCT_LEAF_WORKLOAD_SHA256 =
  "b5a85ab89e327e828b8ebb5aa2c85b008596eae5e4bfa284d255548de76a53af";
const EXPECTED_WORKSPACE_TEST_SCRIPT_SHA256 =
  "4d7c4232cc0e31519f2f58e9ebeb355405e493594406aee99ed2a78ce0c796ab";
const EXPECTED_WORKSPACE_MANIFEST_SHA256 =
  "6c693fc7e2b55dfc4b2e84a9e267aef0b6aeecb3160a04cdba67ce570f860be9";
const EXPECTED_WORKSPACE_PACKAGE_GLOBS = SAFE_OBJECT_FREEZE(["apps/*", "packages/*"]);
const FORBIDDEN_COMMAND_PATTERN =
  /generate|writ(?:e|er)|--affected\b|--since\b|changed-files?|git-diff/i;
const SHELL_METACHARACTER_PATTERN = /[\n\r;&|><\x60$()*?{}!]|\[|\]/;

const PROOF_UNIT_TUPLES = SAFE_OBJECT_FREEZE([
  [
    "protocol-snapshot",
    "scripts/verify-protocol-snapshot.mjs",
    "tests/protocol-snapshot-integrity.test.mjs",
  ],
  [
    "protocol-traceability",
    "scripts/verify-protocol-traceability.mjs",
    "tests/protocol-traceability.test.mjs",
  ],
  ["protocol-types", "scripts/verify-protocol-types.mjs", "tests/protocol-types.test.mjs"],
  [
    "protocol-canonicalization",
    "scripts/verify-protocol-canonicalization.mjs",
    "tests/protocol-canonicalization.test.mjs",
  ],
  [
    "protocol-diagnostics",
    "scripts/verify-protocol-diagnostics.mjs",
    "tests/protocol-diagnostics.test.mjs",
  ],
  [
    "protocol-structural-validation",
    "scripts/verify-protocol-structural-validation.mjs",
    "tests/protocol-structural-validation.test.mjs",
  ],
  [
    "protocol-semantic-foundation",
    "scripts/verify-protocol-semantic-foundation.mjs",
    "tests/protocol-semantic-foundation.test.mjs",
  ],
  [
    "protocol-component-contracts",
    "scripts/verify-protocol-component-contracts.mjs",
    "tests/protocol-component-contracts.test.mjs",
  ],
  [
    "protocol-interaction-contracts",
    "scripts/verify-protocol-interaction-contracts.mjs",
    "tests/protocol-interaction-contracts.test.mjs",
  ],
  [
    "protocol-binding-contracts",
    "scripts/verify-protocol-binding-contracts.mjs",
    "tests/protocol-binding-contracts.test.mjs",
  ],
  [
    "protocol-execution-contracts",
    "scripts/verify-protocol-execution-contracts.mjs",
    "tests/protocol-execution-contracts.test.mjs",
  ],
  [
    "protocol-official-suite-parity",
    "scripts/verify-protocol-official-suite-parity.mjs",
    "tests/protocol-official-suite-parity.test.mjs",
  ],
  [
    "protocol-validator-diagnostic-micro-vectors",
    "scripts/verify-protocol-validator-diagnostic-micro-vectors.mjs",
    "tests/protocol-validator-diagnostic-micro-vectors.test.mjs",
  ],
  [
    "catalog-manifest-registration",
    "scripts/verify-catalog-manifest-registration.mjs",
    "tests/catalog-manifest-registration.test.mjs",
  ],
  [
    "web-react-package-digest",
    "scripts/verify-web-react-package-digest.mjs",
    "tests/web-react-package-digest.test.mjs",
  ],
  [
    "reference-catalog-web-components",
    "scripts/verify-reference-catalog-web-components.mjs",
    "tests/reference-catalog-web-components.test.mjs",
  ],
  [
    "reference-catalog-web-form-feedback",
    "scripts/verify-reference-catalog-web-form-feedback.mjs",
    "tests/reference-catalog-web-form-feedback.test.mjs",
  ],
  [
    "reference-tokens-and-synthetic-fixtures",
    "scripts/verify-reference-tokens-and-synthetic-fixtures.mjs",
    "tests/reference-tokens-and-synthetic-fixtures.test.mjs",
  ],
  [
    "reference-sign-in-fixtures-and-host-binding",
    "scripts/verify-reference-sign-in-fixtures-and-host-binding.mjs",
    "tests/reference-sign-in-fixtures-and-host-binding.test.mjs",
  ],
  [
    "reference-catalog-web-parity",
    "scripts/verify-reference-catalog-web-parity.mjs",
    "tests/reference-catalog-web-parity.test.mjs",
  ],
  [
    "reference-catalog-web-capability-artifact",
    "scripts/verify-reference-catalog-web-capability-artifact.mjs",
    "tests/reference-catalog-web-capability-artifact.test.mjs",
  ],
  [
    "sc-01-a2ui-bridge",
    "scripts/verify-sc-01-a2ui-bridge.mjs",
    "tests/sc-01-a2ui-bridge-spike.test.mjs",
  ],
  ["sc-01-dtcg-compatibility", "scripts/verify-sc-01-dtcg.mjs", "tests/sc-01-dtcg-audit.test.mjs"],
  [
    "runtime-core-host-ports",
    "scripts/verify-runtime-core-host-ports.mjs",
    "tests/runtime-core-host-ports.test.mjs",
  ],
  [
    "runtime-core-value-resolution",
    "scripts/verify-runtime-core-value-resolution.mjs",
    "tests/runtime-core-value-resolution.test.mjs",
  ],
  [
    "runtime-core-token-format-resolution",
    "scripts/verify-runtime-core-token-format-resolution.mjs",
    "tests/runtime-core-token-format-resolution.test.mjs",
  ],
  [
    "runtime-core-predicate-evaluation",
    "scripts/verify-runtime-core-predicate-evaluation.mjs",
    "tests/runtime-core-predicate-evaluation.test.mjs",
  ],
  [
    "runtime-core-variant-style-evaluation",
    "scripts/verify-runtime-core-variant-style-evaluation.mjs",
    "tests/runtime-core-variant-style-evaluation.test.mjs",
  ],
  [
    "runtime-core-local-state-identity",
    "scripts/verify-runtime-core-local-state-identity.mjs",
    "tests/runtime-core-local-state-identity.test.mjs",
  ],
  [
    "runtime-core-repeat-materialization",
    "scripts/verify-runtime-core-repeat-materialization.mjs",
    "tests/runtime-core-repeat-materialization.test.mjs",
  ],
  [
    "runtime-core-resource-lifecycle",
    "scripts/verify-runtime-core-resource-lifecycle.mjs",
    "tests/runtime-core-resource-lifecycle.test.mjs",
  ],
  [
    "runtime-core-operation-lifecycle",
    "scripts/verify-runtime-core-operation-lifecycle.mjs",
    "tests/runtime-core-operation-lifecycle.test.mjs",
  ],
  [
    "runtime-core-state-navigation-actions",
    "scripts/verify-runtime-core-state-navigation-actions.mjs",
    "tests/runtime-core-state-navigation-actions.test.mjs",
  ],
  [
    "runtime-core-operation-resource-actions",
    "scripts/verify-runtime-core-operation-resource-actions.mjs",
    "tests/runtime-core-operation-resource-actions.test.mjs",
  ],
  [
    "runtime-core-command-event-actions",
    "scripts/verify-runtime-core-command-event-actions.mjs",
    "tests/runtime-core-command-event-actions.test.mjs",
  ],
  [
    "runtime-core-action-turns",
    "scripts/verify-runtime-core-action-turns.mjs",
    "tests/runtime-core-action-turns.test.mjs",
  ],
  [
    "runtime-core-adapter-bridges",
    "scripts/verify-runtime-core-adapter-bridges.mjs",
    "tests/runtime-core-adapter-bridges.test.mjs",
  ],
  [
    "runtime-core-reactive-reevaluation",
    "scripts/verify-runtime-core-reactive-reevaluation.mjs",
    "tests/runtime-core-reactive-reevaluation.test.mjs",
  ],
  [
    "runtime-core-headless-sign-in",
    "scripts/verify-runtime-core-headless-sign-in.mjs",
    "tests/runtime-core-headless-sign-in.test.mjs",
  ],
  [
    "runtime-core-audit-hardening",
    "scripts/verify-runtime-core-audit-hardening.mjs",
    "tests/runtime-core-audit-hardening.test.mjs",
  ],
  [
    "runtime-react-adapter-registry",
    "scripts/verify-runtime-react-adapter-registry.mjs",
    "tests/runtime-react-adapter-registry.test.mjs",
  ],
  [
    "runtime-react-resolved-props-slots",
    "scripts/verify-runtime-react-resolved-props-slots.mjs",
    "tests/runtime-react-resolved-props-slots.test.mjs",
  ],
  [
    "runtime-react-resolved-styles",
    "scripts/verify-runtime-react-resolved-styles.mjs",
    "tests/runtime-react-resolved-styles.test.mjs",
  ],
  [
    "runtime-react-interactions",
    "scripts/verify-runtime-react-interactions.mjs",
    "tests/runtime-react-interactions.test.mjs",
  ],
  [
    "runtime-react-reconciliation-diagnostics",
    "scripts/verify-runtime-react-reconciliation-diagnostics.mjs",
    "tests/runtime-react-reconciliation-diagnostics.test.mjs",
  ],
  [
    "runtime-react-failure-boundary",
    "scripts/verify-runtime-react-failure-boundary.mjs",
    "tests/runtime-react-failure-boundary.test.mjs",
  ],
  [
    "reference-host-web-shell",
    "scripts/verify-reference-host-web-shell.mjs",
    "tests/reference-host-web-shell.test.mjs",
  ],
  [
    "reference-host-web-sign-in",
    "scripts/verify-reference-host-web-sign-in.mjs",
    "tests/reference-host-web-sign-in.test.mjs",
  ],
  [
    "reference-host-web-source-audit",
    "scripts/verify-reference-host-web-source-audit.mjs",
    "tests/reference-host-web-source-audit.test.mjs",
  ],
  [
    "publisher-publish-result",
    "scripts/verify-publisher-publish-result.mjs",
    "tests/publisher-publish-result.test.mjs",
  ],
  [
    "publisher-catalog-resolution",
    "scripts/verify-publisher-catalog-resolution.mjs",
    "tests/publisher-catalog-resolution.test.mjs",
  ],
  [
    "publisher-source-preflight",
    "scripts/verify-publisher-source-preflight.mjs",
    "tests/publisher-source-preflight.test.mjs",
  ],
  [
    "publisher-capability-preflight",
    "scripts/verify-publisher-capability-preflight.mjs",
    "tests/publisher-capability-preflight.test.mjs",
  ],
  [
    "publisher-execution-preflight",
    "scripts/verify-publisher-execution-preflight.mjs",
    "tests/publisher-execution-preflight.test.mjs",
  ],
  [
    "publisher-source-preservation",
    "scripts/verify-publisher-source-preservation.mjs",
    "tests/publisher-source-preservation.test.mjs",
  ],
  [
    "publisher-source-normalization",
    "scripts/verify-publisher-source-normalization.mjs",
    "tests/publisher-source-normalization.test.mjs",
  ],
  [
    "publisher-catalog-pinning",
    "scripts/verify-publisher-catalog-pinning.mjs",
    "tests/publisher-catalog-pinning.test.mjs",
  ],
  [
    "publisher-bundle-publication",
    "scripts/verify-publisher-bundle-publication.mjs",
    "tests/publisher-bundle-publication.test.mjs",
  ],
  [
    "publisher-official-golden",
    "scripts/verify-publisher-official-golden.mjs",
    "tests/publisher-official-golden.test.mjs",
  ],
  [
    "publisher-invalid-source-matrix",
    "scripts/verify-publisher-invalid-source-matrix.mjs",
    "tests/publisher-invalid-source-matrix.test.mjs",
  ],
  [
    "control-plane-bundle-store",
    "scripts/verify-control-plane-bundle-store.mjs",
    "tests/control-plane-bundle-store.test.mjs",
  ],
  [
    "control-plane-bundle-verification",
    "scripts/verify-control-plane-bundle-verification.mjs",
    "tests/control-plane-bundle-verification.test.mjs",
  ],
  [
    "control-plane-package-preflight",
    "scripts/verify-control-plane-package-preflight.mjs",
    "tests/control-plane-package-preflight.test.mjs",
  ],
  [
    "control-plane-reference-preflight",
    "scripts/verify-control-plane-reference-preflight.mjs",
    "tests/control-plane-reference-preflight.test.mjs",
  ],
  [
    "control-plane-local-api",
    "scripts/verify-control-plane-local-api.mjs",
    "tests/control-plane-local-api.test.mjs",
  ],
  [
    "control-plane-runtime-staging",
    "scripts/verify-control-plane-runtime-staging.mjs",
    "tests/control-plane-runtime-staging.test.mjs",
  ],
  [
    "control-plane-runtime-activation",
    "scripts/verify-control-plane-runtime-activation.mjs",
    "tests/control-plane-runtime-activation.test.mjs",
  ],
  [
    "control-plane-runtime-recovery",
    "scripts/verify-control-plane-runtime-recovery.mjs",
    "tests/control-plane-runtime-recovery.test.mjs",
  ],
  [
    "control-plane-runtime-fault-injection",
    "scripts/verify-control-plane-runtime-fault-injection.mjs",
    "tests/control-plane-runtime-fault-injection.test.mjs",
  ],
  [
    "control-plane-runtime-transition-races",
    "scripts/verify-control-plane-runtime-transition-races.mjs",
    "tests/control-plane-runtime-transition-races.test.mjs",
  ],
  [
    "reference-host-web-channel-consumption",
    "scripts/verify-reference-host-web-channel-consumption.mjs",
    "tests/reference-host-web-channel-consumption.test.mjs",
  ],
  [
    "editor-core-source-document",
    "scripts/verify-editor-core-source-document.mjs",
    "tests/editor-core-source-document.test.mjs",
  ],
  [
    "editor-core-stable-id-insert",
    "scripts/verify-editor-core-stable-id-insert.mjs",
    "tests/editor-core-stable-id-insert.test.mjs",
  ],
  [
    "editor-core-structural-edits",
    "scripts/verify-editor-core-structural-edits.mjs",
    "tests/editor-core-structural-edits.test.mjs",
  ],
  [
    "editor-core-content-edits",
    "scripts/verify-editor-core-content-edits.mjs",
    "tests/editor-core-content-edits.test.mjs",
  ],
  [
    "editor-core-state-binding-edits",
    "scripts/verify-editor-core-state-binding-edits.mjs",
    "tests/editor-core-state-binding-edits.test.mjs",
  ],
  [
    "editor-core-event-action-edits",
    "scripts/verify-editor-core-event-action-edits.mjs",
    "tests/editor-core-event-action-edits.test.mjs",
  ],
  [
    "editor-core-authoring-round-trip",
    "scripts/verify-editor-core-authoring-round-trip.mjs",
    "tests/editor-core-authoring-round-trip.test.mjs",
  ],
  [
    "editor-core-persistence",
    "scripts/verify-editor-core-persistence.mjs",
    "tests/editor-core-persistence.test.mjs",
  ],
  [
    "editor-core-continuous-validation",
    "scripts/verify-editor-core-continuous-validation.mjs",
    "tests/editor-core-continuous-validation.test.mjs",
  ],
  [
    "editor-core-terminal-integration",
    "scripts/verify-editor-core-terminal-integration.mjs",
    "tests/editor-core-terminal-integration.test.mjs",
  ],
  [
    "desen-app-shell-navigation",
    "scripts/verify-desen-app-shell-navigation.mjs",
    "tests/desen-app-shell-navigation.test.mjs",
  ],
  [
    "desen-app-catalog-panel-layer-tree",
    "scripts/verify-desen-app-catalog-panel-layer-tree.mjs",
    "tests/desen-app-catalog-panel-layer-tree.test.mjs",
  ],
  [
    "desen-app-real-adapter-canvas",
    "scripts/verify-desen-app-real-adapter-canvas.mjs",
    "tests/desen-app-real-adapter-canvas.test.mjs",
  ],
]);

const NO_SHARED_MUTATION = SAFE_OBJECT_FREEZE({
  trackedWorkspace: "READ_ONLY_GUARDED",
  buildOutputs: "NONE",
  temporaryPaths: "NONE",
  ports: "NONE",
});
const SHARED_BUILD_WRITER = SAFE_OBJECT_FREEZE({
  trackedWorkspace: "READ_ONLY_GUARDED",
  buildOutputs: "SHARED_WRITE_SERIALIZED",
  temporaryPaths: "TOOL_SCOPED",
  ports: "NONE",
});
const SHARED_BUILD_READER = SAFE_OBJECT_FREEZE({
  trackedWorkspace: "READ_ONLY_GUARDED",
  buildOutputs: "SHARED_READ_AFTER_PREFIX",
  temporaryPaths: "PROCESS_ISOLATED",
  ports: "NONE",
});
const PROCESS_ISOLATED_NO_BUILD = SAFE_OBJECT_FREEZE({
  trackedWorkspace: "READ_ONLY_GUARDED",
  buildOutputs: "NONE",
  temporaryPaths: "PROCESS_ISOLATED",
  ports: "NONE",
});

/** Error raised when executable workload authority is malformed or drifts from review. */
export class ExhaustiveWorkloadInventoryError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ExhaustiveWorkloadInventoryError";
    this.details = SAFE_OBJECT_FREEZE({ ...details });
  }
}

function fail(message, details = {}) {
  throw new ExhaustiveWorkloadInventoryError(message, details);
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
    fail(label + " must be one inert plain object.");
  }
  const ownKeys = SAFE_REFLECT_OWN_KEYS(value);
  if (
    ownKeys.length !== expectedKeys.length ||
    ownKeys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    fail(label + " fields drifted.", { expected: expectedKeys, actual: ownKeys });
  }
  const captured = {};
  for (const key of expectedKeys) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(label + "." + key + " must be inert own data.");
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function inertRecord(value, label, maximumFields = 512) {
  if (
    value === null ||
    typeof value !== "object" ||
    SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_UTIL_IS_PROXY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== SAFE_OBJECT_PROTOTYPE
  ) {
    fail(label + " must be one inert plain object.");
  }
  const ownKeys = SAFE_REFLECT_OWN_KEYS(value);
  if (ownKeys.length > maximumFields || ownKeys.some((key) => typeof key !== "string")) {
    fail(label + " has unsupported fields.");
  }
  const captured = {};
  for (const key of ownKeys) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(label + "." + key + " must be inert own data.");
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
    fail(label + " must be one bounded inert array.");
  }
  const ownKeys = SAFE_REFLECT_OWN_KEYS(value);
  if (ownKeys.length !== value.length + 1 || ownKeys.at(-1) !== "length") {
    fail(label + " must not be sparse or carry extra properties.");
  }
  const captured = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, String(index));
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(label + "[" + index + "] must be inert own data.");
    }
    captured.push(descriptor.value);
  }
  return captured;
}

function exactString(value, label, maximumLength = 1_024) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximumLength) {
    fail(label + " must be one bounded nonempty string.");
  }
  return value;
}

function stringArray(value, label, maximumLength) {
  return exactArray(value, label, maximumLength).map((entry, index) =>
    exactString(entry, label + "[" + index + "]"),
  );
}

function assertUnique(values, label) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) {
    fail(label + " contains duplicates.", { duplicates: [...new Set(duplicates)] });
  }
}

function assertExactArray(actual, expected, label) {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    fail(label + " drifted from the reviewed repository inventory.", {
      expected,
      actual,
    });
  }
}

function splitRootScript(script, label) {
  if (typeof script !== "string" || script.length === 0 || script.length > 256 * 1024) {
    fail(label + " is missing or exceeds its bound.");
  }
  return script.split(" && ").map((command) => command.trim());
}

function validateCiContractScripts(scripts) {
  const projection = EXPECTED_CI_CONTRACT_SCRIPTS.map(({ name, command }) => {
    const actual = scripts[name];
    if (actual !== command) {
      fail("The CI contract package script " + name + " drifted from review.", {
        expected: command,
        actual,
      });
    }
    return { name, command: actual };
  });
  const sha256 = createHash("sha256").update(SAFE_JSON_STRINGIFY(projection)).digest("hex");
  if (sha256 !== EXPECTED_CI_CONTRACT_SCRIPT_SHA256) {
    fail("The reviewed CI contract package-script inventory drifted.", {
      expected: EXPECTED_CI_CONTRACT_SCRIPT_SHA256,
      actual: sha256,
    });
  }
  return { count: projection.length, sha256 };
}

function expandRootScript(scripts, scriptName, ancestors = []) {
  if (ancestors.includes(scriptName)) {
    fail("The root script graph contains a cycle.", {
      cycle: [...ancestors, scriptName],
    });
  }
  const script = scripts[scriptName];
  const commands = splitRootScript(script, "The root script " + scriptName);
  return commands.flatMap((command) => {
    const referencedScript = /^pnpm ([a-z0-9:-]+)$/u.exec(command)?.[1];
    if (referencedScript && SAFE_OBJECT_HAS_OWN(scripts, referencedScript)) {
      return expandRootScript(scripts, referencedScript, [...ancestors, scriptName]);
    }
    return [command];
  });
}

function createLeafWorkloadInventory(scripts) {
  const invocations = expandRootScript(scripts, "check");
  const distinctWorkloads = [...new Set(invocations)].sort();
  return {
    invocationCount: invocations.length,
    invocationSha256: createHash("sha256").update(SAFE_JSON_STRINGIFY(invocations)).digest("hex"),
    distinctWorkloadCount: distinctWorkloads.length,
    distinctWorkloadSha256: createHash("sha256")
      .update(SAFE_JSON_STRINGIFY(distinctWorkloads))
      .digest("hex"),
  };
}

function parseVitestRun(script, label) {
  if (
    typeof script !== "string" ||
    script.length === 0 ||
    script.length > 64 * 1024 ||
    SHELL_METACHARACTER_PATTERN.test(script) ||
    /['"\\]/u.test(script)
  ) {
    fail(label + " contains unsafe shell syntax.", { script });
  }
  const tokens = script.trim().split(/\s+/u);
  if (tokens[0] !== "vitest" || tokens[1] !== "run") {
    fail(label + " is not a recognized exhaustive Vitest command.", { script });
  }
  const selectors = [];
  for (const token of tokens.slice(2)) {
    if (token === "--passWithNoTests") continue;
    if (token.startsWith("-")) {
      fail(label + " contains an unreviewed Vitest option.", { script, option: token });
    }
    selectors.push(token);
  }
  return selectors;
}

function assertFocusedTestCovered(packageManifest, task) {
  const scripts = inertRecord(packageManifest.scripts, packageManifest.name + " scripts");
  const fullTestScript = scripts.test;
  const focusedTestScript = scripts[task];
  if (!fullTestScript || !focusedTestScript) {
    fail(packageManifest.name + " " + task + " lacks executable full-suite coverage.");
  }
  const fullSelectors = parseVitestRun(fullTestScript, packageManifest.name + " test");
  const focusedSelectors = parseVitestRun(focusedTestScript, packageManifest.name + " " + task);
  if (
    fullSelectors.length > 0 &&
    focusedSelectors.some((selector) => !fullSelectors.includes(selector))
  ) {
    fail(packageManifest.name + " " + task + " is not a subset of its full package test.", {
      fullSelectors,
      focusedSelectors,
    });
  }
}

function classifyPrerequisite({
  command,
  currentProofId,
  currentProofIndex,
  proofIndexById,
  workspacePackageMap,
}) {
  const proofDependencyMatch = /^pnpm verify:([a-z0-9-]+)$/u.exec(command);
  if (proofDependencyMatch) {
    const dependencyId = proofDependencyMatch[1];
    const dependencyIndex = proofIndexById.get(dependencyId);
    if (dependencyIndex === undefined || dependencyIndex >= currentProofIndex) {
      fail(currentProofId + " has an unknown or out-of-order proof prerequisite.", {
        command,
        dependencyId,
      });
    }
    return "proof-verifier";
  }

  const reviewedDirectProofVerifiers = SAFE_OBJECT_HAS_OWN(
    DIRECT_PROOF_VERIFIER_PREREQUISITES,
    currentProofId,
  )
    ? DIRECT_PROOF_VERIFIER_PREREQUISITES[currentProofId]
    : undefined;
  if (reviewedDirectProofVerifiers?.includes(command)) {
    return "direct-proof-verifier";
  }

  const parts = command.split(" ");
  if (
    parts.length >= 7 &&
    parts[0] === "pnpm" &&
    parts[1] === "--filter" &&
    parts[3] === "exec" &&
    parts[4] === "vitest" &&
    parts[5] === "run"
  ) {
    const reviewedPrerequisite = SAFE_OBJECT_HAS_OWN(FOCUSED_PACKAGE_PREREQUISITES, currentProofId)
      ? FOCUSED_PACKAGE_PREREQUISITES[currentProofId]
      : undefined;
    if (!reviewedPrerequisite) {
      fail(currentProofId + " uses an unreviewed direct focused-package test command.", {
        command,
      });
    }
    const packageManifest = workspacePackageMap.get(reviewedPrerequisite.packageName);
    if (!packageManifest) {
      fail(currentProofId + " references an unknown workspace package.", {
        command,
        packageName: reviewedPrerequisite.packageName,
      });
    }
    const packageScripts = inertRecord(packageManifest.scripts, packageManifest.name + " scripts");
    const focusedScript = packageScripts[reviewedPrerequisite.task];
    const expectedCommand =
      "pnpm --filter " + reviewedPrerequisite.packageName + " exec " + focusedScript;
    if (command !== expectedCommand) {
      fail(currentProofId + " uses an unreviewed direct focused-package test command.", {
        command,
        expectedCommand,
      });
    }
    assertFocusedTestCovered(packageManifest, reviewedPrerequisite.task);
    return "direct-focused-package-test";
  }

  if (parts.length !== 4 || parts[0] !== "pnpm" || parts[1] !== "--filter") {
    fail(currentProofId + " contains an unclassified prerequisite.", { command });
  }
  const selectorToken = parts[2];
  const packageName = selectorToken.endsWith("...") ? selectorToken.slice(0, -3) : selectorToken;
  const task = parts[3];
  if (!/^(?:@desen\/[a-z0-9-]+|desen)$/u.test(packageName)) {
    fail(currentProofId + " uses an unreviewed package selector.", {
      command,
      packageName,
    });
  }
  const packageManifest = workspacePackageMap.get(packageName);
  if (!packageManifest) {
    fail(currentProofId + " references an unknown workspace package.", {
      command,
      packageName,
    });
  }
  const packageScripts = inertRecord(packageManifest.scripts, packageName + " scripts");
  if (task === "build" || task === "typecheck") {
    if (!packageScripts[task]) fail(packageName + " no longer defines " + task + ".");
    return "package-" + task;
  }
  if (task === "verify:structural-validation") {
    if (
      packageName !== "@desen/validator" ||
      packageScripts[task] !== "node scripts/verify-structural-validators.mjs"
    ) {
      fail("The structural-validator prerequisite drifted.", {
        command,
        actual: packageScripts[task],
      });
    }
    return "structural-validator-artifacts";
  }
  if (task === "verify:package-preflight-guards") {
    if (
      packageName !== "@desen/control-plane-api" ||
      packageScripts[task] !== "pnpm run verify:package-preflight-catalog-guard" ||
      packageScripts["verify:package-preflight-catalog-guard"] !==
        "node scripts/verify-package-preflight-catalog-guard.mjs"
    ) {
      fail("The package-preflight guard prerequisite drifted.", {
        command,
        actual: packageScripts[task],
      });
    }
    return "package-preflight-guard-artifact";
  }
  if (task === "test") {
    if (!packageScripts.test) fail(packageName + " no longer defines its full test suite.");
    return "package-test";
  }
  if (task === "test:public-package") {
    const expectedScript =
      "tsc -p tsconfig.build.json && tsc -p tsconfig.public-package.json --noEmit && node --test test/public-package.mjs";
    const reviewedEditorCoreProof = [
      "editor-core-source-document",
      "editor-core-stable-id-insert",
      "editor-core-structural-edits",
      "editor-core-content-edits",
      "editor-core-state-binding-edits",
      "editor-core-event-action-edits",
      "editor-core-authoring-round-trip",
      "editor-core-persistence",
      "editor-core-continuous-validation",
      "editor-core-terminal-integration",
    ].includes(currentProofId);
    const reviewedPackage =
      packageName === "@desen/editor-core" ||
      (currentProofId === "editor-core-persistence" && packageName === "@desen/editor-web");
    if (!reviewedEditorCoreProof || !reviewedPackage || packageScripts[task] !== expectedScript) {
      fail(currentProofId + " uses an unreviewed public-package contract test.", {
        command,
        actual: packageScripts[task],
      });
    }
    return "public-package-contract-test";
  }
  if (task.startsWith("test:")) {
    assertFocusedTestCovered(packageManifest, task);
    return "focused-package-test";
  }
  fail(currentProofId + " contains an unclassified package task.", {
    command,
    packageName,
    task,
  });
}

function assertAllowed(value, allowed, label) {
  if (!allowed.includes(value)) fail(label + " uses an unknown classification.", { value });
}

function validateSharedState(rawState, label) {
  const state = exactRecord(rawState, SHARED_STATE_KEYS, label);
  state.trackedWorkspace = exactString(state.trackedWorkspace, label + ".trackedWorkspace");
  state.buildOutputs = exactString(state.buildOutputs, label + ".buildOutputs");
  state.temporaryPaths = exactString(state.temporaryPaths, label + ".temporaryPaths");
  state.ports = exactString(state.ports, label + ".ports");
  assertAllowed(state.trackedWorkspace, TRACKED_WORKSPACE_CLASSES, label + ".trackedWorkspace");
  assertAllowed(state.buildOutputs, BUILD_OUTPUT_CLASSES, label + ".buildOutputs");
  assertAllowed(state.temporaryPaths, TEMPORARY_PATH_CLASSES, label + ".temporaryPaths");
  assertAllowed(state.ports, PORT_CLASSES, label + ".ports");
  return state;
}

function validateNode(rawNode, index) {
  const label = "Workload node " + index;
  const workload = exactRecord(rawNode, NODE_KEYS, label);
  workload.id = exactString(workload.id, label + ".id", 160);
  workload.label = exactString(workload.label, label + ".label", 240);
  workload.command = exactString(workload.command, label + ".command", 32);
  workload.args = stringArray(workload.args, label + ".args", 64);
  workload.dependencies = stringArray(workload.dependencies, label + ".dependencies", 132);
  workload.executionClass = exactString(workload.executionClass, label + ".executionClass", 64);
  workload.sharedState = validateSharedState(workload.sharedState, label + ".sharedState");

  if (!/^[a-z0-9-]+$/u.test(workload.id) || /[\r\n]/u.test(workload.label)) {
    fail(label + " contains an unsafe id or label.", { id: workload.id });
  }
  if (!["node", "pnpm"].includes(workload.command)) {
    fail(label + " uses an unapproved executable.", { command: workload.command });
  }
  const commandText = [workload.command, ...workload.args].join(" ");
  if (SHELL_METACHARACTER_PATTERN.test(commandText)) {
    fail(label + " contains shell metacharacters.", { commandText });
  }
  if (FORBIDDEN_COMMAND_PATTERN.test(commandText)) {
    fail(label + " contains an execution shortcut or writer.", { commandText });
  }
  assertAllowed(workload.executionClass, EXECUTION_CLASSES, label + ".executionClass");
  assertUnique(workload.dependencies, label + " dependencies");
  return workload;
}

function validateProofUnit(rawUnit, index) {
  const label = "Proof unit " + index;
  const unit = exactRecord(rawUnit, PROOF_UNIT_KEYS, label);
  unit.id = exactString(unit.id, label + ".id", 160);
  unit.verifierNodeId = exactString(unit.verifierNodeId, label + ".verifierNodeId", 180);
  unit.rootTestNodeId = exactString(unit.rootTestNodeId, label + ".rootTestNodeId", 180);
  if (!/^[a-z0-9-]+$/u.test(unit.id)) fail(label + " contains an unsafe id.");
  return unit;
}

function validateGraph(nodes) {
  const ids = nodes.map(({ id }) => id);
  assertUnique(ids, "Workload node ids");
  const nodeById = new Map(nodes.map((workload) => [workload.id, workload]));
  for (const workload of nodes) {
    for (const dependency of workload.dependencies) {
      if (!nodeById.has(dependency)) {
        fail("Workload node " + workload.id + " has an unknown dependency.", { dependency });
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) fail("The workload dependency graph contains a cycle.", { id });
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of nodeById.get(id).dependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);

  const indexById = new Map(ids.map((id, index) => [id, index]));
  for (const workload of nodes) {
    for (const dependency of workload.dependencies) {
      if (indexById.get(dependency) >= indexById.get(workload.id)) {
        fail("The stable workload order is not topological.", {
          id: workload.id,
          dependency,
        });
      }
    }
  }
  return nodeById;
}

function captureInventory(candidate) {
  const root = exactRecord(candidate, ROOT_KEYS, "Workload inventory");
  if (root.schemaVersion !== 1 || root.profile !== PROFILE) {
    fail("The workload inventory profile or schema version is unknown.", {
      schemaVersion: root.schemaVersion,
      profile: root.profile,
    });
  }
  root.inventorySha256 = exactString(root.inventorySha256, "inventorySha256", 64);
  if (!/^[0-9a-f]{64}$/u.test(root.inventorySha256)) {
    fail("inventorySha256 must be one lowercase SHA-256 digest.");
  }
  if (
    !Number.isSafeInteger(root.workloadCount) ||
    root.workloadCount < 1 ||
    root.workloadCount > 256
  ) {
    fail("workloadCount is out of bounds.");
  }
  if (
    !Number.isSafeInteger(root.proofUnitCount) ||
    root.proofUnitCount < 1 ||
    root.proofUnitCount > 128
  ) {
    fail("proofUnitCount is out of bounds.");
  }
  root.nodes = exactArray(root.nodes, "nodes", 256).map(validateNode);
  root.proofUnits = exactArray(root.proofUnits, "proofUnits", 128).map(validateProofUnit);
  if (root.workloadCount !== root.nodes.length || root.proofUnitCount !== root.proofUnits.length) {
    fail("The declared workload or proof-unit count is inconsistent.", {
      workloadCount: root.workloadCount,
      nodes: root.nodes.length,
      proofUnitCount: root.proofUnitCount,
      proofUnits: root.proofUnits.length,
    });
  }

  const nodeById = validateGraph(root.nodes);
  assertUnique(
    root.proofUnits.map(({ id }) => id),
    "Proof unit ids",
  );
  for (const unit of root.proofUnits) {
    const verifier = nodeById.get(unit.verifierNodeId);
    const rootTest = nodeById.get(unit.rootTestNodeId);
    if (
      !verifier ||
      !rootTest ||
      verifier.executionClass !== "CONCURRENT_PROOF" ||
      rootTest.executionClass !== "CONCURRENT_PROOF" ||
      rootTest.dependencies.length !== 1 ||
      rootTest.dependencies[0] !== verifier.id
    ) {
      fail("Proof unit " + unit.id + " does not own one ordered verifier/root-test pair.");
    }
  }
  return root;
}

function normalizedAuthority(inventory) {
  return {
    schemaVersion: inventory.schemaVersion,
    profile: inventory.profile,
    nodes: inventory.nodes.map((workload) => ({
      id: workload.id,
      label: workload.label,
      command: workload.command,
      args: [...workload.args],
      dependencies: [...workload.dependencies],
      executionClass: workload.executionClass,
      sharedState: { ...workload.sharedState },
    })),
    proofUnits: inventory.proofUnits.map((unit) => ({ ...unit })),
  };
}

function hashAuthority(inventory) {
  return createHash("sha256")
    .update(SAFE_JSON_STRINGIFY(normalizedAuthority(inventory)))
    .digest("hex");
}

function node(id, label, command, args, dependencies, executionClass, sharedState) {
  return { id, label, command, args, dependencies, executionClass, sharedState };
}

function buildCanonicalInventory() {
  const prefix = [
    node(
      "orchestrator-contracts",
      "CI orchestrator contract tests",
      "node",
      ["--test", "scripts/test/ci-quality-gate.test.mjs"],
      [],
      "SERIAL_GLOBAL",
      PROCESS_ISOLATED_NO_BUILD,
    ),
    node(
      "format",
      "Formatting",
      "pnpm",
      ["exec", "prettier", ".", "--check"],
      ["orchestrator-contracts"],
      "SERIAL_GLOBAL",
      NO_SHARED_MUTATION,
    ),
    node(
      "lint",
      "Lint",
      "pnpm",
      ["exec", "eslint", ".", "--max-warnings=0"],
      ["format"],
      "SERIAL_GLOBAL",
      NO_SHARED_MUTATION,
    ),
    node(
      "structural-validator-artifacts",
      "Generated structural validator parity",
      "node",
      ["packages/validator/scripts/verify-structural-validators.mjs"],
      ["lint"],
      "SERIAL_GLOBAL",
      NO_SHARED_MUTATION,
    ),
    node(
      "workspace-graph",
      "Fresh workspace build and typecheck",
      "pnpm",
      ["exec", "turbo", "run", "build", "typecheck", "--force", "--ui=stream"],
      ["structural-validator-artifacts"],
      "SERIAL_BUILD_WRITER",
      SHARED_BUILD_WRITER,
    ),
    node(
      "package-tests",
      "Package tests with controlled concurrency",
      "pnpm",
      ["--recursive", "--workspace-concurrency=1", "--if-present", "run", "test"],
      ["workspace-graph"],
      "SERIAL_GLOBAL",
      SHARED_BUILD_READER,
    ),
    node(
      "editor-core-public-package-contract",
      "Editor core public-package contract",
      "pnpm",
      ["--filter", "@desen/editor-core", "test:public-package"],
      ["package-tests"],
      "SERIAL_BUILD_WRITER",
      SHARED_BUILD_WRITER,
    ),
    node(
      "editor-web-public-package-contract",
      "Editor Web public-package contract",
      "pnpm",
      ["--filter", "@desen/editor-web", "test:public-package"],
      ["editor-core-public-package-contract"],
      "SERIAL_BUILD_WRITER",
      SHARED_BUILD_WRITER,
    ),
  ];
  const verifiers = PROOF_UNIT_TUPLES.map(([id, verifierFile]) =>
    node(
      "verify-" + id,
      "Proof verifier: " + id,
      "node",
      [verifierFile],
      [
        id === "editor-core-source-document" ||
        id === "editor-core-stable-id-insert" ||
        id === "editor-core-structural-edits" ||
        id === "editor-core-content-edits" ||
        id === "editor-core-state-binding-edits" ||
        id === "editor-core-event-action-edits" ||
        id === "editor-core-authoring-round-trip" ||
        id === "editor-core-continuous-validation" ||
        id === "editor-core-terminal-integration"
          ? "editor-core-public-package-contract"
          : id === "editor-core-persistence"
            ? "editor-web-public-package-contract"
            : "package-tests",
      ],
      "CONCURRENT_PROOF",
      SHARED_BUILD_READER,
    ),
  );
  const rootTests = PROOF_UNIT_TUPLES.map(([id, , rootTestFile]) =>
    node(
      "test-" + id,
      "Root proof and mutation test: " + id,
      "node",
      ["--test", "--test-concurrency=1", rootTestFile],
      ["verify-" + id],
      "CONCURRENT_PROOF",
      SHARED_BUILD_READER,
    ),
  );
  const suffix = [
    node(
      "dependency-boundaries",
      "Dependency boundaries",
      "pnpm",
      ["exec", "depcruise", "--config", "dependency-cruiser.config.cjs", "apps", "packages"],
      rootTests.map(({ id }) => id),
      "SERIAL_GLOBAL",
      NO_SHARED_MUTATION,
    ),
    node(
      "boundary-fixtures",
      "Hostile dependency-boundary fixtures",
      "node",
      ["scripts/verify-boundary-fixtures.mjs"],
      ["dependency-boundaries"],
      "SERIAL_GLOBAL",
      SHARED_BUILD_READER,
    ),
  ];
  const nodes = [...prefix, ...verifiers, ...rootTests, ...suffix];
  const proofUnits = PROOF_UNIT_TUPLES.map(([id]) => ({
    id,
    verifierNodeId: "verify-" + id,
    rootTestNodeId: "test-" + id,
  }));
  const base = {
    schemaVersion: 1,
    profile: PROFILE,
    inventorySha256: "0".repeat(64),
    workloadCount: nodes.length,
    proofUnitCount: proofUnits.length,
    nodes,
    proofUnits,
  };
  const inventorySha256 = hashAuthority(captureInventory(base));
  return deepFreeze({ ...base, inventorySha256 });
}

/**
 * Validates the repository manifests and discovered verifier/test files that back the inventory.
 *
 * The function accepts inert caller-captured data only. It neither reads files nor executes a
 * command, so both exhaustive schedulers can place their own no-follow I/O boundary around it.
 */
export function validateRepositoryWorkloadInputs(rawInputs) {
  const inputs = exactRecord(rawInputs, REPOSITORY_INPUT_KEYS, "Repository workload inputs");
  const packageJson = inertRecord(inputs.packageJson, "Root package manifest");
  const scripts = inertRecord(packageJson.scripts, "Root package scripts", 1_024);
  const verifierFiles = stringArray(inputs.verifierFiles, "verifierFiles", 256);
  const rootTestFiles = stringArray(inputs.rootTestFiles, "rootTestFiles", 256);
  const testConfigurationFiles = stringArray(
    inputs.testConfigurationFiles,
    "testConfigurationFiles",
    256,
  );
  const rawWorkspacePackages = exactArray(inputs.workspacePackages, "workspacePackages", 128);
  const workspacePackages = rawWorkspacePackages.map((rawManifest, index) => {
    const manifest = inertRecord(rawManifest, "Workspace package " + index);
    manifest.name = exactString(manifest.name, "Workspace package " + index + ".name", 256);
    manifest.scripts = inertRecord(
      manifest.scripts ?? {},
      "Workspace package " + index + ".scripts",
      512,
    );
    return manifest;
  });
  const workspaceManifestText = exactString(
    inputs.workspaceManifestText,
    "workspaceManifestText",
    64 * 1024,
  );

  const proofIds = PROOF_UNIT_TUPLES.map(([id]) => id);
  const expectedVerifierFiles = PROOF_UNIT_TUPLES.map(([, verifierFile]) => verifierFile);
  const expectedRootTestFiles = PROOF_UNIT_TUPLES.map(([, , rootTestFile]) => rootTestFile);
  const workspacePackageNames = workspacePackages.map(({ name }) => name);
  const workspacePackageMap = new Map(
    workspacePackages.map((packageManifest) => [packageManifest.name, packageManifest]),
  );
  const proofIndexById = new Map(proofIds.map((id, index) => [id, index]));
  const prerequisiteInventory = [];
  const ciContractScripts = validateCiContractScripts(scripts);

  assertUnique(proofIds, "Proof ids");
  assertUnique(expectedVerifierFiles, "Proof verifier files");
  assertUnique(expectedRootTestFiles, "Root proof test files");
  assertUnique(workspacePackageNames, "Workspace package names");

  const workspaceManifestSha256 = createHash("sha256").update(workspaceManifestText).digest("hex");
  if (workspaceManifestSha256 !== EXPECTED_WORKSPACE_MANIFEST_SHA256) {
    fail("The workspace manifest bytes drifted from review.", {
      expected: EXPECTED_WORKSPACE_MANIFEST_SHA256,
      actual: workspaceManifestSha256,
    });
  }
  const packagesBlock = /^packages:\n((?:[ ]{2}- "[^"]+"\n)+)/u.exec(workspaceManifestText);
  const workspacePackageGlobs = packagesBlock?.[1].match(/(?<=[ ]{2}- ")[^"]+(?="\n)/gu) ?? [];
  assertExactArray(
    workspacePackageGlobs,
    EXPECTED_WORKSPACE_PACKAGE_GLOBS,
    "The workspace package globs",
  );
  assertExactArray(
    [...testConfigurationFiles].sort(),
    [],
    "The root and workspace test-configuration file set",
  );
  if (SAFE_OBJECT_HAS_OWN(packageJson, "vitest")) {
    fail("The root package manifest contains an unreviewed vitest field.");
  }

  const workspaceTestScripts = workspacePackages
    .map((packageManifest) => ({
      name: packageManifest.name,
      test: packageManifest.scripts.test ?? null,
    }))
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  for (const entry of workspaceTestScripts) {
    const packageManifest = workspacePackageMap.get(entry.name);
    if (SAFE_OBJECT_HAS_OWN(packageManifest, "vitest")) {
      fail(entry.name + " contains an unreviewed vitest manifest field.");
    }
    if (entry.test !== null) {
      parseVitestRun(entry.test, entry.name + " test");
    }
  }
  const workspaceTestScriptSha256 = createHash("sha256")
    .update(SAFE_JSON_STRINGIFY(workspaceTestScripts))
    .digest("hex");
  if (workspaceTestScriptSha256 !== EXPECTED_WORKSPACE_TEST_SCRIPT_SHA256) {
    fail("The reviewed workspace package test-script inventory drifted.", {
      expected: EXPECTED_WORKSPACE_TEST_SCRIPT_SHA256,
      actual: workspaceTestScriptSha256,
      workspaceTestScripts,
    });
  }

  const expectedCheckCommands = [
    "pnpm format:check",
    ...proofIds.map((id) => "pnpm verify:" + id),
    ...EXPECTED_CHECK_SUFFIX,
  ];
  const expectedTestCommands = [...proofIds.map((id) => "pnpm test:" + id), "turbo run test"];
  assertExactArray(
    splitRootScript(scripts.check, "The root check script"),
    expectedCheckCommands,
    "The root check script",
  );
  assertExactArray(
    splitRootScript(scripts.test, "The root test script"),
    expectedTestCommands,
    "The root test script",
  );

  for (const [proofIndex, [id, verifierFile, rootTestFile]] of PROOF_UNIT_TUPLES.entries()) {
    const verifierCommands = splitRootScript(scripts["verify:" + id], "verify:" + id);
    const testCommands = splitRootScript(scripts["test:" + id], "test:" + id);
    if (verifierCommands.at(-1) !== "node " + verifierFile) {
      fail("verify:" + id + " no longer ends with its reviewed verifier.", {
        expected: "node " + verifierFile,
        actual: verifierCommands.at(-1),
      });
    }
    if (testCommands.at(-1) !== "node --test " + rootTestFile) {
      fail("test:" + id + " no longer ends with its reviewed root test.", {
        expected: "node --test " + rootTestFile,
        actual: testCommands.at(-1),
      });
    }

    const verifierPrerequisites = verifierCommands.slice(0, -1);
    const testPrerequisites = testCommands.slice(0, -1);
    prerequisiteInventory.push({
      id,
      verify: verifierPrerequisites,
      test: testPrerequisites,
    });
    for (const command of [...verifierPrerequisites, ...testPrerequisites]) {
      classifyPrerequisite({
        command,
        currentProofId: id,
        currentProofIndex: proofIndex,
        proofIndexById,
        workspacePackageMap,
      });
    }
  }

  const legacyPrerequisiteSha256 = createHash("sha256")
    .update(SAFE_JSON_STRINGIFY(prerequisiteInventory))
    .digest("hex");
  if (legacyPrerequisiteSha256 !== EXPECTED_PREREQUISITE_SHA256) {
    fail("The reviewed prerequisite inventory drifted.", {
      expected: EXPECTED_PREREQUISITE_SHA256,
      actual: legacyPrerequisiteSha256,
    });
  }
  const leafInventory = createLeafWorkloadInventory(scripts);
  if (leafInventory.distinctWorkloadSha256 !== EXPECTED_DISTINCT_LEAF_WORKLOAD_SHA256) {
    fail("The reviewed distinct leaf-workload inventory drifted.", {
      expected: EXPECTED_DISTINCT_LEAF_WORKLOAD_SHA256,
      actual: leafInventory.distinctWorkloadSha256,
    });
  }
  if (leafInventory.invocationSha256 !== EXPECTED_LEAF_INVOCATION_SHA256) {
    fail("The reviewed ordered leaf invocation inventory drifted.", {
      expected: EXPECTED_LEAF_INVOCATION_SHA256,
      actual: leafInventory.invocationSha256,
    });
  }
  assertExactArray(
    [...verifierFiles].sort(),
    [...expectedVerifierFiles].sort(),
    "The proof verifier file set",
  );
  assertExactArray(
    [...rootTestFiles].sort(),
    [...expectedRootTestFiles].sort(),
    "The root proof test file set",
  );

  return deepFreeze({
    proofCount: proofIds.length,
    verifierCount: verifierFiles.length,
    rootTestCount: rootTestFiles.length,
    ciContractScriptCount: ciContractScripts.count,
    ciContractScriptSha256: ciContractScripts.sha256,
    legacyPrerequisiteCount: prerequisiteInventory.reduce(
      (count, entry) => count + entry.verify.length + entry.test.length,
      0,
    ),
    legacyPrerequisiteSha256,
    legacyLeafInvocationCount: leafInventory.invocationCount,
    legacyLeafInvocationSha256: leafInventory.invocationSha256,
    distinctLeafWorkloadCount: leafInventory.distinctWorkloadCount,
    distinctLeafWorkloadSha256: leafInventory.distinctWorkloadSha256,
    testConfigurationFileCount: testConfigurationFiles.length,
    workspaceTestScriptCount: workspaceTestScripts.filter(
      ({ test: testScript }) => testScript !== null,
    ).length,
    workspaceTestScriptSha256,
    workspaceManifestSha256,
    workspacePackageGlobs,
  });
}

/** Reviewed digest of the complete neutral exhaustive workload authority. */
export const EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256 =
  "0fdfb9646319a82d8f1a9c73d0533967a98ccb56a3a0df77790d97aaf9f921d1";

const CANONICAL_INVENTORY = buildCanonicalInventory();
if (CANONICAL_INVENTORY.inventorySha256 !== EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256) {
  throw new ExhaustiveWorkloadInventoryError(
    "The reviewed exhaustive workload inventory digest drifted: " +
      CANONICAL_INVENTORY.inventorySha256 +
      ".",
    {
      expected: EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
      actual: CANONICAL_INVENTORY.inventorySha256,
    },
  );
}

/** Returns the single deeply frozen scheduler-neutral exhaustive workload authority. */
export function createExhaustiveWorkloadInventory() {
  return CANONICAL_INVENTORY;
}

/** Calculates the stable SHA-256 projection after structural and graph validation. */
export function calculateExhaustiveWorkloadInventorySha256(candidate) {
  return hashAuthority(captureInventory(candidate));
}

/**
 * Revalidates an injected inventory and returns canonical authority only when it is an exact match.
 */
export function validateExhaustiveWorkloadInventory(candidate) {
  const captured = captureInventory(candidate);
  const calculatedSha256 = hashAuthority(captured);
  if (captured.inventorySha256 !== calculatedSha256) {
    fail("The exhaustive workload inventory self-digest is invalid.", {
      declared: captured.inventorySha256,
      calculated: calculatedSha256,
    });
  }
  if (
    calculatedSha256 !== EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256 ||
    SAFE_JSON_STRINGIFY(normalizedAuthority(captured)) !==
      SAFE_JSON_STRINGIFY(normalizedAuthority(CANONICAL_INVENTORY))
  ) {
    fail("The exhaustive workload inventory was omitted, reordered, or substituted.", {
      expected: EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
      actual: calculatedSha256,
    });
  }
  return CANONICAL_INVENTORY;
}
