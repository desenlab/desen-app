import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ProtocolBindingContractsEvidenceError,
  buildProtocolBindingContractsEvidence,
  verifyProtocolBindingContracts,
  writeProtocolBindingContractsEvidence,
} from "../scripts/lib/protocol-binding-contracts-proof.mjs";

const VALID_SOURCE = JSON.parse(
  await readFile(
    new URL(
      "../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ProtocolBindingContractsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

function stripFirstObligation(result) {
  return Object.freeze({
    ...result,
    obligations: Object.freeze((result.obligations ?? []).slice(1)),
  });
}

test("accepts exact deterministic M02-T10 binding-contract evidence", async () => {
  const result = await verifyProtocolBindingContracts();

  assert.equal(result.result, "PASS");
  assert.equal(result.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(result.schemaFamilies, 10);
  assert.equal(result.schemaConstraints, 300);
  assert.equal(result.proseRules, 12);
  assert.equal(result.ownedCoreDiagnostics, 5);
  assert.equal(result.conformanceResponsibilities, 0);
  assert.equal(result.mandatoryClauses, 0);
  assert.equal(result.officialT10Invalid, 0);
  assert.equal(result.projectMutationGoldens, 48);
  assert.equal(result.obligationKinds, 4);
  assert.equal(result.examples, 5);
  assert.equal(
    result.artifactSha256,
    "2ffa1b874bae23df8ba3e0e0334b3f0b6739ec4dfd6acc9e2aabf1c87ce9c39c",
  );
});

test("default evidence writer preserves immutable task-time M02-T10 bytes", async () => {
  const artifactPath = new URL(
    "../docs/proof/artifacts/protocol-0.1.0-binding-contracts.json",
    import.meta.url,
  );
  const before = await readFile(artifactPath);
  const result = await writeProtocolBindingContractsEvidence();
  const after = await readFile(artifactPath);

  assert.deepEqual(after, before);
  assert.deepEqual(result.artifactBytes, before);
});

test("two independent binding evidence builds are byte-identical", async () => {
  const first = await buildProtocolBindingContractsEvidence();
  const second = await buildProtocolBindingContractsEvidence();

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("rejects a current rebuild and one-byte-tampered historical binding evidence", async () => {
  const current = await buildProtocolBindingContractsEvidence();
  await assert.rejects(
    verifyProtocolBindingContracts({ artifactBytes: current.artifactBytes }),
    hasEvidenceCode("BINDING_ARTIFACT_DRIFT"),
  );

  const historical = await readFile(
    new URL("../docs/proof/artifacts/protocol-0.1.0-binding-contracts.json", import.meta.url),
  );
  const tampered = Buffer.from(historical);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyProtocolBindingContracts({ artifactBytes: tampered }),
    hasEvidenceCode("BINDING_ARTIFACT_DRIFT"),
  );
});

test("rejects T10 trace, false BCP 14 ownership, finding, and source drift", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-binding-review-"));
  context.after(() => rm(directory, { force: true, recursive: true }));

  const trace = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  trace.schemaFamilies.find(({ id }) => id === "SC-035").expectedConstraints = 13;
  const tracePath = path.join(directory, "trace.json");
  await writeFile(tracePath, `${JSON.stringify(trace)}\n`);
  await assert.rejects(
    buildProtocolBindingContractsEvidence({ tracePath, verifySnapshot: false }),
    hasEvidenceCode("BINDING_TRACE_DRIFT"),
  );

  const normative = await readFile(
    new URL("../docs/proof/NORMATIVE-COVERAGE.md", import.meta.url),
    "utf8",
  );
  const changedNormative = normative.replace(/^(\| N-001 \|.*?\| )M12-T08(\s+\|)/mu, "$1M02-T10$2");
  assert.notEqual(changedNormative, normative);
  const normativePath = path.join(directory, "normative.md");
  await writeFile(normativePath, changedNormative);
  await assert.rejects(
    buildProtocolBindingContractsEvidence({
      normativeCoveragePath: normativePath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("BINDING_NORMATIVE_DRIFT"),
  );

  const findings = await readFile(
    new URL("../docs/plan/PROTOCOL-FINDINGS.md", import.meta.url),
    "utf8",
  );
  const changedFindings = findings.replace(
    "M02-T10 uses a single-pass linear parser.",
    "M02-T10 uses an unspecified parser.",
  );
  assert.notEqual(changedFindings, findings);
  const findingsPath = path.join(directory, "findings.md");
  await writeFile(findingsPath, changedFindings);
  await assert.rejects(
    buildProtocolBindingContractsEvidence({ findingsPath, verifySnapshot: false }),
    hasEvidenceCode("BINDING_FINDING_DRIFT"),
  );

  const source = await readFile(
    new URL("../packages/validator/src/binding-contract-validation.ts", import.meta.url),
    "utf8",
  );
  const changedSource = source.replace(
    "const settlementScope = withoutEvent(work.scope);",
    "const settlementScope = work.scope;",
  );
  assert.notEqual(changedSource, source);
  const bindingSourcePath = path.join(directory, "binding-contract-validation.ts");
  await writeFile(bindingSourcePath, changedSource);
  await assert.rejects(
    buildProtocolBindingContractsEvidence({ bindingSourcePath, verifySnapshot: false }),
    hasEvidenceCode("BINDING_SOURCE_PROFILE_DRIFT"),
  );
});

test("rejects a one-field-tampered M02-T09 prerequisite artifact", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-binding-prerequisite-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifact = JSON.parse(
    await readFile(
      new URL("../docs/proof/artifacts/protocol-0.1.0-interaction-contracts.json", import.meta.url),
      "utf8",
    ),
  );
  artifact.result = "FAIL";
  const interactionArtifactPath = path.join(directory, "interaction-contracts.json");
  await writeFile(interactionArtifactPath, `${JSON.stringify(artifact)}\n`);

  await assert.rejects(
    buildProtocolBindingContractsEvidence({
      interactionArtifactPath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("BINDING_PREREQUISITE_DRIFT"),
  );
});

test("rejects public API mutations that admit invalid bindings or expose failure values", async () => {
  const api = await import("../packages/validator/dist/index.js");
  const failureValueApi = {
    ...api,
    validateDesenSourceBindingContracts(input, catalogSet) {
      const result = api.validateDesenSourceBindingContracts(input, catalogSet);
      return result.valid ? result : Object.freeze({ ...result, value: Object.freeze({}) });
    },
  };
  await assert.rejects(
    buildProtocolBindingContractsEvidence({ validatorApi: failureValueApi, verifySnapshot: false }),
    hasEvidenceCode("BINDING_PUBLIC_API_WEAKENED"),
  );

  const unresolvedReferenceApi = {
    ...api,
    validateDesenSourceBindingContracts(input, catalogSet) {
      const result = api.validateDesenSourceBindingContracts(input, catalogSet);
      if (!result.diagnostics?.some(({ code }) => code === "REFERENCE_UNRESOLVED")) return result;
      return api.validateDesenSourceBindingContracts(VALID_SOURCE, catalogSet);
    },
  };
  await assert.rejects(
    buildProtocolBindingContractsEvidence({
      validatorApi: unresolvedReferenceApi,
      verifySnapshot: false,
    }),
    hasEvidenceCode("BINDING_PUBLIC_API_WEAKENED"),
  );

  const invalidFormatApi = {
    ...api,
    validateDesenSourceBindingContracts(input, catalogSet) {
      const result = api.validateDesenSourceBindingContracts(input, catalogSet);
      if (
        !result.diagnostics?.some(
          ({ code, pointer }) =>
            code === "run.desen.validator/INVALID_BINDING_CONTRACT" &&
            pointer?.includes("/$format/"),
        )
      ) {
        return result;
      }
      return api.validateDesenSourceBindingContracts(VALID_SOURCE, catalogSet);
    },
  };
  await assert.rejects(
    buildProtocolBindingContractsEvidence({
      validatorApi: invalidFormatApi,
      verifySnapshot: false,
    }),
    hasEvidenceCode("BINDING_PUBLIC_API_WEAKENED"),
  );
});

test("rejects removal or reordering of inherited T09 obligations", async () => {
  const api = await import("../packages/validator/dist/index.js");
  const weakened = {
    ...api,
    validateDesenSourceBindingContracts(input, catalogSet) {
      return stripFirstObligation(api.validateDesenSourceBindingContracts(input, catalogSet));
    },
    validateDesenBundleBindingContracts(input, catalogSet) {
      return stripFirstObligation(api.validateDesenBundleBindingContracts(input, catalogSet));
    },
    validateDesenBindingContracts(target, input, catalogSet) {
      return stripFirstObligation(api.validateDesenBindingContracts(target, input, catalogSet));
    },
  };
  await assert.rejects(
    buildProtocolBindingContractsEvidence({ validatorApi: weakened, verifySnapshot: false }),
    hasEvidenceCode("BINDING_OBLIGATION_DRIFT"),
  );
});

test("records exact ownership, mutation goldens, prerequisite, and non-claims", async () => {
  const { artifact } = await buildProtocolBindingContractsEvidence();

  assert.deepEqual(artifact.traceability.schemaFamilies, [
    { id: "SC-035", expectedConstraints: 12 },
    { id: "SC-036", expectedConstraints: 14 },
    { id: "SC-037", expectedConstraints: 12 },
    { id: "SC-038", expectedConstraints: 28 },
    { id: "SC-039", expectedConstraints: 18 },
    { id: "SC-040", expectedConstraints: 76 },
    { id: "SC-045", expectedConstraints: 22 },
    { id: "SC-046", expectedConstraints: 70 },
    { id: "SC-047", expectedConstraints: 12 },
    { id: "SC-049", expectedConstraints: 36 },
  ]);
  assert.equal(artifact.traceability.schemaConstraints, 300);
  assert.deepEqual(artifact.traceability.conformanceResponsibilities, []);
  assert.deepEqual(artifact.traceability.mandatoryClauses, []);
  assert.deepEqual(artifact.frozenValidation.officialT10Invalid, []);
  assert.deepEqual(artifact.publicApi.obligationKinds, [
    "behavior-prop",
    "behavior-style-part-property",
    "component-prop",
    "style-part-property",
  ]);
  assert.deepEqual(artifact.publicApi.newBindingObligationKinds, []);
  assert.deepEqual(
    artifact.references.rejected.map(({ id }) => id),
    [
      "missing-state",
      "illegal-fallback-does-not-create-state",
      "closed-state-path",
      "event-outside-handler",
      "unknown-event-payload-path",
      "success-settlement-turn",
      "failure-settlement-turn",
    ],
  );
  assert.deepEqual(
    artifact.repeats.rejected.map(({ id }) => id),
    [
      "non-array-items",
      "explicit-limit-overflow",
      "self-reference-in-items",
      "missing-key",
      "non-scalar-key",
      "duplicate-key",
      "nested-alias-shadow",
      "sibling-alias-leak",
      "resolved-null-items-do-not-select-fallback",
      "non-array-repeat-fallback",
      "partial-dynamic-duplicate-key",
      "partial-dynamic-limit-overflow",
      "dynamic-primary-does-not-mask-non-array-fallback",
      "literal-dynamic-members-still-have-static-length",
      "partially-missing-item-body-path",
      "nested-item-invalid-key-fallback",
    ],
  );
  assert.deepEqual(
    artifact.predicates.rejected.find(({ id }) => id === "nested-item-invalid-ordered-fallback")
      .diagnostics,
    [
      {
        code: "PREDICATE_TYPE_MISMATCH",
        pointer: "/surfaces/sign-in/root/when/args/0",
      },
    ],
  );
  assert.deepEqual(
    artifact.repeats.rejected.find(({ id }) => id === "nested-item-invalid-key-fallback")
      .diagnostics,
    [
      {
        code: "REPEAT_KEY_INVALID",
        pointer: "/surfaces/sign-in/root/repeat/key",
      },
    ],
  );
  assert.deepEqual(
    artifact.repeats.rejected.find(({ id }) => id === "explicit-limit-overflow").diagnostics,
    [
      {
        code: "run.desen.validator/INVALID_BINDING_CONTRACT",
        pointer: "/surfaces/sign-in/root/repeat/limit",
      },
    ],
  );
  assert.deepEqual(
    artifact.repeats.rejected.find(({ id }) => id === "nested-alias-shadow").diagnostics,
    [
      {
        code: "run.desen.validator/INVALID_BINDING_CONTRACT",
        pointer: "/surfaces/sign-in/root/slots/default/0/repeat/as",
      },
    ],
  );
  assert.ok(
    artifact.repeats.accepted.some(({ id }) => id === "dynamic-key-outer-fallback-deferred"),
  );
  assert.deepEqual(
    artifact.laterTaskScopeAccepted.slice(0, 2).map(({ owner }) => owner),
    ["M02-T11/M04-T08", "M02-T11/M04-T09"],
  );
  assert.equal(
    artifact.prerequisite.interactionContracts.verifiedBy,
    "verifyProtocolInteractionContracts",
  );
  assert.equal(
    artifact.prerequisite.interactionContracts.sha256,
    artifact.prerequisite.interactionContracts.verificationSha256,
  );
  assert.equal(artifact.security.platformAudit.runtimeSchemaCompilation, false);
  assert.equal(artifact.security.schemaProfile.finding, "PF-011");
  assert.equal(artifact.security.platformAudit.documentCodeExecution, false);
  assert.equal(artifact.security.platformAudit.formatExpressionEvaluation, false);
  for (const inventory of Object.values(artifact.security.platformAudit.packages)) {
    assert.equal(inventory.distributionFiles.length, inventory.sourceFiles.length * 4);
  }
  assert.ok(artifact.implementation.trackedFiles.length > 45);
  assert.ok(
    artifact.implementation.trackedFiles.every(({ sha256 }) => /^[0-9a-f]{64}$/u.test(sha256)),
  );
  assert.ok(
    artifact.limitations.some((line) =>
      line.includes("adds no predicate/reference obligation kind"),
    ),
  );
  assert.ok(artifact.limitations.some((line) => line.includes("does not claim adapter execution")));
});

test("built distribution exposes the exact binding-contract runtime API", async () => {
  const api = await import("../packages/validator/dist/index.js");
  for (const exportName of [
    "validateDesenBindingContracts",
    "validateDesenBundleBindingContracts",
    "validateDesenSourceBindingContracts",
  ]) {
    assert.equal(typeof api[exportName], "function", exportName);
  }
  assert.equal(api.INVALID_BINDING_CONTRACT_CODE, "run.desen.validator/INVALID_BINDING_CONTRACT");
  assert.equal("validateDesenBindingCatalogSet" in api, false);
});

test("evidence writer rejects symlink and non-file destinations before building", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-binding-symlink-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const realTarget = path.join(directory, "real.json");
  const linkedTarget = path.join(directory, "linked.json");
  await writeFile(realTarget, "unchanged\n");
  await symlink(realTarget, linkedTarget);

  await assert.rejects(
    writeProtocolBindingContractsEvidence({ artifactPath: linkedTarget }),
    hasEvidenceCode("BINDING_ARTIFACT_UNSUPPORTED_ENTRY"),
  );
  assert.equal(await readFile(realTarget, "utf8"), "unchanged\n");

  const realParent = path.join(directory, "real-parent");
  const linkedParent = path.join(directory, "linked-parent");
  await mkdir(realParent);
  await symlink(realParent, linkedParent);
  await assert.rejects(
    writeProtocolBindingContractsEvidence({
      artifactPath: path.join(linkedParent, "artifact.json"),
    }),
    hasEvidenceCode("BINDING_ARTIFACT_UNSUPPORTED_ENTRY"),
  );

  const directoryTarget = path.join(directory, "directory-target");
  await mkdir(directoryTarget);
  await assert.rejects(
    writeProtocolBindingContractsEvidence({ artifactPath: directoryTarget }),
    hasEvidenceCode("BINDING_ARTIFACT_UNSUPPORTED_ENTRY"),
  );
});

test("evidence writer atomically commits and cleans a failed temporary", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-binding-atomic-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifactPath = path.join(directory, "binding-contracts.json");
  await writeFile(artifactPath, "previous complete artifact\n");

  let successfulTemporaryPath;
  let successfulTemporaryBytes;
  const result = await writeProtocolBindingContractsEvidence({
    artifactPath,
    beforeAtomicRename: async ({ artifactPath: target, temporaryPath }) => {
      successfulTemporaryPath = temporaryPath;
      assert.equal(path.dirname(temporaryPath), path.dirname(target));
      assert.equal(await readFile(target, "utf8"), "previous complete artifact\n");
      successfulTemporaryBytes = await readFile(temporaryPath);
    },
  });
  assert.deepEqual(successfulTemporaryBytes, result.artifactBytes);
  assert.deepEqual(await readFile(artifactPath), result.artifactBytes);
  assert.ok(!(await readdir(directory)).includes(path.basename(successfulTemporaryPath)));

  await writeFile(artifactPath, "still complete\n");
  let failedTemporaryPath;
  await assert.rejects(
    writeProtocolBindingContractsEvidence({
      artifactPath,
      beforeAtomicRename: ({ temporaryPath }) => {
        failedTemporaryPath = temporaryPath;
        throw new Error("injected pre-rename failure");
      },
    }),
    /injected pre-rename failure/u,
  );
  assert.equal(await readFile(artifactPath, "utf8"), "still complete\n");
  assert.ok(!(await readdir(directory)).includes(path.basename(failedTemporaryPath)));
});
