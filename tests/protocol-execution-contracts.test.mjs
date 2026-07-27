import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ProtocolExecutionContractsEvidenceError,
  buildProtocolExecutionContractsEvidence,
  verifyProtocolExecutionContracts,
  writeProtocolExecutionContractsEvidence,
} from "../scripts/lib/protocol-execution-contracts-proof.mjs";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ProtocolExecutionContractsEvidenceError);
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

test("accepts exact deterministic M02-T11 execution-contract evidence", async () => {
  const result = await verifyProtocolExecutionContracts();

  assert.equal(result.result, "PASS");
  assert.equal(result.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(result.schemaFamilies, 9);
  assert.equal(result.schemaConstraints, 383);
  assert.equal(result.proseRules, 11);
  assert.equal(result.invariants, 2);
  assert.equal(result.ownedCoreDiagnostics, 5);
  assert.equal(result.conformanceResponsibilities, 0);
  assert.equal(result.mandatoryClauses, 0);
  assert.equal(result.officialT11Invalid, 0);
  assert.equal(result.projectMutationGoldens, 42);
  assert.equal(result.schemaSafetyAccepted, 1);
  assert.equal(result.schemaSafetyRejected, 5);
  assert.equal(result.resolvedValueSafetyAccepted, 4);
  assert.equal(result.resolvedValueSafetyRejected, 6);
  assert.equal(result.resolvedValueHostileRejected, 4);
  assert.equal(result.forgedLowerStageCatalogEntryPoints, 3);
  assert.equal(result.inheritedObligationKinds, 4);
  assert.equal(result.newExecutionObligationKinds, 4);
  assert.equal(result.obligationKinds, 8);
  assert.equal(result.resolvedValueSelectorKinds, 5);
  assert.equal(result.examples, 5);
  assert.equal(
    result.artifactSha256,
    "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
  );
});

test("default evidence writer preserves immutable task-time M02-T11 bytes", async () => {
  const artifactPath = new URL(
    "../docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
    import.meta.url,
  );
  const before = await readFile(artifactPath);
  const result = await writeProtocolExecutionContractsEvidence();
  const after = await readFile(artifactPath);

  assert.deepEqual(after, before);
  assert.deepEqual(result.artifactBytes, before);
});

test("two independent execution evidence builds are byte-identical", async () => {
  const first = await buildProtocolExecutionContractsEvidence();
  const second = await buildProtocolExecutionContractsEvidence();

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("rejects a current rebuild and one-byte-tampered historical execution evidence", async () => {
  const current = await buildProtocolExecutionContractsEvidence();
  await assert.rejects(
    verifyProtocolExecutionContracts({ artifactBytes: current.artifactBytes }),
    hasEvidenceCode("EXECUTION_ARTIFACT_DRIFT"),
  );

  const historical = await readFile(
    new URL("../docs/proof/artifacts/protocol-0.1.0-execution-contracts.json", import.meta.url),
  );
  const tampered = Buffer.from(historical);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyProtocolExecutionContracts({ artifactBytes: tampered }),
    hasEvidenceCode("EXECUTION_ARTIFACT_DRIFT"),
  );
});

test("rejects T11 trace, false BCP 14 ownership, finding, and source drift", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-execution-review-"));
  context.after(() => rm(directory, { force: true, recursive: true }));

  const trace = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  trace.schemaFamilies.find(({ id }) => id === "SC-031").expectedConstraints = 6;
  const tracePath = path.join(directory, "trace.json");
  await writeFile(tracePath, `${JSON.stringify(trace)}\n`);
  await assert.rejects(
    buildProtocolExecutionContractsEvidence({ tracePath, verifySnapshot: false }),
    hasEvidenceCode("EXECUTION_TRACE_DRIFT"),
  );

  const normative = await readFile(
    new URL("../docs/proof/NORMATIVE-COVERAGE.md", import.meta.url),
    "utf8",
  );
  const changedNormative = normative.replace(/^(| N-001 |.*?| )M12-T08(\s+|)/mu, "$1M02-T11$2");
  assert.notEqual(changedNormative, normative);
  const normativeCoveragePath = path.join(directory, "normative.md");
  await writeFile(normativeCoveragePath, changedNormative);
  await assert.rejects(
    buildProtocolExecutionContractsEvidence({
      normativeCoveragePath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("EXECUTION_NORMATIVE_DRIFT"),
  );

  const findings = await readFile(
    new URL("../docs/plan/PROTOCOL-FINDINGS.md", import.meta.url),
    "utf8",
  );
  const changedFindings = findings.replace("INVALID_EXECUTION_CONTRACT", "INVALID_RUN_CONTRACT");
  assert.notEqual(changedFindings, findings);
  const findingsPath = path.join(directory, "findings.md");
  await writeFile(findingsPath, changedFindings);
  await assert.rejects(
    buildProtocolExecutionContractsEvidence({ findingsPath, verifySnapshot: false }),
    hasEvidenceCode("EXECUTION_FINDING_DRIFT"),
  );

  const source = await readFile(
    new URL("../packages/validator/src/execution-contract-validation.ts", import.meta.url),
    "utf8",
  );
  const changedSource = source.replace(
    "validateDesenBindingContracts",
    "validateDesenUncheckedBindings",
  );
  assert.notEqual(changedSource, source);
  const executionSourcePath = path.join(directory, "execution-contract-validation.ts");
  await writeFile(executionSourcePath, changedSource);
  await assert.rejects(
    buildProtocolExecutionContractsEvidence({ executionSourcePath, verifySnapshot: false }),
    hasEvidenceCode("EXECUTION_SOURCE_PROFILE_DRIFT"),
  );
});

test("rejects a one-field-tampered M02-T10 prerequisite artifact", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-execution-prerequisite-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifact = JSON.parse(
    await readFile(
      new URL("../docs/proof/artifacts/protocol-0.1.0-binding-contracts.json", import.meta.url),
      "utf8",
    ),
  );
  artifact.result = "FAIL";
  const bindingArtifactPath = path.join(directory, "binding-contracts.json");
  await writeFile(bindingArtifactPath, `${JSON.stringify(artifact)}\n`);

  await assert.rejects(
    buildProtocolExecutionContractsEvidence({ bindingArtifactPath, verifySnapshot: false }),
    hasEvidenceCode("EXECUTION_PREREQUISITE_DRIFT"),
  );
});

test("rejects public APIs that admit invalid execution values or expose failure values", async () => {
  const api = await import("../packages/validator/dist/index.js");
  const failureValueApi = {
    ...api,
    validateDesenSourceExecutionContracts(input, catalogSet) {
      const result = api.validateDesenSourceExecutionContracts(input, catalogSet);
      return result.valid ? result : Object.freeze({ ...result, value: Object.freeze({}) });
    },
  };
  await assert.rejects(
    buildProtocolExecutionContractsEvidence({
      validatorApi: failureValueApi,
      verifySnapshot: false,
    }),
    hasEvidenceCode("EXECUTION_PUBLIC_API_WEAKENED"),
  );

  const resolvedValueApi = {
    ...api,
    validateDesenExecutionValue(value, selector, catalogSet) {
      const result = api.validateDesenExecutionValue(value, selector, catalogSet);
      if (!result.diagnostics?.some(({ code }) => code === "OPERATION_OUTPUT_INVALID")) {
        return result;
      }
      return Object.freeze({
        valid: true,
        target: "execution-value",
        value: Object.freeze({}),
        diagnostics: Object.freeze([]),
      });
    },
  };
  await assert.rejects(
    buildProtocolExecutionContractsEvidence({
      validatorApi: resolvedValueApi,
      verifySnapshot: false,
    }),
    hasEvidenceCode("EXECUTION_PUBLIC_API_WEAKENED"),
  );
});

test("rejects targeted APIs that admit each hostile resolved-value shape", async () => {
  const api = await import("../packages/validator/dist/index.js");
  const mutations = [
    {
      id: "accessor",
      admits(value) {
        return typeof Object.getOwnPropertyDescriptor(value ?? {}, "userId")?.get === "function";
      },
    },
    {
      id: "cycle",
      admits(value) {
        return value?.self === value;
      },
    },
    {
      id: "custom-prototype",
      admits(value) {
        return (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          Object.getPrototypeOf(value) !== Object.prototype &&
          Object.getPrototypeOf(value) !== null
        );
      },
    },
    {
      id: "non-finite-number",
      admits(value) {
        const descriptor = Object.getOwnPropertyDescriptor(value ?? {}, "userId");
        return (
          descriptor !== undefined &&
          "value" in descriptor &&
          typeof descriptor.value === "number" &&
          !Number.isFinite(descriptor.value)
        );
      },
    },
  ];
  for (const mutation of mutations) {
    const weakened = {
      ...api,
      validateDesenExecutionValue(value, selector, catalogSet) {
        if (!mutation.admits(value)) {
          return api.validateDesenExecutionValue(value, selector, catalogSet);
        }
        return Object.freeze({
          valid: true,
          target: "execution-value",
          value: Object.freeze({}),
          diagnostics: Object.freeze([]),
        });
      },
    };
    await assert.rejects(
      buildProtocolExecutionContractsEvidence({ validatorApi: weakened, verifySnapshot: false }),
      hasEvidenceCode("EXECUTION_PUBLIC_API_WEAKENED"),
      mutation.id,
    );
  }
});

test("rejects targeted APIs that admit a forged T09 catalog brand", async () => {
  const api = await import("../packages/validator/dist/index.js");
  const invalidExecutionAt = (result, pointer) =>
    result.diagnostics?.some(
      ({ code, pointer: actual }) =>
        code === "run.desen.validator/INVALID_EXECUTION_CONTRACT" && actual === pointer,
    );
  const admitted = (target) =>
    Object.freeze({
      valid: true,
      target,
      value: Object.freeze({}),
      diagnostics: Object.freeze([]),
      ...(target === "execution-value" ? {} : { obligations: Object.freeze([]) }),
    });
  const mutations = [
    {
      id: "source",
      api: {
        ...api,
        validateDesenSourceExecutionContracts(input, catalogSet) {
          const result = api.validateDesenSourceExecutionContracts(input, catalogSet);
          return invalidExecutionAt(result, "/catalogs") ? admitted("source") : result;
        },
      },
    },
    {
      id: "bundle",
      api: {
        ...api,
        validateDesenBundleExecutionContracts(input, catalogSet) {
          const result = api.validateDesenBundleExecutionContracts(input, catalogSet);
          return invalidExecutionAt(result, "/requires/catalogs") ? admitted("bundle") : result;
        },
      },
    },
    {
      id: "execution-value",
      api: {
        ...api,
        validateDesenExecutionValue(value, selector, catalogSet) {
          const result = api.validateDesenExecutionValue(value, selector, catalogSet);
          return invalidExecutionAt(result, "") ? admitted("execution-value") : result;
        },
      },
    },
  ];
  for (const mutation of mutations) {
    await assert.rejects(
      buildProtocolExecutionContractsEvidence({
        validatorApi: mutation.api,
        verifySnapshot: false,
      }),
      hasEvidenceCode("EXECUTION_PUBLIC_API_WEAKENED"),
      mutation.id,
    );
  }
});

test("rejects removal of inherited or new execution obligations", async () => {
  const api = await import("../packages/validator/dist/index.js");
  const weakened = {
    ...api,
    validateDesenSourceExecutionContracts(input, catalogSet) {
      return stripFirstObligation(api.validateDesenSourceExecutionContracts(input, catalogSet));
    },
    validateDesenBundleExecutionContracts(input, catalogSet) {
      return stripFirstObligation(api.validateDesenBundleExecutionContracts(input, catalogSet));
    },
    validateDesenExecutionContracts(target, input, catalogSet) {
      return stripFirstObligation(api.validateDesenExecutionContracts(target, input, catalogSet));
    },
  };
  await assert.rejects(
    buildProtocolExecutionContractsEvidence({ validatorApi: weakened, verifySnapshot: false }),
    hasEvidenceCode("EXECUTION_OBLIGATION_DRIFT"),
  );
});

test("records exact ownership, diagnostics, obligations, selector kinds, and non-claims", async () => {
  const { artifact } = await buildProtocolExecutionContractsEvidence();

  assert.deepEqual(artifact.traceability.schemaFamilies, [
    { id: "SC-031", expectedConstraints: 5 },
    { id: "SC-032", expectedConstraints: 5 },
    { id: "SC-041", expectedConstraints: 178 },
    { id: "SC-046", expectedConstraints: 70 },
    { id: "SC-048", expectedConstraints: 24 },
    { id: "SC-049", expectedConstraints: 36 },
    { id: "SC-059", expectedConstraints: 8 },
    { id: "SC-060", expectedConstraints: 23 },
    { id: "SC-061", expectedConstraints: 34 },
  ]);
  assert.equal(artifact.traceability.schemaConstraints, 383);
  assert.deepEqual(artifact.traceability.conformanceResponsibilities, []);
  assert.deepEqual(artifact.traceability.mandatoryClauses, []);
  assert.deepEqual(artifact.frozenValidation.officialT11Invalid, []);
  assert.deepEqual(artifact.publicApi.inheritedObligationKinds, [
    "behavior-prop",
    "behavior-style-part-property",
    "component-prop",
    "style-part-property",
  ]);
  assert.deepEqual(artifact.publicApi.newExecutionObligationKinds, [
    "component-command-input",
    "operation-input",
    "resource-input",
    "state-write",
  ]);
  assert.deepEqual(artifact.publicApi.obligationKinds, [
    "behavior-prop",
    "behavior-style-part-property",
    "component-command-input",
    "component-prop",
    "operation-input",
    "resource-input",
    "state-write",
    "style-part-property",
  ]);
  assert.deepEqual(artifact.publicApi.resolvedValueSelectorKinds, [
    "component-command-input",
    "operation-input",
    "operation-output",
    "resource-input",
    "resource-output",
  ]);
  assert.deepEqual(
    artifact.actionTargets.rejected.map(({ id }) => id),
    [
      "missing-navigation-surface",
      "external-looking-navigation-surface",
      "missing-refresh-resource",
      "missing-component-target",
      "cross-surface-component-target",
    ],
  );
  assert.deepEqual(
    artifact.operations.rejected.find(({ id }) => id === "conflicting-surface-alias").diagnostics,
    [
      {
        code: "run.desen.validator/INVALID_EXECUTION_CONTRACT",
        pointer: "/surfaces/main/root/on/press/1/as",
      },
    ],
  );
  assert.equal(artifact.verification.projectMutationGoldens, 42);
  assert.equal(artifact.schemaSafety.accepted.length, 1);
  assert.equal(artifact.schemaSafety.rejected.length, 5);
  assert.equal(artifact.security.resolvedValues.safety.accepted.length, 4);
  assert.equal(artifact.security.resolvedValues.safety.rejected.length, 6);
  assert.equal(artifact.security.resolvedValues.hostileBoundary.rejectedCount, 4);
  assert.equal(artifact.security.resolvedValues.hostileBoundary.accessorInvoked, false);
  assert.deepEqual(
    artifact.security.resolvedValues.hostileBoundary.rejected.map(({ id }) => id),
    ["accessor-without-invocation", "cyclic-value", "custom-prototype", "non-finite-number"],
  );
  assert.equal(artifact.security.catalogTrustFence.rejectedEntryPointCount, 3);
  assert.deepEqual(
    artifact.security.catalogTrustFence.rejectedEntryPoints.map(({ id }) => id),
    ["source", "bundle", "execution-value"],
  );
  assert.equal(
    artifact.verification.resolvedValueHostileRejected,
    artifact.security.resolvedValues.hostileBoundary.rejected.length,
  );
  assert.equal(
    artifact.verification.forgedLowerStageCatalogEntryPoints,
    artifact.security.catalogTrustFence.rejectedEntryPoints.length,
  );
  assert.ok(artifact.limitations.some((entry) => entry.includes("mounted runtime liveness")));
  assert.ok(
    artifact.limitations.some((entry) => entry.includes("does not claim adapter execution")),
  );
});

test("writes atomically and rejects unsafe artifact destinations", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-execution-writer-"));
  context.after(() => rm(directory, { force: true, recursive: true }));

  const artifactPath = path.join(directory, "execution.json");
  const written = await writeProtocolExecutionContractsEvidence({ artifactPath });
  assert.deepEqual(await readFile(artifactPath), written.artifactBytes);

  const target = path.join(directory, "outside.json");
  const symlinkPath = path.join(directory, "symlink.json");
  await symlink(target, symlinkPath);
  await assert.rejects(
    writeProtocolExecutionContractsEvidence({ artifactPath: symlinkPath }),
    hasEvidenceCode("EXECUTION_ARTIFACT_UNSUPPORTED_ENTRY"),
  );

  const directoryPath = path.join(directory, "directory.json");
  await mkdir(directoryPath);
  await assert.rejects(
    writeProtocolExecutionContractsEvidence({ artifactPath: directoryPath }),
    hasEvidenceCode("EXECUTION_ARTIFACT_UNSUPPORTED_ENTRY"),
  );

  const racePath = path.join(directory, "race.json");
  await assert.rejects(
    writeProtocolExecutionContractsEvidence({
      artifactPath: racePath,
      beforeAtomicRename: async () => symlink(target, racePath),
    }),
    hasEvidenceCode("EXECUTION_ARTIFACT_UNSUPPORTED_ENTRY"),
  );

  const cleanupPath = path.join(directory, "cleanup.json");
  await assert.rejects(
    writeProtocolExecutionContractsEvidence({
      artifactPath: cleanupPath,
      beforeAtomicRename() {
        throw new Error("injected writer failure");
      },
    }),
    /injected writer failure/u,
  );
  assert.deepEqual(
    (await readdir(directory)).filter((entry) => entry.includes(".tmp")),
    [],
  );
});
