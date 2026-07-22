import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_PROTOCOL_VALIDATOR_DIAGNOSTIC_MICRO_VECTORS_ARTIFACT_PATH,
  ProtocolValidatorDiagnosticMicroVectorsEvidenceError,
  buildProtocolValidatorDiagnosticMicroVectorsEvidence,
  verifyProtocolValidatorDiagnosticMicroVectors,
  writeProtocolValidatorDiagnosticMicroVectorsEvidence,
} from "../scripts/lib/protocol-validator-diagnostic-micro-vectors-proof.mjs";
import { runValidatorDiagnosticMicroVectorSuite } from "../packages/validator/test/diagnostic-micro-vector-suite.ts";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ProtocolValidatorDiagnosticMicroVectorsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function builtApis() {
  const [protocolApi, validatorApi] = await Promise.all([
    import("../packages/protocol/dist/index.js"),
    import("../packages/validator/dist/index.js"),
  ]);
  return { protocolApi, validatorApi };
}

function frozenResultWithDiagnostics(result, transform) {
  return Object.freeze({
    ...result,
    diagnostics: Object.freeze(result.diagnostics.map((diagnostic) => transform(diagnostic))),
  });
}

test("accepts exact deterministic M02-T13 validator diagnostic evidence", async () => {
  const result = await verifyProtocolValidatorDiagnosticMicroVectors();

  assert.deepEqual(result, {
    result: "PASS",
    diagnostics: 34,
    core: 28,
    extensions: 6,
    positiveVectors: 34,
    negativeVectors: 34,
    traceResponsibilities: 53,
    schemaFamilies: 61,
    schemaConstraints: 989,
    artifactSha256: result.artifactSha256,
  });
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent diagnostic evidence builds are byte-identical", async () => {
  const first = await buildProtocolValidatorDiagnosticMicroVectorsEvidence();
  const second = await buildProtocolValidatorDiagnosticMicroVectorsEvidence();

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("rejects a one-byte-tampered diagnostic artifact", async () => {
  const pristine = await readFile(
    DEFAULT_PROTOCOL_VALIDATOR_DIAGNOSTIC_MICRO_VECTORS_ARTIFACT_PATH,
  );
  const tampered = Buffer.from(pristine);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyProtocolValidatorDiagnosticMicroVectors({ artifactBytes: tampered }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_ARTIFACT_DRIFT"),
  );
});

test("rejects missing trace ownership and orphaned diagnostic scope", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-diagnostic-trace-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const trace = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  trace.diagnostics.find(({ id }) => id === "D-001").tests = [];
  const tracePath = path.join(directory, "trace.json");
  await writeFile(tracePath, `${JSON.stringify(trace)}\n`);

  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      tracePath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_TRACE_DRIFT"),
  );
});

test("rejects each independently tampered direct prerequisite", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-diagnostic-prerequisite-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const prerequisites = [
    ["M02-T08", "protocol-0.1.0-component-contracts.json"],
    ["M02-T09", "protocol-0.1.0-interaction-contracts.json"],
    ["M02-T10", "protocol-0.1.0-binding-contracts.json"],
    ["M02-T11", "protocol-0.1.0-execution-contracts.json"],
    ["M02-T12", "protocol-0.1.0-official-suite-parity.json"],
  ];

  for (const [task, filename] of prerequisites) {
    const source = new URL(`../docs/proof/artifacts/${filename}`, import.meta.url);
    const artifact = JSON.parse(await readFile(source, "utf8"));
    artifact.profile = "weakened-profile";
    const artifactPath = path.join(directory, filename);
    await writeFile(artifactPath, `${JSON.stringify(artifact)}\n`);

    await assert.rejects(
      buildProtocolValidatorDiagnosticMicroVectorsEvidence({
        prerequisiteArtifactPaths: { [task]: artifactPath },
        verifySnapshot: false,
      }),
      hasEvidenceCode("DIAGNOSTIC_VECTOR_PREREQUISITE_DRIFT"),
      task,
    );
  }
});

