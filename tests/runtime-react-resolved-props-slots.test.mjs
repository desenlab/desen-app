import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeReactResolvedPropsSlotsEvidenceError,
  buildRuntimeReactResolvedPropsSlotsEvidence,
  verifyRuntimeReactResolvedPropsSlotsEvidence,
  writeRuntimeReactResolvedPropsSlotsEvidence,
} from "../scripts/lib/runtime-react-resolved-props-slots-proof.mjs";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeReactResolvedPropsSlotsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function finalReferences(artifactSha256) {
  return Object.freeze({
    proofDocumentText: [
      "# Test proof",
      "",
      "## Evidence artifact",
      "",
      "`docs/proof/artifacts/runtime-react-0.1.0-resolved-props-slots.json`",
      `\`sha256:${artifactSha256}\`.`,
      "",
    ].join("\n"),
    proofMatrixText: [
      "# Test matrix",
      "",
      "## M05-T02",
      "",
      "`runtime-react-0.1.0-resolved-props-slots.json`",
      `\`sha256:${artifactSha256}\`.`,
      "",
    ].join("\n"),
  });
}

test("accepts tracked deterministic M05-T02 resolved-props and named-slots evidence", async () => {
  const result = await verifyRuntimeReactResolvedPropsSlotsEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.runtimeExports, 5);
  assert.equal(result.typeExports, 29);
  assert.equal(result.failureCodes, 20);
  assert.equal(result.packageTests, 38);
  assert.equal(result.rootMutationTests, 14);
  assert.equal(result.trackedFiles, 109);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent M05-T02 evidence builds are byte-identical", async () => {
  const first = await buildRuntimeReactResolvedPropsSlotsEvidence();
  const second = await buildRuntimeReactResolvedPropsSlotsEvidence();
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.architecture.package, "@desen/runtime-react");
  assert.equal(first.artifact.traceability.task.id, "M05-T02");
  assert.equal(first.artifact.catalogAuthority.rawMountReturnsExactRetainedCatalogSet, true);
  assert.equal(first.artifact.receivingBudget.actualSchemaInterpreterWorkBudgeted, true);
  assert.equal(first.artifact.receivingBudget.preparedSlotContractsBudgeted, true);
  assert.equal(Object.hasOwn(first.artifact.architecture, "task"), false);
  assert.equal(Object.hasOwn(first.artifact.traceability, "package"), false);
  const trackedPaths = new Set(first.artifact.evidence.trackedFiles.map(({ path }) => path));
  for (const requiredPath of [
    "package.json",
    "scripts/generate-runtime-react-resolved-props-slots-proof.mjs",
    "scripts/lib/runtime-react-resolved-props-slots-proof.mjs",
    "scripts/run-ci-quality-gate.mjs",
    "scripts/test/ci-quality-gate.test.mjs",
    "scripts/verify-runtime-react-resolved-props-slots.mjs",
    "tests/runtime-react-resolved-props-slots.test.mjs",
  ]) {
    assert.equal(trackedPaths.has(requiredPath), true, `${requiredPath} must be authenticated`);
  }
});

test("rejects one-byte-tampered M05-T02 artifact bytes", async () => {
  const built = await buildRuntimeReactResolvedPropsSlotsEvidence();
  const tampered = Buffer.from(built.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    verifyRuntimeReactResolvedPropsSlotsEvidence({
      artifactBytes: tampered,
      ...finalReferences(built.artifactSha256),
    }),
    hasEvidenceCode("RESOLVED_PROPS_SLOTS_ARTIFACT_DRIFT"),
  );
});

test("rejects every exact prerequisite artifact tamper", async () => {
  const prerequisites = {
    executionContracts: "docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
    g04AuditHardening: "docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json",
    adapterRegistry: "docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json",
  };
  for (const [key, relativePath] of Object.entries(prerequisites)) {
    const tampered = Buffer.from(await source(relativePath));
    tampered[0] ^= 1;
    await assert.rejects(
      buildRuntimeReactResolvedPropsSlotsEvidence({
        prerequisiteBytes: { [key]: tampered },
      }),
      hasEvidenceCode("RESOLVED_PROPS_SLOTS_PREREQUISITE_DRIFT"),
    );
  }
});

