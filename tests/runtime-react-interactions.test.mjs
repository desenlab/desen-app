import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeReactInteractionsEvidenceError,
  buildRuntimeReactInteractionsEvidence,
  verifyRuntimeReactInteractionsEvidence,
  writeRuntimeReactInteractionsEvidence,
} from "../scripts/lib/runtime-react-interactions-proof.mjs";

const PENDING_SHA = "[PENDING_FINAL_ARTIFACT_SHA256]";
const T04_SHA_PATTERN = String.raw`(?:\[PENDING_FINAL_ARTIFACT_SHA256\]|[0-9a-f]{64})`;
const CORE_PATH = "packages/runtime-core/src/headless-session.ts";
const CORE_INDEX_PATH = "packages/runtime-core/src/index.ts";
const CORE_README_PATH = "packages/runtime-core/README.md";
const CORE_PACKAGE_PATH = "packages/runtime-core/package.json";
const RUNTIME_JSON_SNAPSHOT_PATH = "packages/runtime-core/src/runtime-json-snapshot.ts";
const CORE_DIST_INDEX_PATH = "packages/runtime-core/dist/index.js";
const CORE_DIST_HEADLESS_PATH = "packages/runtime-core/dist/headless-session.js";
const RUNTIME_PACKAGE_PATH = "packages/runtime-react/package.json";
const RUNTIME_DIST_REGISTRY_PATH = "packages/runtime-react/dist/registry.js";
const INTERACTIONS_PATH = "packages/runtime-react/src/interactions.tsx";
const RENDERER_PATH = "packages/runtime-react/src/render-plan.tsx";
const PARITY_TESTS_PATH = "packages/runtime-react/test/binding-parity.test.tsx";
const REFERENCE_ADAPTERS_PATH = "packages/reference-catalog-web/src/react-adapters/index.tsx";
const REFERENCE_PACKAGE_PATH = "packages/reference-catalog-web/package.json";
const REFERENCE_CONSUMER_PATH = "packages/reference-catalog-web/test/react-adapters-consumer.mjs";
const REFERENCE_CONSUMER_TESTS_PATH =
  "packages/reference-catalog-web/test/react-adapters-consumer.test.mjs";
const INTERACTION_TESTS_PATH = "packages/runtime-react/test/interaction-wiring.test.tsx";
const INTERACTION_TYPES_PATH = "packages/runtime-react/test/interaction-wiring.types.ts";
const REFERENCE_TYPES_PATH = "packages/reference-catalog-web/test/react-adapters.types.tsx";
const TASKS_PATH = "docs/plan/TASKS.md";
const FINDINGS_PATH = "docs/plan/PROTOCOL-FINDINGS.md";
const COMPATIBILITY_PATH = "scripts/lib/runtime-react-resolved-styles-proof.mjs";
const PARITY_COMPATIBILITY_PATH = "scripts/lib/reference-catalog-web-parity-proof.mjs";
const PARITY_COMPATIBILITY_TESTS_PATH = "tests/reference-catalog-web-parity.test.mjs";
const NORMATIVE_PATH = "docs/proof/NORMATIVE-COVERAGE.md";
const MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const ROOT_PACKAGE_PATH = "package.json";
const CI_RUNNER_PATH = "scripts/run-ci-quality-gate.mjs";
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const DIST_ADAPTER_PATH = "packages/reference-catalog-web/dist/react-adapters/index.js";
const SC01_DTCG_AUDIT_PATH = "scripts/lib/sc-01-dtcg-audit.mjs";
const SC01_DTCG_TESTS_PATH = "tests/sc-01-dtcg-audit.test.mjs";
const SC01_DTCG_GENERATE_PATH = "scripts/generate-sc-01-dtcg-proof.mjs";
const SC01_DTCG_ARTIFACT_PATH = "docs/proof/artifacts/sc-01-dtcg-compatibility.json";
const SC01_DTCG_PROFILE_PATH = "docs/profiles/DTCG-2025.10-COMPATIBILITY.md";
const SC01_COMPARISON_PATH = "docs/proof/SC-01-DESEN-A2UI-COMPARISON.md";
const STRATEGIC_VALIDATION_PATH = "docs/plan/STRATEGIC-VALIDATION.md";
const PROJECT_STATUS_PATH = "PROJECT-STATUS.md";
const LOCAL_STATE_IDENTITY_AUDIT_PATH = "scripts/lib/runtime-core-local-state-identity-proof.mjs";
const LOCAL_STATE_IDENTITY_TESTS_PATH = "tests/runtime-core-local-state-identity.test.mjs";
const LOCAL_STATE_IDENTITY_GENERATE_PATH =
  "scripts/generate-runtime-core-local-state-identity-proof.mjs";
const LOCAL_STATE_IDENTITY_ARTIFACT_PATH =
  "docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json";
const LOCAL_STATE_IDENTITY_PROOF_PATH = "docs/proof/RUNTIME-CORE-LOCAL-STATE-IDENTITY.md";
const COMMAND_EVENT_AUDIT_PATH = "scripts/lib/runtime-core-command-event-actions-proof.mjs";
const COMMAND_EVENT_TESTS_PATH = "tests/runtime-core-command-event-actions.test.mjs";
const COMMAND_EVENT_GENERATE_PATH = "scripts/generate-runtime-core-command-event-actions-proof.mjs";
const COMMAND_EVENT_ARTIFACT_PATH =
  "docs/proof/artifacts/runtime-core-0.1.0-command-event-actions.json";
