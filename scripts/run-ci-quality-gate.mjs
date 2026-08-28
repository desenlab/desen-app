import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, lstat, readFile, readdir, readlink } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "..");

const PROOF_ENTRIES = Object.freeze(
  [
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
    [
      "sc-01-dtcg-compatibility",
      "scripts/verify-sc-01-dtcg.mjs",
      "tests/sc-01-dtcg-audit.test.mjs",
    ],
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
    [
      "desen-app-selection-overlay",
      "scripts/verify-desen-app-selection-overlay.mjs",
      "tests/desen-app-selection-overlay.test.mjs",
    ],
    [
      "desen-app-schema-inspector",
      "scripts/verify-desen-app-schema-inspector.mjs",
      "tests/desen-app-schema-inspector.test.mjs",
    ],
    [
      "desen-app-structured-inspector",
      "scripts/verify-desen-app-structured-inspector.mjs",
      "tests/desen-app-structured-inspector.test.mjs",
    ],
    [
      "desen-app-named-slot-authoring",
      "scripts/verify-desen-app-named-slot-authoring.mjs",
      "tests/desen-app-named-slot-authoring.test.mjs",
    ],
  ].map(([id, verifierFile, rootTestFile]) => Object.freeze({ id, verifierFile, rootTestFile })),
);

const DIRECT_FOCUSED_TEST_PREREQUISITES = Object.freeze({
  "runtime-react-reconciliation-diagnostics": Object.freeze({
    packageName: "@desen/runtime-react",
    task: "test:reconciliation-diagnostics",
  }),
  "runtime-react-failure-boundary": Object.freeze({
    packageName: "@desen/runtime-react",
    task: "test:failure-boundary",
  }),
});

const DIRECT_PROOF_VERIFIER_PREREQUISITES = Object.freeze({
  "desen-app-catalog-panel-layer-tree": Object.freeze([
    "node scripts/verify-desen-app-shell-navigation.mjs",
    "node scripts/verify-reference-catalog-web-capability-artifact.mjs",
  ]),
  "desen-app-real-adapter-canvas": Object.freeze([
    "node scripts/verify-desen-app-shell-navigation.mjs",
    "node scripts/verify-reference-host-web-source-audit.mjs",
  ]),
  "desen-app-selection-overlay": Object.freeze([
    "node scripts/verify-desen-app-real-adapter-canvas.mjs",
  ]),
  "desen-app-schema-inspector": Object.freeze([
    "node scripts/verify-desen-app-catalog-panel-layer-tree.mjs",
    "node scripts/verify-desen-app-selection-overlay.mjs",
    "node scripts/verify-publisher-official-golden.mjs",
  ]),
  "desen-app-structured-inspector": Object.freeze([
    "node scripts/verify-desen-app-schema-inspector.mjs",
  ]),
  "desen-app-named-slot-authoring": Object.freeze([
    "node scripts/verify-desen-app-structured-inspector.mjs",
  ]),
});

const EXPECTED_CHECK_SUFFIX = Object.freeze([
  "pnpm lint",
  "pnpm typecheck",
  "pnpm build",
  "pnpm test",
  "pnpm boundaries",
]);
const EXPECTED_CI_CONTRACT_SCRIPTS = Object.freeze(
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
  ].map(([name, command]) => Object.freeze({ name, command })),
);

const LEGACY_PREREQUISITE_SHA256 =
  "0ca9fcc3176df5b6707e2b704d0e3aa4dd4288bc3b7f813461d90ef3397c5d80";
const LEGACY_LEAF_INVOCATION_SHA256 =
  "d4cea0955703f00540994ecdaac6d5cdca4f9f1bb3037c7ba038da67d9991e7a";
const DISTINCT_LEAF_WORKLOAD_SHA256 =
  "ddc6aa4a631dd92edb762c52d06277eec262b89f5e062e9c199a3c15f423304f";
const CI_CONTRACT_SCRIPT_SHA256 =
  "92bcdb9435a1cb6492c20e5ad82013ac7d65479a15a5f5b5321b8e59351f6014";
const QUALITY_GATE_PLAN_SHA256 = "fc2320e67fab4582f8eb4deead2e7048cd207577c965931440a83daeefb9de79";
// Historical M06-T08 plan pin retained for its frozen mutation test:
// 2addb6556f4e24c921b090102a80eee58f0fa3850b844b5f50197e50b759bbd0
// Historical M06-T09 plan pin retained for its frozen compatibility reader:
// 3c927667b5b932a523f3bbe347cc554cd16b94e08fe493f5afe1b76361311f0c
// Historical M06-T10 plan pin retained for its frozen compatibility reader:
// ce00f625601b84a74a0b96d061f9ca25a2aa283d45aae4e8991051de70247582
const WORKSPACE_TEST_SCRIPT_SHA256 =
  "4d7c4232cc0e31519f2f58e9ebeb355405e493594406aee99ed2a78ce0c796ab";
const WORKSPACE_MANIFEST_SHA256 =
  "6c693fc7e2b55dfc4b2e84a9e267aef0b6aeecb3160a04cdba67ce570f860be9";