test("rejects raw-plan, session, Catalog, or validator authority bypasses", async () => {
  const renderPath = "packages/runtime-react/src/render-plan.tsx";
  const render = await source(renderPath);
  const cases = [
    [
      render.replace(
        "readonly registry: RuntimeReactAdapterRegistryHandle;",
        "readonly registry: RuntimeReactAdapterRegistryHandle;\n  readonly plan: unknown;",
      ),
      "RESOLVED_PROPS_SLOTS_RENDERER_BYPASS",
    ],
    [
      render.replaceAll(
        "authenticateRuntimeHeadlessSessionAdapterAuthority(",
        "bypassRuntimeHeadlessSessionAdapterAuthority(",
      ),
      "RESOLVED_PROPS_SLOTS_RENDERER_BYPASS",
    ],
    [
      render.replace(
        "catalogSet: captured.catalogSet as DesenValidatedExecutionCatalogSet,",
        "catalogSet: Object.freeze([]) as DesenValidatedExecutionCatalogSet,",
      ),
      "RESOLVED_PROPS_SLOTS_RENDERER_BYPASS",
    ],
    [
      render.replaceAll("validateDesenResolvedAdapterProps(", "bypassDesenResolvedAdapterProps("),
      "RESOLVED_PROPS_SLOTS_RENDERER_BYPASS",
    ],
  ];
  for (const [mutated, code] of cases) {
    await assert.rejects(
      buildRuntimeReactResolvedPropsSlotsEvidence({
        fileOverrides: { [renderPath]: mutated },
      }),
      hasEvidenceCode(code),
    );
  }
});

test("rejects component-adapter access to raw behavior plans", async () => {
  const registryPath = "packages/runtime-react/src/registry.ts";
  const registry = await source(registryPath);
  const mutated = registry.replace(
    "readonly props: RuntimeJsonObject;",
    "readonly props: RuntimeJsonObject;\n  readonly behaviors: readonly unknown[];",
  );
  await assert.rejects(
    buildRuntimeReactResolvedPropsSlotsEvidence({
      fileOverrides: { [registryPath]: mutated },
    }),
    hasEvidenceCode("RESOLVED_PROPS_SLOTS_ADAPTER_LEAK"),
  );
});

test("rejects a per-call reset of the shared receiving-schema budget", async () => {
  const validatorPath = "packages/validator/src/execution-contract-validation.ts";
  const validator = await source(validatorPath);
  const mutated = validator.replaceAll(
    "authority.schemaBudget",
    "createSchemaContractEvaluationBudget()",
  );
  await assert.rejects(
    buildRuntimeReactResolvedPropsSlotsEvidence({
      fileOverrides: { [validatorPath]: mutated },
    }),
    hasEvidenceCode("RESOLVED_PROPS_SLOTS_VALIDATOR_BYPASS"),
  );
});

test("rejects named-slot fallback guessing or private React inspection", async () => {
  const renderPath = "packages/runtime-react/src/render-plan.tsx";
  const render = await source(renderPath);
  for (const mutated of [
    `${render}\nvoid React.Children.toArray([]);\n`,
    `${render}\nconst fallbackComponent = () => null;\n`,
  ]) {
    await assert.rejects(
      buildRuntimeReactResolvedPropsSlotsEvidence({
        fileOverrides: { [renderPath]: mutated },
      }),
      hasEvidenceCode(
        mutated.includes("React.Children")
          ? "RESOLVED_PROPS_SLOTS_PRIVATE_STRUCTURE_DRIFT"
          : "RESOLVED_PROPS_SLOTS_RENDERER_BYPASS",
      ),
    );
  }
});

test("rejects loss of exact immutable validator diagnostics", async () => {
  const renderPath = "packages/runtime-react/src/render-plan.tsx";
  const render = await source(renderPath);
  const mutated = render.replace(
    "channel,\n      diagnostics,",
    "channel,\n      diagnostics: EMPTY_DIAGNOSTICS,",
  );
  await assert.rejects(
    buildRuntimeReactResolvedPropsSlotsEvidence({
      fileOverrides: { [renderPath]: mutated },
    }),
    hasEvidenceCode("RESOLVED_PROPS_SLOTS_RENDERER_BYPASS"),
  );
});

