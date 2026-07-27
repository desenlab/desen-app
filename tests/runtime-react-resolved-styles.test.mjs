import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeReactResolvedStylesEvidenceError,
  buildRuntimeReactResolvedStylesEvidence,
  verifyRuntimeReactResolvedStylesEvidence,
  writeRuntimeReactResolvedStylesEvidence,
} from "../scripts/lib/runtime-react-resolved-styles-proof.mjs";

const PENDING_SHA = "[PENDING_FINAL_ARTIFACT_SHA256]";
const RENDER_PATH = "packages/runtime-react/src/render-plan.tsx";
const REGISTRY_PATH = "packages/runtime-react/src/registry.ts";
const INDEX_PATH = "packages/runtime-react/src/index.ts";
const VALIDATOR_PATH = "packages/validator/src/execution-contract-validation.ts";
const STYLE_TEST_PATH = "packages/runtime-react/test/style-parts-states.test.tsx";
const STYLE_TYPES_PATH = "packages/runtime-react/test/style-parts-states.types.ts";
const VALIDATOR_TYPES_PATH = "packages/validator/test/resolved-adapter-contracts.types.ts";
const TASKS_PATH = "docs/plan/TASKS.md";
const NORMATIVE_PATH = "docs/proof/NORMATIVE-COVERAGE.md";
const FINDINGS_PATH = "docs/plan/PROTOCOL-FINDINGS.md";
const T02_COMPATIBILITY_PATH = "scripts/lib/runtime-react-resolved-props-slots-proof.mjs";
const ROOT_PACKAGE_PATH = "package.json";
const CI_RUNNER_PATH = "scripts/run-ci-quality-gate.mjs";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeReactResolvedStylesEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

async function buildWithMutation(relativePath, mutate) {
  const original = await source(relativePath);
  return buildRuntimeReactResolvedStylesEvidence({
    fileOverrides: { [relativePath]: mutate(original) },
  });
}

async function exactProofTexts(artifactSha256) {
  const [proof, matrix] = await Promise.all([
    source("docs/proof/RUNTIME-REACT-RESOLVED-STYLES.md"),
    source("docs/proof/PROOF-MATRIX.md"),
  ]);
  return {
    proofDocumentText: proof.replaceAll(PENDING_SHA, artifactSha256),
    proofMatrixText: matrix.replaceAll(PENDING_SHA, artifactSha256),
  };
}

test("builds deterministic M05-T03 semantic-style evidence from the reviewed workspace", async () => {
  const built = await buildRuntimeReactResolvedStylesEvidence();
  assert.equal(built.artifact.task, "M05-T03");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifact.claim.resolvedStyleReceivingBoundary, true);
  assert.equal(built.artifact.claim.stateActivationOwner, "capability-adapter");
  assert.equal(built.artifact.semanticStyle.invalidStyleDeliveredToAdapter, false);
});

test("two independent M05-T03 evidence builds are byte-identical", async () => {
  const first = await buildRuntimeReactResolvedStylesEvidence();
  const second = await buildRuntimeReactResolvedStylesEvidence();
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects every exact prerequisite artifact tamper", async () => {
  for (const [key, relativePath] of [
    ["componentContracts", "docs/proof/artifacts/protocol-0.1.0-component-contracts.json"],
    [
      "variantStyleEvaluation",
      "docs/proof/artifacts/runtime-core-0.1.0-variant-style-evaluation.json",
    ],
    ["resolvedPropsSlots", "docs/proof/artifacts/runtime-react-0.1.0-resolved-props-slots.json"],
  ]) {
    const bytes = Buffer.from(await readFile(new URL(`../${relativePath}`, import.meta.url)));
    bytes[bytes.length - 2] ^= 1;
    await assert.rejects(
      buildRuntimeReactResolvedStylesEvidence({ prerequisiteBytes: { [key]: bytes } }),
      hasEvidenceCode("RESOLVED_STYLES_PREREQUISITE_DRIFT"),
    );
  }
});