const EXPECTED_WORKSPACE_PACKAGE_GLOBS = Object.freeze(["apps/*", "packages/*"]);
const FORBIDDEN_COMMAND_PATTERN =
  /generate|writ(?:e|er)|--affected\b|--since\b|changed-files?|git-diff/i;
const SHELL_METACHARACTER_PATTERN = /[\n\r;&|><`$()*?{}!]|\[|\]/;
const TEST_CONFIGURATION_FILE_PATTERN =
  /^(?:vite\.config|vitest\.config|vitest\.workspace)\.[^/]+$/u;

class QualityGateError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "QualityGateError";
    this.details = details;
  }
}

class CommandError extends QualityGateError {
  constructor(step, code, signal) {
    super(`"${step.label}" failed.`, { stepId: step.id, code, signal });
    this.name = "CommandError";
    this.code = code;
    this.signal = signal;
  }
}

class CancellationError extends QualityGateError {
  constructor(signal) {
    super(`The quality gate was cancelled by ${signal}.`, { signal });
    this.name = "CancellationError";
    this.signal = signal;
  }
}

function splitScript(script) {
  return script.split(" && ").map((command) => command.trim());
}

function expandLegacyRootScript(scripts, scriptName, ancestors = []) {
  if (ancestors.includes(scriptName)) {
    throw new QualityGateError("The legacy root script graph contains a cycle.", {
      cycle: [...ancestors, scriptName],
    });
  }

  const script = scripts[scriptName];
  if (typeof script !== "string") {
    throw new QualityGateError(`The legacy root script "${scriptName}" is missing.`);
  }

  return splitScript(script).flatMap((command) => {
    const rootScriptReference = /^pnpm ([a-z0-9:-]+)$/u.exec(command)?.[1];
    if (rootScriptReference && Object.hasOwn(scripts, rootScriptReference)) {
      return expandLegacyRootScript(scripts, rootScriptReference, [...ancestors, scriptName]);
    }
    return [command];
  });
}

function createLegacyLeafInventory(scripts) {
  const invocations = expandLegacyRootScript(scripts, "check");
  const distinctWorkloads = [...new Set(invocations)].sort();
  return {
    invocationCount: invocations.length,
    invocationSha256: createHash("sha256").update(JSON.stringify(invocations)).digest("hex"),
    distinctWorkloadCount: distinctWorkloads.length,
    distinctWorkloadSha256: createHash("sha256")
      .update(JSON.stringify(distinctWorkloads))
      .digest("hex"),
  };
}

function assertExactArray(actual, expected, label) {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new QualityGateError(`${label} drifted from the frozen CI inventory.`, {
      expected,
      actual,
    });
  }
}

function assertUnique(values, label) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) {
    throw new QualityGateError(`${label} contains duplicate entries.`, {
      duplicates: [...new Set(duplicates)],
    });
  }
}

function validateCiContractScripts(scripts) {
  const projection = EXPECTED_CI_CONTRACT_SCRIPTS.map(({ name, command }) => {
    const actual = scripts[name];
    if (actual !== command) {
      throw new QualityGateError(
        `The CI contract package script ${name} drifted from the frozen inventory.`,
        { expected: command, actual },
      );
    }
    return { name, command: actual };
  });
  const sha256 = createHash("sha256").update(JSON.stringify(projection)).digest("hex");
  if (sha256 !== CI_CONTRACT_SCRIPT_SHA256) {
    throw new QualityGateError("The reviewed CI contract package-script inventory drifted.", {
      expected: CI_CONTRACT_SCRIPT_SHA256,
      actual: sha256,
    });
  }
  return { count: projection.length, sha256 };
}

function parseVitestRun(script, label) {
  if (SHELL_METACHARACTER_PATTERN.test(script) || /['"\\]/u.test(script)) {
    throw new QualityGateError(`${label} contains unsafe shell syntax.`, { script });
  }
  const tokens = script.trim().split(/\s+/);
  if (tokens[0] !== "vitest" || tokens[1] !== "run") {
    throw new QualityGateError(`${label} is not a recognized exhaustive Vitest command.`, {
      script,
    });
  }

  const selectors = [];
  for (const token of tokens.slice(2)) {
    if (token === "--passWithNoTests") {
      continue;
    }
    if (token.startsWith("-")) {
      throw new QualityGateError(`${label} contains an unreviewed Vitest option.`, {
        script,
        option: token,
      });
    }
    selectors.push(token);
  }
  return selectors;
}

function assertFocusedTestCovered(packageManifest, task) {
  const fullTestScript = packageManifest.scripts?.test;
  const focusedTestScript = packageManifest.scripts?.[task];
  if (!fullTestScript || !focusedTestScript) {
    throw new QualityGateError(
      `${packageManifest.name} ${task} is not covered by an executable full package test.`,
    );
  }

  const fullSelectors = parseVitestRun(fullTestScript, `${packageManifest.name} test`);
  const focusedSelectors = parseVitestRun(focusedTestScript, `${packageManifest.name} ${task}`);
  if (
    fullSelectors.length > 0 &&
    focusedSelectors.some((selector) => !fullSelectors.includes(selector))
  ) {
    throw new QualityGateError(
      `${packageManifest.name} ${task} is not a subset of its full package test.`,
      { fullSelectors, focusedSelectors },
    );
  }
}

function classifyLegacyPrerequisite({
  command,
  currentProofId,
  currentProofIndex,
  proofIndexById,
  workspacePackageMap,
}) {
  const proofDependencyMatch = /^pnpm verify:([a-z0-9-]+)$/.exec(command);
  if (proofDependencyMatch) {
    const dependencyId = proofDependencyMatch[1];
    const dependencyIndex = proofIndexById.get(dependencyId);
    if (dependencyIndex === undefined || dependencyIndex >= currentProofIndex) {
      throw new QualityGateError(
        `${currentProofId} has an unknown or out-of-order proof prerequisite.`,
        { command, dependencyId },
      );
    }
    return "proof-verifier";
  }

  const reviewedDirectProofVerifiers = Object.hasOwn(
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
    const reviewedPrerequisite = Object.hasOwn(DIRECT_FOCUSED_TEST_PREREQUISITES, currentProofId)
      ? DIRECT_FOCUSED_TEST_PREREQUISITES[currentProofId]
      : undefined;
    if (!reviewedPrerequisite) {
      throw new QualityGateError(
        `${currentProofId} uses an unreviewed direct focused-package test command.`,
        { command },
      );
    }
    const packageManifest = workspacePackageMap.get(reviewedPrerequisite.packageName);
    if (!packageManifest) {
      throw new QualityGateError(`${currentProofId} references an unknown workspace package.`, {
        command,
        packageName: reviewedPrerequisite.packageName,
      });
    }
    const focusedScript = packageManifest.scripts?.[reviewedPrerequisite.task];
    const expectedCommand = `pnpm --filter ${reviewedPrerequisite.packageName} exec ${focusedScript}`;
    if (command !== expectedCommand) {
      throw new QualityGateError(
        `${currentProofId} uses an unreviewed direct focused-package test command.`,
        { command, expectedCommand },
      );
    }
    assertFocusedTestCovered(packageManifest, reviewedPrerequisite.task);
    return "direct-focused-package-test";
  }

  if (parts.length !== 4 || parts[0] !== "pnpm" || parts[1] !== "--filter") {
    throw new QualityGateError(`${currentProofId} contains an unclassified legacy prerequisite.`, {
      command,
    });
  }

  const selectorToken = parts[2];
  const packageName = selectorToken.endsWith("...") ? selectorToken.slice(0, -3) : selectorToken;
  const task = parts[3];
  if (!/^(?:@desen\/[a-z0-9-]+|desen)$/.test(packageName)) {
    throw new QualityGateError(`${currentProofId} uses an unreviewed package selector.`, {
      command,
      packageName,
    });
  }

  const packageManifest = workspacePackageMap.get(packageName);
  if (!packageManifest) {
    throw new QualityGateError(`${currentProofId} references an unknown workspace package.`, {
      command,
      packageName,
    });
  }

  if (task === "build" || task === "typecheck") {
    if (!packageManifest.scripts?.[task]) {
      throw new QualityGateError(`${packageName} no longer defines ${task}.`, { command });
    }
    return `package-${task}`;
  }

  if (task === "verify:structural-validation") {
    if (
      packageName !== "@desen/validator" ||
      packageManifest.scripts?.[task] !== "node scripts/verify-structural-validators.mjs"
    ) {
      throw new QualityGateError("The structural-validator prerequisite drifted.", {
        command,
        actual: packageManifest.scripts?.[task],
      });
    }
    return "structural-validator-artifacts";
  }

  if (task === "verify:package-preflight-guards") {
    if (
      packageName !== "@desen/control-plane-api" ||
      packageManifest.scripts?.[task] !== "pnpm run verify:package-preflight-catalog-guard" ||
      packageManifest.scripts?.["verify:package-preflight-catalog-guard"] !==
        "node scripts/verify-package-preflight-catalog-guard.mjs"
    ) {
      throw new QualityGateError("The package-preflight guard prerequisite drifted.", {
        command,
        actual: packageManifest.scripts?.[task],
      });
    }
    return "package-preflight-guard-artifact";
  }

  if (task === "test") {
    if (!packageManifest.scripts?.test) {
      throw new QualityGateError(`${packageName} no longer defines its full test suite.`, {
        command,
      });
    }
    return "package-test";
  }

  if (task === "test:public-package") {
    const expectedScript =
      "tsc -p tsconfig.build.json && tsc -p tsconfig.public-package.json --noEmit && node --test test/public-package.mjs";
    if (
      ![
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
      ].includes(currentProofId) ||
      (packageName !== "@desen/editor-core" &&
        !(currentProofId === "editor-core-persistence" && packageName === "@desen/editor-web")) ||
      packageManifest.scripts?.[task] !== expectedScript
    ) {
      throw new QualityGateError(
        `${currentProofId} uses an unreviewed public-package contract test.`,
        { command, actual: packageManifest.scripts?.[task] },
      );
    }
    return "public-package-contract-test";
  }

  if (task.startsWith("test:")) {
    assertFocusedTestCovered(packageManifest, task);
    return "focused-package-test";
  }

  throw new QualityGateError(`${currentProofId} contains an unclassified package task.`, {
    command,
    packageName,
    task,
  });
}

export function validateProofInventory({
  packageJson,
  verifierFiles,
  rootTestFiles,
  workspacePackages,
  testConfigurationFiles,
  workspaceManifestText,
  proofEntries = PROOF_ENTRIES,
}) {
  const scripts = packageJson.scripts ?? {};
  const proofIds = proofEntries.map(({ id }) => id);
  const expectedVerifierFiles = proofEntries.map(({ verifierFile }) => verifierFile);
  const expectedRootTestFiles = proofEntries.map(({ rootTestFile }) => rootTestFile);
  const workspacePackageNames = workspacePackages.map(({ name }) => name);
  const workspacePackageMap = new Map(
    workspacePackages.map((packageManifest) => [packageManifest.name, packageManifest]),
  );
  const proofIndexById = new Map(proofIds.map((id, index) => [id, index]));
  const legacyPrerequisiteInventory = [];
  const ciContractScripts = validateCiContractScripts(scripts);

  assertUnique(proofIds, "Proof ids");
  assertUnique(expectedVerifierFiles, "Proof verifier files");
  assertUnique(expectedRootTestFiles, "Root proof test files");
  assertUnique(workspacePackageNames, "Workspace package names");
  if (typeof workspaceManifestText !== "string") {
    throw new QualityGateError("The pnpm workspace manifest inventory is missing.");
  }
  const workspaceManifestSha256 = createHash("sha256").update(workspaceManifestText).digest("hex");
  if (workspaceManifestSha256 !== WORKSPACE_MANIFEST_SHA256) {
    throw new QualityGateError("pnpm-workspace.yaml bytes drifted from the reviewed inventory.", {
      expected: WORKSPACE_MANIFEST_SHA256,
      actual: workspaceManifestSha256,
    });
  }
  const packagesBlock = /^packages:\n((?:[ ]{2}- "[^"]+"\n)+)/u.exec(workspaceManifestText);
  const workspacePackageGlobs = packagesBlock?.[1].match(/(?<=[ ]{2}- ")[^"]+(?="\n)/gu) ?? [];
  assertExactArray(
    workspacePackageGlobs,
    EXPECTED_WORKSPACE_PACKAGE_GLOBS,
    "The pnpm workspace package globs",
  );
  if (!Array.isArray(testConfigurationFiles)) {
    throw new QualityGateError("The test-configuration file inventory is missing.");
  }
  assertExactArray(
    [...testConfigurationFiles].sort(),
    [],
    "The root and workspace test-configuration file set",
  );
  if (Object.hasOwn(packageJson, "vitest")) {
    throw new QualityGateError("The root package manifest contains an unreviewed vitest field.");
  }

  const workspaceTestScripts = workspacePackages
    .map((packageManifest) => ({
      name: packageManifest.name,
      test: packageManifest.scripts?.test ?? null,
    }))
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  for (const [index, entry] of workspaceTestScripts.entries()) {
    const packageManifest = workspacePackageMap.get(entry.name);
    if (Object.hasOwn(packageManifest, "vitest")) {
      throw new QualityGateError(`${entry.name} contains an unreviewed vitest manifest field.`);
    }
    if (entry.test !== null) {
      if (typeof entry.test !== "string") {
        throw new QualityGateError(`${entry.name} has a non-string test command.`);
      }
      parseVitestRun(entry.test, `${entry.name} test`);
    }
    if (index > 0 && workspaceTestScripts[index - 1].name === entry.name) {
      throw new QualityGateError(`Workspace test inventory duplicates ${entry.name}.`);
    }
  }
  const workspaceTestScriptSha256 = createHash("sha256")
    .update(JSON.stringify(workspaceTestScripts))
    .digest("hex");
  if (workspaceTestScriptSha256 !== WORKSPACE_TEST_SCRIPT_SHA256) {
    throw new QualityGateError("The reviewed workspace package test-script inventory drifted.", {
      expected: WORKSPACE_TEST_SCRIPT_SHA256,
      actual: workspaceTestScriptSha256,
      workspaceTestScripts,
    });
  }

  const expectedCheckCommands = [
    "pnpm format:check",
    ...proofIds.map((id) => `pnpm verify:${id}`),
    ...EXPECTED_CHECK_SUFFIX,
  ];
  const expectedTestCommands = [...proofIds.map((id) => `pnpm test:${id}`), "turbo run test"];

  assertExactArray(
    splitScript(scripts.check ?? ""),
    expectedCheckCommands,
    "The root check script",
  );
  assertExactArray(splitScript(scripts.test ?? ""), expectedTestCommands, "The root test script");

  for (const [proofIndex, { id, verifierFile, rootTestFile }] of proofEntries.entries()) {
    const verifierCommands = splitScript(scripts[`verify:${id}`] ?? "");
    const testCommands = splitScript(scripts[`test:${id}`] ?? "");

    if (verifierCommands.at(-1) !== `node ${verifierFile}`) {
      throw new QualityGateError(`verify:${id} no longer ends with its frozen verifier.`, {
        expected: `node ${verifierFile}`,
        actual: verifierCommands.at(-1),
      });
    }
    if (testCommands.at(-1) !== `node --test ${rootTestFile}`) {
      throw new QualityGateError(`test:${id} no longer ends with its frozen root test.`, {
        expected: `node --test ${rootTestFile}`,
        actual: testCommands.at(-1),
      });
    }

    const verifierPrerequisites = verifierCommands.slice(0, -1);
    const testPrerequisites = testCommands.slice(0, -1);
    legacyPrerequisiteInventory.push({
      id,
      verify: verifierPrerequisites,
      test: testPrerequisites,
    });

    for (const command of [...verifierPrerequisites, ...testPrerequisites]) {
      classifyLegacyPrerequisite({
        command,
        currentProofId: id,
        currentProofIndex: proofIndex,
        proofIndexById,
        workspacePackageMap,
      });
    }
  }

  const legacyPrerequisiteSha256 = createHash("sha256")
    .update(JSON.stringify(legacyPrerequisiteInventory))
    .digest("hex");
  if (legacyPrerequisiteSha256 !== LEGACY_PREREQUISITE_SHA256) {
    throw new QualityGateError("The reviewed legacy prerequisite inventory drifted.", {
      expected: LEGACY_PREREQUISITE_SHA256,
      actual: legacyPrerequisiteSha256,
    });
  }

  const legacyLeafInventory = createLegacyLeafInventory(scripts);
  if (legacyLeafInventory.distinctWorkloadSha256 !== DISTINCT_LEAF_WORKLOAD_SHA256) {
    throw new QualityGateError("The reviewed distinct legacy leaf workload inventory drifted.", {
      expected: DISTINCT_LEAF_WORKLOAD_SHA256,
      actual: legacyLeafInventory.distinctWorkloadSha256,
      distinctWorkloadCount: legacyLeafInventory.distinctWorkloadCount,
    });
  }
  if (legacyLeafInventory.invocationSha256 !== LEGACY_LEAF_INVOCATION_SHA256) {
    throw new QualityGateError("The reviewed ordered legacy leaf invocation inventory drifted.", {
      expected: LEGACY_LEAF_INVOCATION_SHA256,
      actual: legacyLeafInventory.invocationSha256,
      invocationCount: legacyLeafInventory.invocationCount,
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

  return {
    proofCount: proofIds.length,
    verifierCount: verifierFiles.length,
    rootTestCount: rootTestFiles.length,
    ciContractScriptCount: ciContractScripts.count,
    ciContractScriptSha256: ciContractScripts.sha256,
    legacyPrerequisiteCount: legacyPrerequisiteInventory.reduce(
      (count, entry) => count + entry.verify.length + entry.test.length,
      0,
    ),
    legacyPrerequisiteSha256,
    legacyLeafInvocationCount: legacyLeafInventory.invocationCount,
    legacyLeafInvocationSha256: legacyLeafInventory.invocationSha256,
    distinctLeafWorkloadCount: legacyLeafInventory.distinctWorkloadCount,
    distinctLeafWorkloadSha256: legacyLeafInventory.distinctWorkloadSha256,
    testConfigurationFileCount: testConfigurationFiles.length,
    workspaceTestScriptCount: workspaceTestScripts.filter(({ test }) => test !== null).length,
    workspaceTestScriptSha256,
    workspaceManifestSha256,
    workspacePackageGlobs,
  };
}

export function assertSafeStep(step) {
  if (!["node", "pnpm"].includes(step.command)) {
    throw new QualityGateError(`Step "${step.id}" uses an unapproved executable.`, {
      command: step.command,
    });
  }

  const commandText = [step.command, ...step.args].join(" ");
  if (SHELL_METACHARACTER_PATTERN.test(commandText)) {
    throw new QualityGateError(`Step "${step.id}" contains a shell metacharacter.`, {
      commandText,
    });
  }
  if (FORBIDDEN_COMMAND_PATTERN.test(commandText)) {
    throw new QualityGateError(`Step "${step.id}" contains a forbidden CI shortcut or writer.`, {
      commandText,
    });
  }
}

function commandStep(id, label, command, args) {
  const step = Object.freeze({ id, label, command, args: Object.freeze([...args]) });
  assertSafeStep(step);
  return step;
}

export function validateQualityGatePlan(steps) {
  const stepIds = steps.map(({ id }) => id);
  assertUnique(stepIds, "Quality-gate step ids");
  for (const step of steps) {
    assertSafeStep(step);
  }

  assertExactArray(
    steps
      .filter(({ id }) => id.startsWith("verify-"))
      .map(({ id, command, args }) => `${id}\0${command}\0${args.join("\0")}`),
    PROOF_ENTRIES.map(({ id, verifierFile }) => `verify-${id}\0node\0${verifierFile}`),
    "The proof-verifier execution plan",
  );
  assertExactArray(
    steps
      .filter(({ id }) => id.startsWith("test-"))
      .map(({ id, command, args }) => `${id}\0${command}\0${args.join("\0")}`),
    PROOF_ENTRIES.map(
      ({ id, rootTestFile }) => `test-${id}\0node\0--test\0--test-concurrency=1\0${rootTestFile}`,
    ),
    "The root proof-test execution plan",
  );

  const normalizedPlan = steps.map(({ id, command, args }) => ({
    id,
    command,
    args,
  }));
  const planSha256 = createHash("sha256").update(JSON.stringify(normalizedPlan)).digest("hex");
  if (planSha256 !== QUALITY_GATE_PLAN_SHA256) {
    throw new QualityGateError("The reviewed single-pass quality-gate plan drifted.", {
      expected: QUALITY_GATE_PLAN_SHA256,
      actual: planSha256,
    });
  }
  return { stepCount: steps.length, planSha256 };
}

export function createQualityGateSteps() {
  const steps = [
    commandStep("orchestrator-contracts", "CI orchestrator contract tests", "node", [
      "--test",
      "scripts/test/ci-quality-gate.test.mjs",
    ]),
    commandStep("format", "Formatting", "pnpm", ["exec", "prettier", ".", "--check"]),
    commandStep("lint", "Lint", "pnpm", ["exec", "eslint", ".", "--max-warnings=0"]),
    commandStep("structural-validator-artifacts", "Generated structural validator parity", "node", [
      "packages/validator/scripts/verify-structural-validators.mjs",
    ]),
    commandStep("workspace-graph", "Fresh workspace build and typecheck", "pnpm", [
      "exec",
      "turbo",
      "run",
      "build",
      "typecheck",
      "--force",
      "--ui=stream",
    ]),
    commandStep("package-tests", "Package tests with controlled concurrency", "pnpm", [
      "--recursive",
      "--workspace-concurrency=1",
      "--if-present",
      "run",
      "test",
    ]),
    commandStep(
      "editor-core-public-package-contract",
      "Editor core public-package contract",
      "pnpm",
      ["--filter", "@desen/editor-core", "test:public-package"],
    ),
    commandStep(
      "editor-web-public-package-contract",
      "Editor Web public-package contract",
      "pnpm",
      ["--filter", "@desen/editor-web", "test:public-package"],
    ),
    ...PROOF_ENTRIES.map(({ id, verifierFile }) =>
      commandStep(`verify-${id}`, `Proof verifier: ${id}`, "node", [verifierFile]),
    ),
    ...PROOF_ENTRIES.map(({ id, rootTestFile }) =>
      commandStep(`test-${id}`, `Root proof and mutation test: ${id}`, "node", [
        "--test",
        "--test-concurrency=1",
        rootTestFile,
      ]),
    ),
    commandStep("dependency-boundaries", "Dependency boundaries", "pnpm", [
      "exec",
      "depcruise",
      "--config",
      "dependency-cruiser.config.cjs",
      "apps",
      "packages",
    ]),
    commandStep("boundary-fixtures", "Hostile dependency-boundary fixtures", "node", [
      "scripts/verify-boundary-fixtures.mjs",
    ]),
  ];
  validateQualityGatePlan(steps);
  return Object.freeze(steps);
}

async function captureCommand(command, args, { cwd = WORKSPACE_ROOT } = {}) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectPromise);
    child.on("close", (code, signal) => {
      if (code !== 0) {
        rejectPromise(
          new QualityGateError(`${command} ${args.join(" ")} failed.`, {
            code,
            signal,
            stderr: Buffer.concat(stderr).toString("utf8"),
          }),
        );
        return;
      }
      resolvePromise({
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      });
    });
  });
}

async function readInventory(workspaceRoot = WORKSPACE_ROOT) {
  const packageJson = JSON.parse(await readFile(resolve(workspaceRoot, "package.json"), "utf8"));
  const workspaceManifestText = await readFile(
    resolve(workspaceRoot, "pnpm-workspace.yaml"),
    "utf8",
  );
  const rootFiles = await readdir(workspaceRoot);
  const scriptFiles = await readdir(resolve(workspaceRoot, "scripts"));
  const testFiles = await readdir(resolve(workspaceRoot, "tests"));
  const workspacePackages = [];
  const testConfigurationFiles = rootFiles
    .filter((file) => TEST_CONFIGURATION_FILE_PATTERN.test(file))
    .map((file) => file);
  for (const workspaceDirectory of ["apps", "packages"]) {
    const entries = await readdir(resolve(workspaceRoot, workspaceDirectory), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const packageDirectory = resolve(workspaceRoot, workspaceDirectory, entry.name);
      const packageFiles = await readdir(packageDirectory);
      testConfigurationFiles.push(
        ...packageFiles
          .filter((file) => TEST_CONFIGURATION_FILE_PATTERN.test(file))
          .map((file) => `${workspaceDirectory}/${entry.name}/${file}`),
      );
      const manifestPath = resolve(workspaceRoot, workspaceDirectory, entry.name, "package.json");
      try {
        workspacePackages.push(JSON.parse(await readFile(manifestPath, "utf8")));
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
    }
  }
  const verifierFiles = scriptFiles
    .filter((file) => file.startsWith("verify-") && file.endsWith(".mjs"))
    .filter((file) => file !== "verify-boundary-fixtures.mjs")
    .map((file) => `scripts/${file}`);
  const rootTestFiles = testFiles
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => `tests/${file}`);

  return {
    packageJson,
    verifierFiles,
    rootTestFiles,
    workspacePackages,
    testConfigurationFiles,
    workspaceManifestText,
  };
}

function updateHashField(hash, value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  hash.update(`${buffer.byteLength}:`);
  hash.update(buffer);
  hash.update("\0");
}

export async function snapshotTrackedWorkspace(workspaceRoot = WORKSPACE_ROOT) {
  const { stdout } = await captureCommand("git", ["ls-files", "--stage", "-z"], {
    cwd: workspaceRoot,
  });
  const records = stdout.toString("utf8").split("\0").filter(Boolean);
  const hash = createHash("sha256");

  for (const record of records) {
    const separatorIndex = record.indexOf("\t");
    if (separatorIndex === -1) {
      throw new QualityGateError("Git returned an unreadable tracked-file record.", { record });
    }

    const metadata = record.slice(0, separatorIndex).split(" ");
    const relativePath = record.slice(separatorIndex + 1);
    const [indexMode, indexObjectId, stage] = metadata;
    if (stage !== "0") {
      throw new QualityGateError("The quality gate cannot run with an unmerged tracked file.", {
        relativePath,
        stage,
      });
    }

    updateHashField(hash, relativePath);
    updateHashField(hash, indexMode);
    updateHashField(hash, indexObjectId);

    try {
      const filePath = resolve(workspaceRoot, relativePath);
      const stat = await lstat(filePath);
      updateHashField(hash, stat.isSymbolicLink() ? "symlink" : stat.isFile() ? "file" : "other");
      updateHashField(hash, stat.mode & 0o111 ? "executable" : "not-executable");
      updateHashField(
        hash,
        stat.isSymbolicLink() ? await readlink(filePath) : await readFile(filePath),
      );
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
      updateHashField(hash, "missing");
    }
  }

  return Object.freeze({
    digest: hash.digest("hex"),
    trackedFileCount: records.length,
  });
}

export function assertTrackedWorkspaceUnchanged(before, after) {
  if (before.digest !== after.digest || before.trackedFileCount !== after.trackedFileCount) {
    throw new QualityGateError("A quality-gate step changed tracked workspace bytes or modes.", {
      before,
      after,
    });
  }
}

function formatDuration(milliseconds) {
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

function openLogGroup(label) {
  if (process.env.GITHUB_ACTIONS === "true") {
    process.stdout.write(`::group::${label}\n`);
  } else {
    process.stdout.write(`\n▶ ${label}\n`);
  }
}

function closeLogGroup() {
  if (process.env.GITHUB_ACTIONS === "true") {
    process.stdout.write("::endgroup::\n");
  }
}

export async function runStepSequence(steps, runStep, onTiming, assertCanContinue) {
  const timings = [];
  for (const step of steps) {
    const startedAt = performance.now();
    try {
      assertCanContinue?.();
      await runStep(step);
      assertCanContinue?.();
      const timing = {
        id: step.id,
        label: step.label,
        durationMs: performance.now() - startedAt,
        status: "PASS",
      };
      timings.push(timing);
      onTiming?.(timing);
    } catch (error) {
      const timing = {
        id: step.id,
        label: step.label,
        durationMs: performance.now() - startedAt,
        status: "FAIL",
      };
      timings.push(timing);
      onTiming?.(timing);
      throw error;
    }
  }
  return timings;
}

function runCommandStep(step, signalState, workspaceRoot = WORKSPACE_ROOT) {
  return new Promise((resolvePromise, rejectPromise) => {
    openLogGroup(step.label);
    process.stdout.write(`$ ${step.command} ${step.args.join(" ")}\n`);

    const child = spawn(step.command, step.args, {
      cwd: workspaceRoot,
      env: process.env,
      detached: process.platform !== "win32",
      shell: false,
      stdio: "inherit",
    });
    signalState.activeChild = child;
    let settled = false;

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (signalState.activeChild === child) {
        signalState.activeChild = undefined;
      }
      closeLogGroup();
      rejectPromise(error);
    });
    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      if (signalState.activeChild === child) {
        signalState.activeChild = undefined;
      }
      closeLogGroup();
      if (code === 0 && signal === null) {
        resolvePromise();
        return;
      }
      rejectPromise(new CommandError(step, code, signal));
    });
  });
}

export function forwardSignal(signal, activeChild) {
  if (!activeChild || activeChild.killed) {
    return false;
  }
  if (
    process.platform !== "win32" &&
    Number.isSafeInteger(activeChild.pid) &&
    activeChild.pid > 0
  ) {
    try {
      process.kill(-activeChild.pid, signal);
      return true;
    } catch (error) {
      if (error?.code !== "ESRCH") {
        throw error;
      }
    }
  }
  return activeChild.kill(signal);
}

function installSignalForwarding(signalState) {
  const handlers = new Map();
  for (const signal of ["SIGINT", "SIGTERM"]) {
    const handler = () => {
      signalState.receivedSignal ??= signal;
      forwardSignal(signal, signalState.activeChild);
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }
  return () => {
    for (const [signal, handler] of handlers) {
      process.off(signal, handler);
    }
  };
}

function createReceipt() {
  return {
    status: "RUNNING",
    revision: process.env.GITHUB_SHA ?? "local-working-tree",
    startedAt: new Date().toISOString(),
    durationMs: 0,
    inventory: undefined,
    trackedFileCount: 0,
    timings: [],
    error: undefined,
  };
}

export async function executeQualityGate({
  workspaceRoot = WORKSPACE_ROOT,
  readInventoryFunction = readInventory,
  snapshotFunction = snapshotTrackedWorkspace,
  steps = createQualityGateSteps(),
  runStep,
  assertCanContinue,
} = {}) {
  const receipt = createReceipt();
  const gateStartedAt = performance.now();
  let before;
  let primaryError;

  try {
    assertCanContinue?.();
    const inventoryStartedAt = performance.now();
    receipt.inventory = validateProofInventory(await readInventoryFunction(workspaceRoot));
    assertCanContinue?.();
    receipt.timings.push({
      id: "frozen-inventory",
      label: "Frozen proof inventory",
      durationMs: performance.now() - inventoryStartedAt,
      status: "PASS",
    });

    before = await snapshotFunction(workspaceRoot);
    assertCanContinue?.();
    receipt.trackedFileCount = before.trackedFileCount;
    await runStepSequence(
      steps,
      runStep,
      (timing) => receipt.timings.push(timing),
      assertCanContinue,
    );
    assertCanContinue?.();
  } catch (error) {
    primaryError = error;
  }

  if (before) {
    try {
      const after = await snapshotFunction(workspaceRoot);
      assertCanContinue?.();
      assertTrackedWorkspaceUnchanged(before, after);
    } catch (error) {
      if (primaryError) {
        primaryError.details = {
          ...primaryError.details,
          trackedWorkspaceError: error.message,
          trackedWorkspaceDetails: error.details,
        };
      } else {
        primaryError = error;
      }
    }
  }

  receipt.durationMs = performance.now() - gateStartedAt;
  receipt.status = primaryError ? "FAIL" : "PASS";
  if (primaryError) {
    receipt.error = {
      name: primaryError.name,
      message: primaryError.message,
      details: primaryError.details,
    };
    primaryError.receipt = receipt;
    throw primaryError;
  }
  return receipt;
}

export async function executeDefaultQualityGate(options = {}) {
  return executeQualityGate({
    ...options,
    steps: createQualityGateSteps(),
  });
}

function summaryCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export async function writeGitHubSummary(receipt, summaryPath = process.env.GITHUB_STEP_SUMMARY) {
  if (!summaryPath) {
    return;
  }

  const lines = [
    "## DESEN quality gate",
    "",
    `**Status:** ${receipt.status}`,
    `**Revision:** \`${summaryCell(receipt.revision)}\``,
    `**Total:** ${formatDuration(receipt.durationMs)}`,
    `**Frozen proofs:** ${receipt.inventory?.proofCount ?? "not validated"}`,
    `**Tracked files guarded:** ${receipt.trackedFileCount}`,
    "",
    "| Section | Status | Time |",
    "| --- | --- | ---: |",
    ...receipt.timings.map(
      (timing) =>
        `| ${summaryCell(timing.label)} | ${timing.status} | ${formatDuration(timing.durationMs)} |`,
    ),
  ];

  if (receipt.error) {
    lines.push("", `**Failure:** ${summaryCell(receipt.error.message)}`);
  }
  await appendFile(summaryPath, `${lines.join("\n")}\n`, "utf8");
}