test("rejects import, public export, or TSDoc evidence hiding", async () => {
  const registryPath = "packages/runtime-react/src/registry.ts";
  const indexPath = "packages/runtime-react/src/index.ts";
  const renderPath = "packages/runtime-react/src/render-plan.tsx";
  const registry = await source(registryPath);
  const index = await source(indexPath);
  const render = await source(renderPath);
  const cases = [
    [{ [renderPath]: `import "react-dom";\n${render}` }, "RESOLVED_PROPS_SLOTS_IMPORT_DRIFT"],
    [
      { [indexPath]: `${index}\nexport const unexpectedAuthority = 1;\n` },
      "RESOLVED_PROPS_SLOTS_EXPORT_DRIFT",
    ],
    [
      {
        [registryPath]: registry.replace(
          "/** Public props received by a trusted component adapter component.",
          "/* Public props received by a trusted component adapter component.",
        ),
      },
      "RESOLVED_PROPS_SLOTS_TSDOC_DRIFT",
    ],
  ];
  for (const [fileOverrides, code] of cases) {
    await assert.rejects(
      buildRuntimeReactResolvedPropsSlotsEvidence({ fileOverrides }),
      hasEvidenceCode(code),
    );
  }
});

test("rejects skipped, indirect, duplicated, or unchecked focused tests", async () => {
  const testPath = "packages/runtime-react/test/resolved-props-slots.test.tsx";
  const typePath = "packages/runtime-react/test/resolved-props-slots.types.ts";
  const focused = await source(testPath);
  const types = await source(typePath);
  for (const fileOverrides of [
    { [testPath]: focused.replace("  it(", "  it.skip(") },
    {
      [testPath]: focused.replace(
        "delivers complete validated component props without applying schema defaults",
        "renders from raw mount-returned Catalog authority and rejects foreign authority",
      ),
    },
    { [typePath]: types.replace("@ts-expect-error", "@ts-ignore") },
  ]) {
    await assert.rejects(
      buildRuntimeReactResolvedPropsSlotsEvidence({ fileOverrides }),
      hasEvidenceCode("RESOLVED_PROPS_SLOTS_TEST_INVENTORY_DRIFT"),
    );
  }
});

test("rejects moved, duplicated, pending, or mismatched proof pins", async () => {
  const built = await buildRuntimeReactResolvedPropsSlotsEvidence();
  const valid = finalReferences(built.artifactSha256);
  const cases = [
    {
      proofDocumentText: valid.proofDocumentText.replace(
        "## Evidence artifact",
        "## Moved artifact",
      ),
      proofMatrixText: valid.proofMatrixText,
    },
    {
      proofDocumentText: `${valid.proofDocumentText}\n\`docs/proof/artifacts/runtime-react-0.1.0-resolved-props-slots.json\`\n`,
      proofMatrixText: valid.proofMatrixText,
    },
    {
      proofDocumentText: valid.proofDocumentText.replace(built.artifactSha256, PENDING_REFERENCE),
      proofMatrixText: valid.proofMatrixText,
    },
    {
      proofDocumentText: valid.proofDocumentText,
      proofMatrixText: valid.proofMatrixText.replace(built.artifactSha256, "0".repeat(64)),
    },
  ];
  for (const references of cases) {
    await assert.rejects(
      verifyRuntimeReactResolvedPropsSlotsEvidence({
        artifactBytes: built.artifactBytes,
        ...references,
      }),
      hasEvidenceCode("RESOLVED_PROPS_SLOTS_PROOF_PIN_DRIFT"),
    );
  }
});

const PENDING_REFERENCE = "[PENDING_FINAL_ARTIFACT_SHA256]";

test("atomic M05-T02 writer rejects an existing symlink destination", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t02-proof-"));
  const target = path.join(temporaryDirectory, "target.json");
  const destination = path.join(temporaryDirectory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    await assert.rejects(
      writeRuntimeReactResolvedPropsSlotsEvidence({ artifactPath: destination }),
      hasEvidenceCode("RESOLVED_PROPS_SLOTS_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("atomic M05-T02 writer rejects temporary-byte tampering before rename", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t02-proof-"));
  const destination = path.join(temporaryDirectory, "artifact.json");
  const preparedEvidence = await buildRuntimeReactResolvedPropsSlotsEvidence();
  try {
    await assert.rejects(
      writeRuntimeReactResolvedPropsSlotsEvidence({
        artifactPath: destination,
        preparedEvidence,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("RESOLVED_PROPS_SLOTS_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