test("rejects removal of component style receiving validation", async () => {
  await assert.rejects(
    buildWithMutation(RENDER_PATH, (text) =>
      text.replace("validateDesenResolvedAdapterStyle(", "validateRemovedStyle("),
    ),
    hasEvidenceCode("RESOLVED_STYLES_IMPLEMENTATION_DRIFT"),
  );
});

test("rejects behavior style validation or exact capability-category drift", async () => {
  await assert.rejects(
    buildWithMutation(RENDER_PATH, (text) =>
      text.replaceAll(
        '{ capabilityKind: "behavior", capabilityId },',
        '{ capabilityKind: "component", capabilityId },',
      ),
    ),
    hasEvidenceCode("RESOLVED_STYLES_IMPLEMENTATION_DRIFT"),
  );
});

test("rejects delivery of captured rather than validated component or behavior style", async () => {
  await assert.rejects(
    buildWithMutation(RENDER_PATH, (text) =>
      text.replace("style: validatedStyle.value,", "style: capturedStyle,"),
    ),
    hasEvidenceCode("RESOLVED_STYLES_IMPLEMENTATION_DRIFT"),
  );
});

test("rejects weakening the public readonly state-part-property style hierarchy", async () => {
  await assert.rejects(
    buildWithMutation(REGISTRY_PATH, (text) =>
      text.replace(
        "export type RuntimeReactSemanticStyle = DesenResolvedAdapterStyle;",
        "export type RuntimeReactSemanticStyle = RuntimeJsonObject;",
      ),
    ),
    hasEvidenceCode("RESOLVED_STYLES_PUBLIC_STYLE_DRIFT"),
  );
});

test("rejects removal of precomputed Catalog visual-state or style-part authority", async () => {
  await assert.rejects(
    buildWithMutation(VALIDATOR_PATH, (text) =>
      text.replace("preparedVisualStates: visualStates,", ""),
    ),
    hasEvidenceCode("RESOLVED_STYLES_VALIDATOR_DRIFT"),
  );
});

test("rejects a per-style schema-budget reset", async () => {
  await assert.rejects(
    buildWithMutation(VALIDATOR_PATH, (text) =>
      text.replace("prepared.authority.schemaBudget,", "createSchemaContractEvaluationBudget(),"),
    ),
    hasEvidenceCode("RESOLVED_STYLES_VALIDATOR_DRIFT"),
  );
});

test("rejects renderer-owned state selection or platform-private style authority", async () => {
  await assert.rejects(
    buildWithMutation(REGISTRY_PATH, (text) => `${text}\nconst activeState = "base";\n`),
    hasEvidenceCode("RESOLVED_STYLES_PRIVATE_AUTHORITY"),
  );
});

test("rejects skipped, renamed, indirect, or duplicate focused style tests", async () => {
  await assert.rejects(
    buildWithMutation(STYLE_TEST_PATH, (text) =>
      text.replace(
        'it("delivers complete immutable base and declared-state maps',
        'it.skip("delivers complete immutable base and declared-state maps',
      ),
    ),
    hasEvidenceCode("RESOLVED_STYLES_TEST_INVENTORY_DRIFT"),
  );
});

test("rejects runtime or validator compiler-negative inventory drift", async () => {
  for (const relativePath of [STYLE_TYPES_PATH, VALIDATOR_TYPES_PATH]) {
    await assert.rejects(
      buildWithMutation(relativePath, (text) =>
        text.replace("@ts-expect-error", "expected compiler error"),
      ),
      hasEvidenceCode("RESOLVED_STYLES_TEST_INVENTORY_DRIFT"),
    );
  }
});

test("rejects task, normative, finding, or canonical traceability drift", async () => {
  for (const [relativePath, mutate] of [
    [TASKS_PATH, (text) => text.replace("| M05-T03 | DONE", "| M05-T03 | NOT_STARTED")],
    [NORMATIVE_PATH, (text) => text.replace("| N-029 ", "| N-029-MOVED ")],
    [FINDINGS_PATH, (text) => text.replace("## PF-052 ", "## PF-052-MOVED ")],
  ]) {
    await assert.rejects(
      buildWithMutation(relativePath, mutate),
      hasEvidenceCode("RESOLVED_STYLES_TRACEABILITY_DRIFT"),
    );
  }
});