const COMMAND_EVENT_PROOF_PATH = "docs/proof/RUNTIME-CORE-COMMAND-EVENT-ACTIONS.md";
const REACTIVE_REEVALUATION_AUDIT_PATH = "scripts/lib/runtime-core-reactive-reevaluation-proof.mjs";
const REACTIVE_REEVALUATION_TESTS_PATH = "tests/runtime-core-reactive-reevaluation.test.mjs";
const REACTIVE_REEVALUATION_GENERATE_PATH =
  "scripts/generate-runtime-core-reactive-reevaluation-proof.mjs";
const REACTIVE_REEVALUATION_ARTIFACT_PATH =
  "docs/proof/artifacts/runtime-core-0.1.0-reactive-reevaluation.json";
const REACTIVE_REEVALUATION_PROOF_PATH = "docs/proof/RUNTIME-CORE-REACTIVE-REEVALUATION.md";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeReactInteractionsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

async function bytes(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url));
}

async function buildWithMutation(relativePath, mutate) {
  const original = await source(relativePath);
  return buildRuntimeReactInteractionsEvidence({
    fileOverrides: { [relativePath]: mutate(original) },
  });
}

function escapedPattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function exactT04InlinePin(text, artifactPath) {
  const match = text.match(
    new RegExp("`" + escapedPattern(artifactPath) + "` `sha256:" + T04_SHA_PATTERN + "`", "u"),
  );
  assert.ok(match, `Missing exact M05-T04 inline pin for ${artifactPath}.`);
  return match[0];
}

function exactT04MatrixDetailPair(text) {
  const match = text.match(
    new RegExp(
      "`runtime-react-0\\.1\\.0-interactions\\.json`\\r?\\n`sha256:" + T04_SHA_PATTERN + "`\\.",
      "u",
    ),
  );
  assert.ok(match, "Missing exact M05-T04 Proof Matrix detail pin.");
  return match[0];
}

function replaceT04Pins(text, artifactSha256) {
  return text
    .replaceAll(PENDING_SHA, artifactSha256)
    .replace(
      new RegExp(
        "(`(?:docs/proof/artifacts/)?runtime-react-0\\.1\\.0-interactions\\.json`[ \\t]+`sha256:)" +
          T04_SHA_PATTERN +
          "(`)",
        "gu",
      ),
      `$1${artifactSha256}$2`,
    )
    .replace(
      new RegExp(
        "(`(?:docs/proof/artifacts/)?runtime-react-0\\.1\\.0-interactions\\.json`\\r?\\n`sha256:)" +
          T04_SHA_PATTERN +
          "(`)",
        "gu",
      ),
      `$1${artifactSha256}$2`,
    );
}

async function exactProofTexts(artifactSha256) {
  const [proofDocumentText, proofMatrixText, normativeCoverageText] = await Promise.all([
    source("docs/proof/RUNTIME-REACT-INTERACTIONS.md"),
    source("docs/proof/PROOF-MATRIX.md"),
    source("docs/proof/NORMATIVE-COVERAGE.md"),
  ]);
  return {
    proofDocumentText: replaceT04Pins(proofDocumentText, artifactSha256),
    proofMatrixText: replaceT04Pins(proofMatrixText, artifactSha256),
    normativeCoverageText: replaceT04Pins(normativeCoverageText, artifactSha256),
  };
}

function mutateJson(mutator) {
  return (text) => {
    const value = JSON.parse(text);
    mutator(value);
    return `${JSON.stringify(value, null, 2)}\n`;
  };
}

test("builds deterministic M05-T04 interaction evidence from the reviewed workspace", async () => {
  const built = await buildRuntimeReactInteractionsEvidence();
  assert.equal(built.artifact.task, "M05-T04");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifact.profile, "desen-runtime-react-interactions-v1");
  assert.equal(built.artifact.claim.exactTwoWayBindingParityBeforeElementCreation, true);
  assert.equal(built.artifact.claim.interactionAuthorityCommitScoped, true);
  assert.equal(built.artifact.claim.behaviorComponentCommandAuthority, false);
  assert.equal(
    built.artifact.successorPackage.identity.packageDigest,
    "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
  );
  assert.equal(built.artifact.successorPackage.distributionFiles, 80);
  assert.equal(built.artifact.successorPackage.framedEntries, 81);
  assert.equal(built.artifact.successorPackage.framedBytes, 252_072);
});

test("produces byte-identical evidence in two independent builds", async () => {
  const first = await buildRuntimeReactInteractionsEvidence();
  const second = await buildRuntimeReactInteractionsEvidence();
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.deepEqual(
    new Set(Object.values(first.artifact.successorPackage.interpretations)),
    new Set(["sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0"]),
  );
});

test("rejects every exact prerequisite artifact tamper", async () => {
  for (const [key, relativePath] of [
    [
      "referenceCapabilityArtifact",
      "docs/proof/artifacts/reference-catalog-web-capability-artifact.json",
    ],
    ["runtimeCoreAudit", "docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json"],
    ["resolvedStyles", "docs/proof/artifacts/runtime-react-0.1.0-resolved-styles.json"],
  ]) {
    const tampered = Buffer.from(await bytes(relativePath));
    tampered[tampered.length - 2] ^= 1;
    await assert.rejects(
      buildRuntimeReactInteractionsEvidence({ prerequisiteBytes: { [key]: tampered } }),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_PREREQUISITE_DRIFT"),
    );
  }
});