function printReceipt(receipt) {
  process.stdout.write(
    `\n${JSON.stringify(
      {
        status: receipt.status,
        revision: receipt.revision,
        proofs: receipt.inventory?.proofCount,
        trackedFiles: receipt.trackedFileCount,
        duration: formatDuration(receipt.durationMs),
        sections: receipt.timings.map(({ id, durationMs, status }) => ({
          id,
          status,
          duration: formatDuration(durationMs),
        })),
        error: receipt.error,
      },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  const signalState = { activeChild: undefined, receivedSignal: undefined };
  const removeSignalForwarding = installSignalForwarding(signalState);
  let receipt;
  let failure;

  try {
    const assertCanContinue = () => {
      if (signalState.receivedSignal) {
        throw new CancellationError(signalState.receivedSignal);
      }
    };
    receipt = await executeDefaultQualityGate({
      runStep: async (step) => {
        await runCommandStep(step, signalState);
      },
      assertCanContinue,
    });
    assertCanContinue();
  } catch (error) {
    failure = error;
    receipt =
      error.receipt ??
      Object.assign(createReceipt(), {
        status: "FAIL",
        error: { name: error.name, message: error.message, details: error.details },
      });
  } finally {
    removeSignalForwarding();
  }

  if (!failure && signalState.receivedSignal) {
    failure = new CancellationError(signalState.receivedSignal);
    receipt.status = "FAIL";
    receipt.error = {
      name: failure.name,
      message: failure.message,
      details: failure.details,
    };
  }

  printReceipt(receipt);
  try {
    await writeGitHubSummary(receipt);
  } catch (summaryError) {
    process.stderr.write(`Warning: GitHub summary could not be written: ${String(summaryError)}\n`);
  }

  if (failure) {
    process.stderr.write(`${failure.stack ?? String(failure)}\n`);
    process.exitCode =
      signalState.receivedSignal === "SIGINT"
        ? 130
        : signalState.receivedSignal === "SIGTERM"
          ? 143
          : 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (import.meta.url === entrypoint) {
  await main();
}

export { CancellationError, PROOF_ENTRIES, QualityGateError };