test("rejects APIs that reject a positive or admit a negative vector", async () => {
  const { protocolApi, validatorApi } = await builtApis();
  const rejectPositive = {
    ...validatorApi,
    validateDesenSourceExecutionContracts(input, catalogs) {
      const result = validatorApi.validateDesenSourceExecutionContracts(input, catalogs);
      if (!result.valid) return result;
      return Object.freeze({
        valid: false,
        target: "source",
        diagnostics: Object.freeze([Object.freeze({ code: "INJECTED_REJECTION", pointer: "" })]),
        obligations: Object.freeze([]),
      });
    },
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi: rejectPositive,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );

  const admitNegative = {
    ...validatorApi,
    validateDesenSourceExecutionContracts(input, catalogs) {
      const result = validatorApi.validateDesenSourceExecutionContracts(input, catalogs);
      if (!result.diagnostics.some(({ code }) => code === "STATE_WRITE_INVALID")) return result;
      return Object.freeze({
        valid: true,
        target: "source",
        value: Object.freeze({}),
        diagnostics: Object.freeze([]),
        obligations: Object.freeze([]),
      });
    },
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi: admitNegative,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );
});

test("rejects diagnostic classification, pointer, context, and extension-category drift", async () => {
  const { protocolApi, validatorApi } = await builtApis();
  const mutations = [
    ["classification", (diagnostic) => ({ ...diagnostic, classification: "semantic" })],
    ["pointer", (diagnostic) => ({ ...diagnostic, pointer: "/wrong" })],
    [
      "context",
      (diagnostic) => ({
        ...diagnostic,
        context: Object.freeze({ capabilityId: "com.example.wrong/Capability" }),
      }),
    ],
  ];
  for (const [label, mutate] of mutations) {
    const changed = {
      ...validatorApi,
      validateDesenEventPayload(payload, selector, catalogs) {
        const result = validatorApi.validateDesenEventPayload(payload, selector, catalogs);
        if (!result.diagnostics.some(({ code }) => code === "EVENT_PAYLOAD_INVALID")) {
          return result;
        }
        return frozenResultWithDiagnostics(result, (diagnostic) =>
          diagnostic.code === "EVENT_PAYLOAD_INVALID"
            ? Object.freeze(mutate(diagnostic))
            : diagnostic,
        );
      },
    };
    await assert.rejects(
      buildProtocolValidatorDiagnosticMicroVectorsEvidence({
        protocolApi,
        validatorApi: changed,
        verifySnapshot: false,
      }),
      hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
      label,
    );
  }

  const classifiedExtension = {
    ...validatorApi,
    validateDesenExecutionCatalogSet(input) {
      const result = validatorApi.validateDesenExecutionCatalogSet(input);
      if (!result.diagnostics.some(({ code }) => code.endsWith("/INVALID_SEMVER"))) return result;
      return frozenResultWithDiagnostics(result, (diagnostic) =>
        diagnostic.code.endsWith("/INVALID_SEMVER")
          ? Object.freeze({ ...diagnostic, classification: "semantic" })
          : diagnostic,
      );
    },
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi: classifiedExtension,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );
});