test("rejects core command attachment and public export drift", async () => {
  await assert.rejects(
    buildWithMutation(CORE_PATH, (text) =>
      text.replace(
        "const capturedResult = captureComponentCommandResult(result);\n      if (holder.activeInvocation",
        "const capturedResult = captureComponentCommandResult(result);\n      if (false && holder.activeInvocation",
      ),
    ),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_CORE_DRIFT"),
  );
  await assert.rejects(
    buildWithMutation(CORE_INDEX_PATH, (text) =>
      text.replace("  detachRuntimeHeadlessSessionComponentCommands,\n", ""),
    ),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_CORE_DRIFT"),
  );
  for (const [relativePath, mutate, code] of [
    [
      RUNTIME_JSON_SNAPSHOT_PATH,
      (text) => text.replace("createRuntimeResolutionSnapshot({", "createUnboundedSnapshot({"),
      "RUNTIME_REACT_INTERACTIONS_SNAPSHOT_SEAM_DRIFT",
    ],
    [
      CORE_README_PATH,
      (text) => text.replace("pure, bounded M04-T02 inert snapshot boundary", "raw JSON copier"),
      "RUNTIME_REACT_INTERACTIONS_SNAPSHOT_SEAM_DRIFT",
    ],
    [
      CORE_DIST_INDEX_PATH,
      (text) =>
        text.replace('export { snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";', ""),
      "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    ],
    [
      CORE_DIST_HEADLESS_PATH,
      (text) =>
        text.replace(
          "export function attachRuntimeHeadlessSessionComponentCommands(",
          "function attachRuntimeHeadlessSessionComponentCommands(",
        ),
      "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    ],
    [
      RUNTIME_DIST_REGISTRY_PATH,
      (text) =>
        text.replace(
          "export function readRuntimeReactAdapterRegistryAuthority(",
          "function readRuntimeReactAdapterRegistryAuthority(",
        ),
      "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    ],
  ]) {
    await assert.rejects(buildWithMutation(relativePath, mutate), hasEvidenceCode(code));
  }
});

test("rejects React commit-gating, event, command, and binding-parity drift", async () => {
  for (const [relativePath, mutate, code] of [
    [
      INTERACTIONS_PATH,
      (text) =>
        text.replace(
          "() => activateInteractionController(controller, authority),",
          "() => undefined,",
        ),
      "RUNTIME_REACT_INTERACTIONS_REACT_LIFECYCLE_DRIFT",
    ],
    [
      INTERACTIONS_PATH,
      (text) =>
        text.replaceAll(
          "snapshot: authority.snapshot,",
          "snapshot: readLatestSnapshot(authority.session),",
        ),
      "RUNTIME_REACT_INTERACTIONS_REACT_LIFECYCLE_DRIFT",
    ],
    [
      RENDERER_PATH,
      (text) =>
        text.replace(
          "if (parityFailure !== undefined) return parityFailure;",
          "void parityFailure;",
        ),
      "RUNTIME_REACT_INTERACTIONS_BINDING_PARITY_DRIFT",
    ],
    [
      RENDERER_PATH,
      (text) => text.replace("    prepared.sourceNodeId !== binding.sourceNodeId ||\n", ""),
      "RUNTIME_REACT_INTERACTIONS_BINDING_PARITY_DRIFT",
    ],
    [
      RENDERER_PATH,
      (text) => text.replace("        prepared.behaviorId === binding.behaviorId &&\n", ""),
      "RUNTIME_REACT_INTERACTIONS_BINDING_PARITY_DRIFT",
    ],
    [
      PARITY_TESTS_PATH,
      (text) => text.replace('  "behavior-behavior-id",\n', ""),
      "RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT",
    ],
  ]) {
    await assert.rejects(buildWithMutation(relativePath, mutate), hasEvidenceCode(code));
  }
});

test("rejects reference adapter inventory, focus command, and platform leakage", async () => {
  for (const [mutate, code] of [
    [
      (text) => text.replace("  alertReactAdapterRegistration,\n", ""),
      "RUNTIME_REACT_INTERACTIONS_REFERENCE_ADAPTER_DRIFT",
    ],
    [
      (text) => text.replace('commandName !== "focus"', 'commandName !== "select"'),
      "RUNTIME_REACT_INTERACTIONS_REFERENCE_ADAPTER_DRIFT",
    ],
    [
      (text) => text.replace("useEffect(() => {", "runAfterRender(() => {"),
      "RUNTIME_REACT_INTERACTIONS_REFERENCE_ADAPTER_DRIFT",
    ],
    [
      (text) => text.replace("onChange={(payload) => {", "onBlur={(payload) => {"),
      "RUNTIME_REACT_INTERACTIONS_REFERENCE_ADAPTER_DRIFT",
    ],
    [
      (text) =>
        text.replace(
          "  const catalogProps = props as unknown as ButtonCatalogProps;\n\n  return (",
          '  const catalogProps = props as unknown as ButtonCatalogProps;\n  const dispatch = interactions.dispatchEvent;\n  dispatch("press", Object.freeze({}));\n\n  return (',
        ),
      "RUNTIME_REACT_INTERACTIONS_REFERENCE_ADAPTER_DRIFT",
    ],
    [
      (text) =>
        text.replace(
          "  const catalogProps = props as unknown as ButtonCatalogProps;\n\n  return (",
          '  const catalogProps = props as unknown as ButtonCatalogProps;\n  const method = "dispatchEvent" as const;\n  interactions[method]("press", Object.freeze({}));\n\n  return (',
        ),
      "RUNTIME_REACT_INTERACTIONS_REFERENCE_ADAPTER_DRIFT",
    ],
    [
      (text) => `${text}\nconst leaked = document.body;\nvoid leaked;\n`,
      "RUNTIME_REACT_INTERACTIONS_REFERENCE_PLATFORM_LEAK",
    ],
  ]) {
    await assert.rejects(buildWithMutation(REFERENCE_ADAPTERS_PATH, mutate), hasEvidenceCode(code));
  }
  await assert.rejects(
    buildWithMutation(REFERENCE_CONSUMER_PATH, (text) =>
      text.replace(
        '"@desen/reference-catalog-web/react-adapters"',
        '"@desen/reference-catalog-web"',
      ),
    ),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_CONSUMER_DRIFT"),
  );
});

test("rejects focused test and compiler-negative inventory drift", async () => {
  for (const mutate of [
    (text) =>
      text.replace(
        'it("keeps server rendering callback-free',
        'it.skip("keeps server rendering callback-free',
      ),
    (text) =>
      text.replace(
        'describe("authenticated React interaction wiring"',
        'describe.skip("authenticated React interaction wiring"',
      ),
    (text) =>
      text.replace(
        'it("keeps server rendering callback-free',
        'it.concurrent.skip("keeps server rendering callback-free',
      ),
    (text) =>
      text.replace(
        'it("keeps server rendering callback-free',
        'xit("keeps server rendering callback-free',
      ),
    (text) =>
      text.replace(
        'without a commit", async () => {',
        'without a commit", { skip: true }, async () => {',
      ),
  ]) {
    await assert.rejects(
      buildWithMutation(INTERACTION_TESTS_PATH, mutate),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT"),
    );
  }
  await assert.rejects(
    buildWithMutation(REFERENCE_CONSUMER_TESTS_PATH, (text) =>
      text.replace(
        '"@desen/reference-catalog-web/react-adapters"',
        '"@desen/reference-catalog-web"',
      ),
    ),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT"),
  );
  for (const relativePath of [INTERACTION_TYPES_PATH, REFERENCE_TYPES_PATH]) {
    await assert.rejects(
      buildWithMutation(relativePath, (text) =>
        text.replace("@ts-expect-error", "expected compiler error"),
      ),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT"),
    );
  }
});

test("rejects successor package omission, addition, mutation, and Catalog tuple drift", async () => {
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({
      fileOverrides: { [DIST_ADAPTER_PATH]: null },
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_PACKAGE_TUPLE_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({
      fileOverrides: {
        "packages/reference-catalog-web/dist/react-adapters/unreviewed.js":
          "export const unreviewed = true;\n",
      },
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_PACKAGE_TUPLE_DRIFT"),
  );
  const mutatedDist = Buffer.from(await bytes(DIST_ADAPTER_PATH));
  mutatedDist[0] ^= 1;
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({
      fileOverrides: { [DIST_ADAPTER_PATH]: mutatedDist },
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_PACKAGE_TUPLE_DRIFT"),
  );
  await assert.rejects(
    buildWithMutation(CATALOG_PATH, (text) =>
      text.replace(
        "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
        "sha256:4ebfc6209d4874f3798009c72c634d2f65e60f8b59d4a517f269380a8cec6d9e",
      ),
    ),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_PACKAGE_TUPLE_DRIFT"),
  );
});

test("rejects traceability and historical compatibility drift", async () => {
  for (const [relativePath, mutate, code] of [
    [
      TASKS_PATH,
      (text) => text.replace("| M05-T04 | DONE", "| M05-T04 | NOT_STARTED"),
      "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    ],
    [
      PROJECT_STATUS_PATH,
      (text) =>
        text.replace(
          "- Overall implementation progress: `58 / 145 tasks complete (40%)`",
          "- Overall implementation progress: `55 / 145 tasks complete (38%)`",
        ),
      "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    ],
    [
      PROJECT_STATUS_PATH,
      (text) =>
        text.replace(
          "- Next implementation task: `M05-T05 — Stable keys and runtime-node ↔ source-node diagnostics`",
          "- Next implementation task: `M05-T02 — Resolved props and named slots`",
        ),
      "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    ],
    [
      PROJECT_STATUS_PATH,
      (text) =>
        text.replace(
          "20 compiler-negative cases, 18 root proof/mutation tests",
          "20 compiler-negative cases, 15 root proof/mutation tests",
        ),
      "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    ],
    [
      FINDINGS_PATH,
      (text) => text.replace("## PF-053 ", "## PF-053-MOVED "),
      "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    ],
    [
      COMPATIBILITY_PATH,
      (text) => text.replaceAll("immutable-task-time-artifact", "successor-rebuild"),
      "RUNTIME_REACT_INTERACTIONS_COMPATIBILITY_DRIFT",
    ],
    [
      PARITY_COMPATIBILITY_PATH,
      (text) => text.replace('new Set(["N-033", "N-034"])', 'new Set(["N-033"])'),
      "RUNTIME_REACT_INTERACTIONS_COMPATIBILITY_DRIFT",
    ],
    [
      PARITY_COMPATIBILITY_TESTS_PATH,
      (text) => text.replace('for (const id of ["N-033", "N-034"])', 'for (const id of ["N-033"])'),
      "RUNTIME_REACT_INTERACTIONS_COMPATIBILITY_DRIFT",
    ],
    [
      MATRIX_PATH,
      (text) => text.replace("current 80-file successor", "current 79-file successor"),
      "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    ],
    [
      MATRIX_PATH,
      (text) => text.replace("M03-T09, M05-T04, M09-T03", "M03-T09, M09-T03"),
      "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    ],
    [
      NORMATIVE_PATH,
      (text) => text.replace("M02-T09, M03-T09, M04-T14, M05-T04", "M02-T09, M03-T09, M04-T14"),
      "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    ],
    [
      MATRIX_PATH,
      (text) => {
        const pin = exactT04InlinePin(text, "runtime-react-0.1.0-interactions.json");
        return `${text
          .split("\n")
          .map((line) => (line.startsWith("| P-05 ") ? line.replace(pin, "") : line))
          .join("\n")}\n${pin}\n`;
      },
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
    ],
    [
      MATRIX_PATH,
      (text) => {
        const pin = exactT04InlinePin(text, "runtime-react-0.1.0-interactions.json");
        return `${text
          .split("\n")
          .map((line) => (line.startsWith("| P-06 ") ? line.replace(pin, "") : line))
          .join("\n")}\n${pin}\n`;
      },
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
    ],
    [
      NORMATIVE_PATH,
      (text) => {
        const pin = exactT04InlinePin(
          text,
          "docs/proof/artifacts/runtime-react-0.1.0-interactions.json",
        );
        return `${text.replace(pin, "")}\n${pin.replace("docs/proof/artifacts/", "")}\n`;
      },
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
    ],
    [
      MATRIX_PATH,
      (text) => {
        const pin = exactT04InlinePin(text, "runtime-react-0.1.0-interactions.json");
        return text.replace(pin, `${pin} ${pin}`);
      },
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
    ],
    [
      MATRIX_PATH,
      (text) => {
        const pin = exactT04InlinePin(text, "runtime-react-0.1.0-interactions.json");
        return text.replace(
          pin,
          pin.replace(
            "`runtime-react-0.1.0-interactions.json`",
            "`evil/runtime-react-0.1.0-interactions.json`",
          ),
        );
      },
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
    ],
    [
      NORMATIVE_PATH,
      (text) => {
        const pin = exactT04InlinePin(
          text,
          "docs/proof/artifacts/runtime-react-0.1.0-interactions.json",
        );
        return text.replace(
          pin,
          pin.replace(
            "`docs/proof/artifacts/runtime-react-0.1.0-interactions.json`",
            "`runtime-react-0.1.0-interactions.json`",
          ),
        );
      },
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
    ],
    [
      MATRIX_PATH,
      (text) => {
        const pair = exactT04MatrixDetailPair(text);
        return `${text.replace(`\n\n${pair}\n`, "\n")}\n\n${pair}\n`;
      },
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
    ],
  ]) {
    await assert.rejects(buildWithMutation(relativePath, mutate), hasEvidenceCode(code));
  }
});

test("rejects immutable SC-01 DTCG migration drift", async () => {
  for (const [relativePath, mutate] of [
    [
      SC01_DTCG_AUDIT_PATH,
      (text) =>
        text.replace(
          "1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6",
          "0".repeat(64),
        ),
    ],
    [
      SC01_DTCG_AUDIT_PATH,
      (text) => text.replace("immutable-task-time-artifact", "successor-rebuild"),
    ],
    [
      SC01_DTCG_AUDIT_PATH,
      (text) =>
        text.replace(
          "sha256:455025526691234369626b96281ba6522a0d90340adcfcd67ffea2d53be167fa",
          `sha256:${"0".repeat(64)}`,
        ),
    ],
    [
      SC01_DTCG_AUDIT_PATH,
      (text) =>
        text.replace(
          "return readHistoricalArtifact(options);",
          "return buildCurrentSuccessorEvidence(options);",
        ),
    ],
    [
      SC01_DTCG_AUDIT_PATH,
      (text) =>
        text.replace(
          "const artifact = parseHistoricalArtifact(artifactBytes);",
          "const artifact = buildCurrentSuccessorEvidence(artifactBytes);",
        ),
    ],
    [
      ROOT_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.scripts["verify:sc-01-dtcg-compatibility"] =
          "pnpm --filter @desen/reference-catalog-web... build && node scripts/verify-sc-01-dtcg.mjs";
      }),
    ],
    [
      SC01_DTCG_GENERATE_PATH,
      (text) => text.replace("compatibilityMode: result.compatibilityMode,", ""),
    ],
    [
      SC01_DTCG_TESTS_PATH,
      (text) =>
        text.replace(
          "reads byte-identical immutable task-time evidence twice",
          "rebuilds mutable successor evidence twice",
        ),
    ],
    [
      SC01_DTCG_PROFILE_PATH,
      (text) =>
        text.replace(
          "This receipt is not regenerated from the evolving `@desen/reference-catalog-web` package.",
          "This receipt is regenerated from the current package.",
        ),
    ],
    [
      SC01_COMPARISON_PATH,
      (text) => text.replace("immutable task-time receipt", "mutable successor receipt"),
    ],
    [
      STRATEGIC_VALIDATION_PATH,
      (text) =>
        text.replace(
          "Successor package bytes are not inputs",
          "Successor package bytes are inputs",
        ),
    ],
    [
      PROJECT_STATUS_PATH,
      (text) => text.replace("proof pins, hostile inputs", "successor rebuilds"),
    ],
    [
      MATRIX_PATH,
      (text) =>
        text.replace(
          "M05-T04 also migrates the historical SC-01 DTCG receipt",
          "M05-T04 rebuilds the historical SC-01 DTCG receipt",
        ),
    ],
  ]) {
    await assert.rejects(
      buildWithMutation(relativePath, mutate),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_DTCG_COMPATIBILITY_DRIFT"),
    );
  }

  const tamperedArtifact = Buffer.from(await bytes(SC01_DTCG_ARTIFACT_PATH));
  tamperedArtifact[tamperedArtifact.length - 2] ^= 1;
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({
      fileOverrides: { [SC01_DTCG_ARTIFACT_PATH]: tamperedArtifact },
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_DTCG_COMPATIBILITY_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({
      fileOverrides: { [SC01_DTCG_AUDIT_PATH]: null },
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_TRACKED_FILE_MISSING"),
  );
});

test("rejects immutable M04-T06 local-state migration drift", async () => {
  for (const [relativePath, mutate] of [
    [
      LOCAL_STATE_IDENTITY_AUDIT_PATH,
      (text) =>
        text.replace(
          "4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13",
          "0".repeat(64),
        ),
    ],
    [
      LOCAL_STATE_IDENTITY_AUDIT_PATH,
      (text) => text.replace("immutable-task-time-artifact", "current-runtime-rebuild"),
    ],
    [
      LOCAL_STATE_IDENTITY_AUDIT_PATH,
      (text) =>
        text.replace(
          "without consulting current source, documentation,",
          "by consulting current source and documentation,",
        ),
    ],
    [
      LOCAL_STATE_IDENTITY_AUDIT_PATH,
      (text) => text.replace('handle = await open(filePath, "r");', "handle = undefined;"),
    ],
    [
      LOCAL_STATE_IDENTITY_AUDIT_PATH,
      (text) => text.replace("if (byteLength !== exactBytes)", "if (false)"),
    ],
    [
      LOCAL_STATE_IDENTITY_AUDIT_PATH,
      (text) =>
        text.replace(
          "const bytes = await readBoundedHandle(handle, maximumBytes);",
          "const bytes = await handle.readFile();",
        ),
    ],
    [
      LOCAL_STATE_IDENTITY_AUDIT_PATH,
      (text) =>
        text.replace(
          "const authenticatedTracked = await buildRuntimeCoreLocalStateIdentityEvidence({",
          "const authenticatedTracked = built ?? buildRuntimeCoreLocalStateIdentityEvidence({",
        ),
    ],
    [
      ROOT_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.scripts["verify:runtime-core-local-state-identity"] =
          "pnpm --filter @desen/runtime-core... build && node scripts/verify-runtime-core-local-state-identity.mjs";
      }),
    ],
    [
      LOCAL_STATE_IDENTITY_GENERATE_PATH,
      (text) => text.replace("preserved: result.preserved,", ""),
    ],
    [
      LOCAL_STATE_IDENTITY_TESTS_PATH,
      (text) =>
        text.replace(
          "reads exact historical M04-T06 bytes and frozen semantics twice",
          "rebuilds current M04-T06 source twice",
        ),
    ],
    [
      LOCAL_STATE_IDENTITY_PROOF_PATH,
      (text) => text.replace("M04-T06 does not prove:", "M04-T06 proves all successor behavior:"),
    ],
    [
      MATRIX_PATH,
      (text) =>
        text.replace(
          "M04-T06 defines and proves a bounded, fail-closed surface-local state lifecycle",
          "M04-T06 is rebuilt from the current runtime source",
        ),
    ],
  ]) {
    await assert.rejects(
      buildWithMutation(relativePath, mutate),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_LOCAL_STATE_COMPATIBILITY_DRIFT"),
    );
  }

  const tamperedArtifact = Buffer.from(await bytes(LOCAL_STATE_IDENTITY_ARTIFACT_PATH));
  tamperedArtifact[tamperedArtifact.length - 2] ^= 1;
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({
      fileOverrides: { [LOCAL_STATE_IDENTITY_ARTIFACT_PATH]: tamperedArtifact },
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_LOCAL_STATE_COMPATIBILITY_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({
      fileOverrides: { [LOCAL_STATE_IDENTITY_AUDIT_PATH]: null },
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_TRACKED_FILE_MISSING"),
  );
});

test("rejects immutable M04-T12 command/event migration drift", async () => {
  for (const [relativePath, mutate] of [
    [
      COMMAND_EVENT_AUDIT_PATH,
      (text) =>
        text.replace(
          "8098184e5c25857a108e93dd4638556f1af0446fad9847b8ce44c9f8c2d79be4",
          "0".repeat(64),
        ),
    ],
    [
      COMMAND_EVENT_AUDIT_PATH,
      (text) => text.replace("immutable-task-time-artifact", "current-runtime-rebuild"),
    ],
    [
      COMMAND_EVENT_AUDIT_PATH,
      (text) =>
        text.replace(
          "return readHistoricalArtifact(options);",
          "return buildCurrentRuntimeEvidence(options);",
        ),
    ],
    [
      ROOT_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.scripts["verify:runtime-core-command-event-actions"] =
          "pnpm --filter @desen/runtime-core... build && node scripts/verify-runtime-core-command-event-actions.mjs";
      }),
    ],
    [COMMAND_EVENT_GENERATE_PATH, (text) => text.replace("preserved: result.preserved,", "")],
    [
      COMMAND_EVENT_TESTS_PATH,
      (text) =>
        text.replace(
          "reads byte-identical immutable task-time evidence twice",
          "rebuilds current runtime evidence twice",
        ),
    ],
    [
      COMMAND_EVENT_PROOF_PATH,
      (text) =>
        text.replace(
          "This is an immutable task-time receipt.",
          "This receipt is rebuilt from current runtime source.",
        ),
    ],
    [
      MATRIX_PATH,
      (text) =>
        text.replace(
          "N-034 remains `PLANNED` until concrete",
          "N-034 is permanently `PLANNED` despite current evidence",
        ),
    ],
  ]) {
    await assert.rejects(
      buildWithMutation(relativePath, mutate),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_COMMAND_EVENT_COMPATIBILITY_DRIFT"),
    );
  }

  const tamperedArtifact = Buffer.from(await bytes(COMMAND_EVENT_ARTIFACT_PATH));
  tamperedArtifact[tamperedArtifact.length - 2] ^= 1;
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({
      fileOverrides: { [COMMAND_EVENT_ARTIFACT_PATH]: tamperedArtifact },
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_COMMAND_EVENT_COMPATIBILITY_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({
      fileOverrides: { [COMMAND_EVENT_AUDIT_PATH]: null },
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_TRACKED_FILE_MISSING"),
  );
});

test("rejects immutable M04-T15 reactive reevaluation migration drift", async () => {
  for (const [relativePath, mutate] of [
    [
      REACTIVE_REEVALUATION_AUDIT_PATH,
      (text) =>
        text.replace(
          "7e412daf9e2e8f08f40a4b093430775414aa1df4a9b14d690d2bf45966cbec67",
          "0".repeat(64),
        ),
    ],
    [
      REACTIVE_REEVALUATION_AUDIT_PATH,
      (text) => text.replace("immutable-task-time-artifact", "current-runtime-rebuild"),
    ],
    [
      REACTIVE_REEVALUATION_AUDIT_PATH,
      (text) =>
        text.replace(
          "can never be rebuilt into historical M04-T15 evidence through this reader.",
          "is rebuilt into historical M04-T15 evidence through this reader.",
        ),
    ],
    [
      REACTIVE_REEVALUATION_AUDIT_PATH,
      (text) => text.replace('handle = await open(filePath, "r");', "handle = undefined;"),
    ],
    [
      ROOT_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.scripts["verify:runtime-core-reactive-reevaluation"] =
          "pnpm --filter @desen/runtime-core... build && node scripts/verify-runtime-core-reactive-reevaluation.mjs";
      }),
    ],
    [REACTIVE_REEVALUATION_GENERATE_PATH, (text) => text.replace("...result", "result")],
    [
      REACTIVE_REEVALUATION_TESTS_PATH,
      (text) =>
        text.replace(
          "two independent historical reactive builds preserve exact bytes and semantics",
          "two current reactive builds preserve exact bytes and semantics",
        ),
    ],
    [
      REACTIVE_REEVALUATION_PROOF_PATH,
      (text) =>
        text.replace(
          "task-time boundary, `N-003`, `N-034`, and `N-041` were `PLANNED`",
          "task-time boundary, `N-003` and `N-041` were `PLANNED`",
        ),
    ],
    [
      MATRIX_PATH,
      (text) =>
        text.replace(
          "At the T15 boundary, P-17 and P-18 remained `PARTIAL`, while N-003, N-034, and N-041 remained",
          "At the T15 boundary, P-17 and P-18 remained `PARTIAL`, while N-003 and N-041 remained",
        ),
    ],
  ]) {
    await assert.rejects(
      buildWithMutation(relativePath, mutate),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_REACTIVE_COMPATIBILITY_DRIFT"),
    );
  }

  const tamperedArtifact = Buffer.from(await bytes(REACTIVE_REEVALUATION_ARTIFACT_PATH));
  tamperedArtifact[tamperedArtifact.length - 2] ^= 1;
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({
      fileOverrides: { [REACTIVE_REEVALUATION_ARTIFACT_PATH]: tamperedArtifact },
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_REACTIVE_COMPATIBILITY_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({
      fileOverrides: { [REACTIVE_REEVALUATION_AUDIT_PATH]: null },
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_TRACKED_FILE_MISSING"),
  );
});

test("rejects package scripts and optimized CI inventory drift", async () => {
  for (const [relativePath, mutate] of [
    [
      REFERENCE_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.name = "@desen/reference-catalog-web-widened";
      }),
    ],
    [
      REFERENCE_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.private = false;
      }),
    ],
    [
      REFERENCE_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.type = "commonjs";
      }),
    ],
    [
      REFERENCE_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.sideEffects = true;
      }),
    ],
    [
      REFERENCE_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.scripts["test:react-adapters"] = "vitest run test/react-adapters.test.tsx";
      }),
    ],
    [
      RUNTIME_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.name = "@desen/runtime-react-widened";
      }),
    ],
    [
      RUNTIME_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.private = false;
      }),
    ],
    [
      RUNTIME_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.type = "commonjs";
      }),
    ],
    [
      RUNTIME_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.sideEffects = true;
      }),
    ],
    [
      RUNTIME_PACKAGE_PATH,
      mutateJson((manifest) => {
        delete manifest.exports["."];
      }),
    ],
    [
      RUNTIME_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.files = ["dist/index.js"];
      }),
    ],
    [
      RUNTIME_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.peerDependencies.react = "*";
      }),
    ],
    [
      CORE_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.name = "@desen/runtime-core-widened";
      }),
    ],
    [
      CORE_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.private = false;
      }),
    ],
    [
      CORE_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.type = "commonjs";
      }),
    ],
    [
      CORE_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.sideEffects = true;
      }),
    ],
    [
      CORE_PACKAGE_PATH,
      mutateJson((manifest) => {
        delete manifest.exports["."];
      }),
    ],
    [
      CORE_PACKAGE_PATH,
      mutateJson((manifest) => {
        manifest.files = [];
      }),
    ],
  ]) {
    await assert.rejects(
      buildWithMutation(relativePath, mutate),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_PACKAGE_WIRING_DRIFT"),
    );
  }
  await assert.rejects(
    buildWithMutation(ROOT_PACKAGE_PATH, (text) =>
      text.replace(
        '"verify:runtime-react-interactions"',
        '"verify:runtime-react-interactions-removed"',
      ),
    ),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_CI_DRIFT"),
  );
  await assert.rejects(
    buildWithMutation(CI_RUNNER_PATH, (text) =>
      text.replace('"runtime-react-interactions"', '"runtime-react-interactions-removed"'),
    ),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_CI_DRIFT"),
  );
});