test("rejects weakening the immutable M05-T02 compatibility migration", async () => {
  await assert.rejects(
    buildWithMutation(T02_COMPATIBILITY_PATH, (text) =>
      text.replaceAll("immutable-task-time-artifact", "successor-rebuild"),
    ),
    hasEvidenceCode("RESOLVED_STYLES_COMPATIBILITY_DRIFT"),
  );
});

test("rejects public export, TSDoc, or import-boundary drift", async () => {
  for (const [relativePath, mutate] of [
    [INDEX_PATH, (text) => text.replace("  RuntimeReactStyleProperties,\n", "")],
    [REGISTRY_PATH, (text) => `import type { ReactElement } from "unreviewed-framework";\n${text}`],
  ]) {
    await assert.rejects(buildWithMutation(relativePath, mutate), (error) =>
      hasEvidenceCode(
        relativePath === INDEX_PATH
          ? "RESOLVED_STYLES_EXPORT_DRIFT"
          : "RESOLVED_STYLES_IMPORT_DRIFT",
      )(error),
    );
  }
});

test("rejects package, optimized-CI, artifact-byte, or final proof-pin drift", async () => {
  await assert.rejects(
    buildWithMutation(ROOT_PACKAGE_PATH, (text) =>
      text.replace(
        '"verify:runtime-react-resolved-styles"',
        '"verify:runtime-react-resolved-styles-removed"',
      ),
    ),
    hasEvidenceCode("RESOLVED_STYLES_CI_DRIFT"),
  );
  await assert.rejects(
    buildWithMutation(CI_RUNNER_PATH, (text) =>
      text.replace('"runtime-react-resolved-styles"', '"runtime-react-styles-removed"'),
    ),
    hasEvidenceCode("RESOLVED_STYLES_CI_DRIFT"),
  );

  const built = await buildRuntimeReactResolvedStylesEvidence();
  const proofTexts = await exactProofTexts(built.artifactSha256);
  const verified = await verifyRuntimeReactResolvedStylesEvidence({
    artifactBytes: built.artifactBytes,
    ...proofTexts,
  });
  assert.equal(verified.artifactSha256, built.artifactSha256);

  const tampered = Buffer.from(built.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    verifyRuntimeReactResolvedStylesEvidence({
      artifactBytes: tampered,
      ...proofTexts,
    }),
    hasEvidenceCode("RESOLVED_STYLES_ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyRuntimeReactResolvedStylesEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentText: proofTexts.proofDocumentText.replace(built.artifactSha256, "0".repeat(64)),
      proofMatrixText: proofTexts.proofMatrixText,
    }),
    hasEvidenceCode("RESOLVED_STYLES_PROOF_PIN_DRIFT"),
  );
});

test("rejects accessor, inherited, symbol, Proxy, and unknown override options without hooks", async () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "fileOverrides", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return {};
    },
  });
  for (const options of [
    accessor,
    Object.create({ fileOverrides: {} }),
    { [Symbol("hidden")]: true },
    new Proxy({}, {}),
    { fileOverrides: { "unknown/unconsumed.ts": "" } },
    { prerequisiteBytes: { unknownPrerequisite: Buffer.from("{}") } },
  ]) {
    await assert.rejects(
      buildRuntimeReactResolvedStylesEvidence(options),
      hasEvidenceCode("RESOLVED_STYLES_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
});

test("atomic writer rejects symlink destinations and temporary-byte substitution", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t03-write-"));
  const target = path.join(directory, "target.json");
  const symlinkDestination = path.join(directory, "artifact-link.json");
  const tamperDestination = path.join(directory, "artifact-tamper.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, symlinkDestination);
    await assert.rejects(
      writeRuntimeReactResolvedStylesEvidence({ artifactPath: symlinkDestination }),
      hasEvidenceCode("RESOLVED_STYLES_ARTIFACT_UNSAFE"),
    );
    await assert.rejects(
      writeRuntimeReactResolvedStylesEvidence({
        artifactPath: tamperDestination,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("RESOLVED_STYLES_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