test("rejects mutable results, caller-input mutation, and repeated-run drift", async () => {
  const { protocolApi, validatorApi } = await builtApis();
  const mutableResult = {
    ...validatorApi,
    validateDesenEventPayload(payload, selector, catalogs) {
      const result = validatorApi.validateDesenEventPayload(payload, selector, catalogs);
      return result.diagnostics.some(({ code }) => code === "EVENT_PAYLOAD_INVALID")
        ? { ...result }
        : result;
    },
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi: mutableResult,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );

  const hiddenMutableResult = {
    ...validatorApi,
    validateDesenEventPayload(payload, selector, catalogs) {
      const result = validatorApi.validateDesenEventPayload(payload, selector, catalogs);
      if (!result.diagnostics.some(({ code }) => code === "EVENT_PAYLOAD_INVALID")) return result;
      const changed = { ...result };
      Object.defineProperty(changed, "hiddenMutableValue", {
        configurable: false,
        enumerable: false,
        value: {},
        writable: false,
      });
      return Object.freeze(changed);
    },
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi: hiddenMutableResult,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );

  let invalidPayloadResultCalls = 0;
  const mutableSecondResult = {
    ...validatorApi,
    validateDesenEventPayload(payload, selector, catalogs) {
      const result = validatorApi.validateDesenEventPayload(payload, selector, catalogs);
      if (!result.diagnostics.some(({ code }) => code === "EVENT_PAYLOAD_INVALID")) return result;
      invalidPayloadResultCalls += 1;
      return invalidPayloadResultCalls === 2 ? { ...result } : result;
    },
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi: mutableSecondResult,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );

  const mutateInput = {
    ...validatorApi,
    validateDesenSourceExecutionContracts(input, catalogs) {
      if (typeof input === "object" && input !== null && !Array.isArray(input)) {
        const extensions = input.extensions;
        if (typeof extensions === "object" && extensions !== null && !Array.isArray(extensions)) {
          extensions["run.desen.test/mutated"] = true;
        }
      }
      return validatorApi.validateDesenSourceExecutionContracts(input, catalogs);
    },
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi: mutateInput,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );

  const hiddenMutation = Symbol("hidden mutation");
  const mutateHiddenInput = {
    ...validatorApi,
    validateDesenSourceExecutionContracts(input, catalogs) {
      if (typeof input === "object" && input !== null) {
        Object.defineProperty(input, hiddenMutation, { value: true });
      }
      return validatorApi.validateDesenSourceExecutionContracts(input, catalogs);
    },
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi: mutateHiddenInput,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );

  const freezeCallerInput = {
    ...validatorApi,
    validateDesenSourceExecutionContracts(input, catalogs) {
      if (typeof input === "object" && input !== null) Object.freeze(input);
      return validatorApi.validateDesenSourceExecutionContracts(input, catalogs);
    },
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi: freezeCallerInput,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );

  let sourceValidationCalls = 0;
  const mutateOnlySecondInput = {
    ...validatorApi,
    validateDesenSourceExecutionContracts(input, catalogs) {
      sourceValidationCalls += 1;
      if (sourceValidationCalls % 2 === 0 && typeof input === "object" && input !== null) {
        Object.defineProperty(input, hiddenMutation, { value: sourceValidationCalls });
      }
      return validatorApi.validateDesenSourceExecutionContracts(input, catalogs);
    },
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi: mutateOnlySecondInput,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );

  let validPayloadCalls = 0;
  const nondeterministicPositiveValue = {
    ...validatorApi,
    validateDesenEventPayload(payload, selector, catalogs) {
      const result = validatorApi.validateDesenEventPayload(payload, selector, catalogs);
      if (!result.valid) return result;
      validPayloadCalls += 1;
      return Object.freeze({
        ...result,
        value: Object.freeze({ auditNonce: validPayloadCalls }),
      });
    },
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi: nondeterministicPositiveValue,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );

  let mapValueCalls = 0;
  const internalSlotDrift = {
    ...validatorApi,
    validateDesenEventPayload(payload, selector, catalogs) {
      const result = validatorApi.validateDesenEventPayload(payload, selector, catalogs);
      if (!result.valid) return result;
      mapValueCalls += 1;
      return Object.freeze({
        ...result,
        value: Object.freeze(new Map([["auditNonce", mapValueCalls]])),
      });
    },
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi: internalSlotDrift,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );

  let invalidPayloadCalls = 0;
  const nondeterministic = {
    ...validatorApi,
    validateDesenEventPayload(payload, selector, catalogs) {
      const result = validatorApi.validateDesenEventPayload(payload, selector, catalogs);
      if (!result.diagnostics.some(({ code }) => code === "EVENT_PAYLOAD_INVALID")) return result;
      invalidPayloadCalls += 1;
      return frozenResultWithDiagnostics(result, (diagnostic) =>
        diagnostic.code === "EVENT_PAYLOAD_INVALID"
          ? Object.freeze({
              ...diagnostic,
              pointer: invalidPayloadCalls % 2 === 0 ? "/value" : "/alternate",
            })
          : diagnostic,
      );
    },
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi: nondeterministic,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );

  const forgedSummaryRunner = (api, activeFixtures) => {
    const transcript = runValidatorDiagnosticMicroVectorSuite(api, activeFixtures);
    return {
      ...transcript,
      cases: transcript.cases.map((vector, index) =>
        index === 0
          ? {
              ...vector,
              pass: false,
              positive: { ...vector.positive, deepFrozen: false },
            }
          : vector,
      ),
    };
  };
  await assert.rejects(
    buildProtocolValidatorDiagnosticMicroVectorsEvidence({
      protocolApi,
      validatorApi,
      suiteRunner: forgedSummaryRunner,
      verifySnapshot: false,
    }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_SUITE_FAILED"),
  );
});

test("rejects a symbolic-link artifact destination before writing", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-diagnostic-writer-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const target = path.join(directory, "target.json");
  const link = path.join(directory, "artifact.json");
  await writeFile(target, "{}\n");
  await symlink(target, link);

  await assert.rejects(
    writeProtocolValidatorDiagnosticMicroVectorsEvidence({ artifactPath: link }),
    hasEvidenceCode("DIAGNOSTIC_VECTOR_ARTIFACT_UNSUPPORTED_ENTRY"),
  );
});