test("verifies exact artifact bytes and final proof pins", async () => {
  const built = await buildRuntimeReactInteractionsEvidence();
  const proofTexts = await exactProofTexts(built.artifactSha256);
  const verified = await verifyRuntimeReactInteractionsEvidence({
    artifactBytes: built.artifactBytes,
    ...proofTexts,
  });
  assert.equal(verified.artifactSha256, built.artifactSha256);
  assert.equal(verified.framedEntries, 81);

  const tampered = Buffer.from(built.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    verifyRuntimeReactInteractionsEvidence({
      artifactBytes: tampered,
      ...proofTexts,
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyRuntimeReactInteractionsEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentText: proofTexts.proofDocumentText.replace(built.artifactSha256, "0".repeat(64)),
      proofMatrixText: proofTexts.proofMatrixText,
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT"),
  );
  await assert.rejects(
    verifyRuntimeReactInteractionsEvidence({
      artifactBytes: built.artifactBytes,
      ...proofTexts,
      normativeCoverageText: proofTexts.normativeCoverageText.replace(
        built.artifactSha256,
        "0".repeat(64),
      ),
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT"),
  );
});

test("rejects hostile, inherited, symbol, Proxy, and unknown options without hooks", async () => {
  let getterCalls = 0;
  let proxyCalls = 0;
  const accessor = Object.defineProperty({}, "fileOverrides", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return {};
    },
  });
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
    },
  );
  for (const options of [
    accessor,
    Object.create({ fileOverrides: {} }),
    { [Symbol("hidden")]: true },
    proxy,
    { fileOverrides: { "unknown/unconsumed.ts": "" } },
    { prerequisiteBytes: { unknownPrerequisite: Buffer.from("{}") } },
  ]) {
    await assert.rejects(
      buildRuntimeReactInteractionsEvidence(options),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID"),
    );
  }
  await assert.rejects(
    writeRuntimeReactInteractionsEvidence({
      beforeAtomicRename: new Proxy(() => undefined, {}),
    }),
    hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID"),
  );
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects unsafe proof and Proof Matrix paths", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t04-pins-"));
  const proofTarget = path.join(directory, "proof.md");
  const proofLink = path.join(directory, "proof-link.md");
  const matrixTarget = path.join(directory, "matrix.md");
  const matrixLink = path.join(directory, "matrix-link.md");
  const normativeTarget = path.join(directory, "normative.md");
  const normativeLink = path.join(directory, "normative-link.md");
  try {
    await writeFile(proofTarget, await source("docs/proof/RUNTIME-REACT-INTERACTIONS.md"));
    await writeFile(matrixTarget, await source("docs/proof/PROOF-MATRIX.md"));
    await writeFile(normativeTarget, await source("docs/proof/NORMATIVE-COVERAGE.md"));
    await symlink(proofTarget, proofLink);
    await symlink(matrixTarget, matrixLink);
    await symlink(normativeTarget, normativeLink);
    const built = await buildRuntimeReactInteractionsEvidence();
    const proofTexts = await exactProofTexts(built.artifactSha256);
    await assert.rejects(
      verifyRuntimeReactInteractionsEvidence({
        artifactBytes: built.artifactBytes,
        proofPath: proofLink,
        proofMatrixText: proofTexts.proofMatrixText,
      }),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_PROOF_UNSAFE"),
    );
    await assert.rejects(
      verifyRuntimeReactInteractionsEvidence({
        artifactBytes: built.artifactBytes,
        proofDocumentText: proofTexts.proofDocumentText,
        proofMatrixPath: matrixLink,
      }),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_PROOF_UNSAFE"),
    );
    await assert.rejects(
      verifyRuntimeReactInteractionsEvidence({
        artifactBytes: built.artifactBytes,
        proofDocumentText: proofTexts.proofDocumentText,
        proofMatrixText: proofTexts.proofMatrixText,
        normativeCoveragePath: normativeLink,
      }),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_PROOF_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic writer rejects symlink destinations and temporary-byte substitution", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t04-write-"));
  const target = path.join(directory, "target.json");
  const symlinkDestination = path.join(directory, "artifact-link.json");
  const tamperDestination = path.join(directory, "artifact-tamper.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, symlinkDestination);
    await assert.rejects(
      writeRuntimeReactInteractionsEvidence({ artifactPath: symlinkDestination }),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_ARTIFACT_UNSAFE"),
    );
    await assert.rejects(
      writeRuntimeReactInteractionsEvidence({
        artifactPath: tamperDestination,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("RUNTIME_REACT_INTERACTIONS_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
