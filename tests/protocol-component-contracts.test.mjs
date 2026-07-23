import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ProtocolComponentContractsEvidenceError,
  buildProtocolComponentContractsEvidence,
  verifyProtocolComponentContracts,
  writeProtocolComponentContractsEvidence,
} from "../scripts/lib/protocol-component-contracts-proof.mjs";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ProtocolComponentContractsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts exact deterministic M02-T08 component-contract evidence", async () => {
  const result = await verifyProtocolComponentContracts();

  assert.equal(result.result, "PASS");
  assert.equal(result.schemaFamilies, 7);
  assert.equal(result.schemaConstraints, 191);
  assert.equal(result.coreDiagnostics, 5);
  assert.equal(result.officialT08Invalid, 0);
  assert.equal(result.projectMutationGoldens, 15);
  assert.equal(result.schemaSafetyGoldens, 7);
  assert.equal(result.scopeFenceAccepted, 7);
  assert.equal(result.examples, 5);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent component-contract evidence builds are byte-identical", async () => {
  const first = await buildProtocolComponentContractsEvidence();
  const second = await buildProtocolComponentContractsEvidence();

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("rejects one-byte-tampered component-contract evidence", async () => {
  const pristine = await buildProtocolComponentContractsEvidence();
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyProtocolComponentContracts({ artifactBytes: tampered }),
    hasEvidenceCode("COMPONENT_ARTIFACT_DRIFT"),
  );
});

test("rejects reviewed M02-T08 trace, BCP 14, and finding mutations", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-component-trace-"));
  context.after(() => rm(directory, { force: true, recursive: true }));

  const trace = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  const family = trace.schemaFamilies.find(({ id }) => id === "SC-029");
  family.semanticOwners = family.semanticOwners.filter((owner) => owner !== "M02-T08");
  const tracePath = path.join(directory, "trace.json");
  await writeFile(tracePath, `${JSON.stringify(trace)}\n`);
  await assert.rejects(
    buildProtocolComponentContractsEvidence({ tracePath, verifySnapshot: false }),
    hasEvidenceCode("COMPONENT_TRACE_DRIFT"),
  );

  const countMutation = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  countMutation.schemaFamilies.find(({ id }) => id === "SC-029").expectedConstraints = 6;
  const countTracePath = path.join(directory, "count-trace.json");
  await writeFile(countTracePath, `${JSON.stringify(countMutation)}\n`);
  await assert.rejects(
    buildProtocolComponentContractsEvidence({ tracePath: countTracePath, verifySnapshot: false }),
    hasEvidenceCode("COMPONENT_TRACE_DRIFT"),
  );

  const normative = await readFile(
    new URL("../docs/proof/NORMATIVE-COVERAGE.md", import.meta.url),
    "utf8",
  );
  const changedNormative = normative.replace(
    /^(\| N-026 \|.*?\| )M02-T08, M04-T02, M05-T02(\s+\|)/mu,
    "$1M04-T02, M05-T02$2",
  );
  assert.notEqual(changedNormative, normative);
  const normativeCoveragePath = path.join(directory, "normative.md");
  await writeFile(normativeCoveragePath, changedNormative);
  await assert.rejects(
    buildProtocolComponentContractsEvidence({
      normativeCoveragePath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("COMPONENT_NORMATIVE_COVERAGE_DRIFT"),
  );

  const changedStatus = normative.replace(/^(\| N-026 \|.*?\| )TESTED(\s+\|)/mu, "$1PLANNED$2");
  assert.notEqual(changedStatus, normative);
  const statusCoveragePath = path.join(directory, "normative-status.md");
  await writeFile(statusCoveragePath, changedStatus);
  await assert.rejects(
    buildProtocolComponentContractsEvidence({
      normativeCoveragePath: statusCoveragePath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("COMPONENT_NORMATIVE_COVERAGE_DRIFT"),
  );

  const findings = await readFile(
    new URL("../docs/plan/PROTOCOL-FINDINGS.md", import.meta.url),
    "utf8",
  );
  const changedFindings = findings.replace(
    /an explicitly empty union rejects every\s+child/u,
    "an explicitly empty union accepts every child",
  );
  assert.notEqual(changedFindings, findings);
  const findingsPath = path.join(directory, "findings.md");
  await writeFile(findingsPath, changedFindings);
  await assert.rejects(
    buildProtocolComponentContractsEvidence({ findingsPath, verifySnapshot: false }),
    hasEvidenceCode("COMPONENT_FINDING_DRIFT"),
  );

  const changedRegexFinding = findings.replace(
    "a deterministic 50,000-step evaluation budget",
    "a deterministic 60,000-step evaluation budget",
  );
  assert.notEqual(changedRegexFinding, findings);
  const regexFindingsPath = path.join(directory, "regex-findings.md");
  await writeFile(regexFindingsPath, changedRegexFinding);
  await assert.rejects(
    buildProtocolComponentContractsEvidence({
      findingsPath: regexFindingsPath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("COMPONENT_FINDING_DRIFT"),
  );

  const changedDepthFinding = findings.replace(
    /maximum\s+traversal\/evaluation depth of 128/u,
    "maximum traversal/evaluation depth of 129",
  );
  assert.notEqual(changedDepthFinding, findings);
  const depthFindingsPath = path.join(directory, "depth-findings.md");
  await writeFile(depthFindingsPath, changedDepthFinding);
  await assert.rejects(
    buildProtocolComponentContractsEvidence({
      findingsPath: depthFindingsPath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("COMPONENT_FINDING_DRIFT"),
  );

  const changedVariablePlacementFinding = findings.replace(
    "it must be the final\n  consuming atom; only the terminal `$` may follow.",
    "it may precede a fixed\n  consuming suffix before the terminal `$`.",
  );
  assert.notEqual(changedVariablePlacementFinding, findings);
  const placementFindingsPath = path.join(directory, "placement-findings.md");
  await writeFile(placementFindingsPath, changedVariablePlacementFinding);
  await assert.rejects(
    buildProtocolComponentContractsEvidence({
      findingsPath: placementFindingsPath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("COMPONENT_FINDING_DRIFT"),
  );
});

test("rejects schema-safety limit-object and gate drift without executing the source", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-component-safety-source-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const source = await readFile(
    new URL("../packages/validator/src/schema-instance-validation.ts", import.meta.url),
    "utf8",
  );

  const changedLimit = source.replace(
    "maxUnanchoredFixedPatternWidth: 16,",
    "maxUnanchoredFixedPatternWidth: 17,",
  );
  assert.notEqual(changedLimit, source);
  const changedLimitPath = path.join(directory, "changed-limit.ts");
  await writeFile(changedLimitPath, changedLimit);
  await assert.rejects(
    buildProtocolComponentContractsEvidence({
      schemaSafetySourcePath: changedLimitPath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("COMPONENT_SCHEMA_PROFILE_DRIFT"),
  );

  const changedGate = source.replace(
    'if (variableQuantifiers > 0 && character !== "$") return false;',
    'if (variableQuantifiers > 1 && character !== "$") return false;',
  );
  assert.notEqual(changedGate, source);
  const changedGatePath = path.join(directory, "changed-gate.ts");
  await writeFile(changedGatePath, changedGate);
  await assert.rejects(
    buildProtocolComponentContractsEvidence({
      schemaSafetySourcePath: changedGatePath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("COMPONENT_SCHEMA_PROFILE_DRIFT"),
  );
});

test("rejects tampered M02-T05 and M02-T07 prerequisite evidence", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-component-prerequisites-"));
  context.after(() => rm(directory, { force: true, recursive: true }));

  const diagnostics = JSON.parse(
    await readFile(
      new URL("../docs/proof/artifacts/protocol-0.1.0-diagnostics.json", import.meta.url),
      "utf8",
    ),
  );
  diagnostics.registry.count += 1;
  const diagnosticsArtifactPath = path.join(directory, "diagnostics.json");
  await writeFile(diagnosticsArtifactPath, `${JSON.stringify(diagnostics)}\n`);
  await assert.rejects(
    buildProtocolComponentContractsEvidence({
      diagnosticsArtifactPath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("COMPONENT_PREREQUISITE_DRIFT"),
  );

  const semantic = JSON.parse(
    await readFile(
      new URL("../docs/proof/artifacts/protocol-0.1.0-semantic-foundation.json", import.meta.url),
      "utf8",
    ),
  );
  semantic.limitations.push("tampered without changing prerequisite metadata");
  const semanticArtifactPath = path.join(directory, "semantic.json");
  await writeFile(semanticArtifactPath, `${JSON.stringify(semantic)}\n`);
  await assert.rejects(
    buildProtocolComponentContractsEvidence({
      semanticArtifactPath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("COMPONENT_PREREQUISITE_DRIFT"),
  );
});

test("rejects a public API mutation that accepts invalid component contracts", async () => {
  const api = await import("../packages/validator/dist/index.js");
  const accepted = Object.freeze({
    valid: true,
    target: "source",
    value: Object.freeze({}),
    diagnostics: Object.freeze([]),
    obligations: Object.freeze([]),
  });

  await assert.rejects(
    buildProtocolComponentContractsEvidence({
      validatorApi: {
        ...api,
        validateDesenSourceComponentContracts: () => accepted,
      },
      verifySnapshot: false,
    }),
    hasEvidenceCode("COMPONENT_OBLIGATION_GOLDEN_MISMATCH"),
  );
});

test("rejects public catalog-set mutations that weaken depth or regex safety", async (context) => {
  const api = await import("../packages/validator/dist/index.js");
  const validCatalog = JSON.parse(
    await readFile(
      new URL(
        "../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const accepted = api.validateDesenComponentCatalogSet([validCatalog]);
  assert.equal(accepted.valid, true);

  await context.test("schema depth 129", async () => {
    const acceptsExcessiveDepth = (catalogs) => {
      let schema = catalogs?.[0]?.components?.["com.example.ui/Button"]?.propsSchema;
      let depth = 0;
      while (
        schema !== null &&
        typeof schema === "object" &&
        !Array.isArray(schema) &&
        Object.keys(schema).length === 1 &&
        Object.hasOwn(schema, "not")
      ) {
        depth += 1;
        schema = schema.not;
      }
      return depth > 128 ? accepted : api.validateDesenComponentCatalogSet(catalogs);
    };

    await assert.rejects(
      buildProtocolComponentContractsEvidence({
        validatorApi: {
          ...api,
          validateDesenComponentCatalogSet: acceptsExcessiveDepth,
        },
        verifySnapshot: false,
      }),
      hasEvidenceCode("COMPONENT_INVALID_CASE_ACCEPTED"),
    );
  });

  await context.test("fixed suffix after a variable-width quantifier", async () => {
    const acceptsUnsafeSuffix = (catalogs) => {
      const pattern = catalogs?.[0]?.components?.["com.example.ui/Button"]?.propsSchema?.pattern;
      return pattern === "^a+b$" ? accepted : api.validateDesenComponentCatalogSet(catalogs);
    };

    await assert.rejects(
      buildProtocolComponentContractsEvidence({
        validatorApi: {
          ...api,
          validateDesenComponentCatalogSet: acceptsUnsafeSuffix,
        },
        verifySnapshot: false,
      }),
      hasEvidenceCode("COMPONENT_INVALID_CASE_ACCEPTED"),
    );
  });
});

test("rejects a public API mutation that drops only store-map obligations", async () => {
  const api = await import("../packages/validator/dist/index.js");
  const withoutStoreMapObligations = (document, catalogSet) => {
    const result = api.validateDesenSourceComponentContracts(document, catalogSet);
    return result.valid && document.id === "com.example.store-locator"
      ? Object.freeze({ ...result, obligations: Object.freeze([]) })
      : result;
  };

  await assert.rejects(
    buildProtocolComponentContractsEvidence({
      validatorApi: {
        ...api,
        validateDesenSourceComponentContracts: withoutStoreMapObligations,
      },
      verifySnapshot: false,
    }),
    hasEvidenceCode("COMPONENT_OBLIGATION_GOLDEN_MISMATCH"),
  );
});

test("rejects missing, mutable, or non-JSON document-failure obligations", async (context) => {
  const api = await import("../packages/validator/dist/index.js");
  for (const target of ["source", "bundle"]) {
    await context.test(target, async () => {
      const exportName =
        target === "source"
          ? "validateDesenSourceComponentContracts"
          : "validateDesenBundleComponentContracts";
      const withoutFailureObligations = (...arguments_) => {
        const result = api[exportName](...arguments_);
        if (result.valid) return result;
        const failure = Object.fromEntries(
          Object.entries(result).filter(([key]) => key !== "obligations"),
        );
        return Object.freeze(failure);
      };

      await assert.rejects(
        buildProtocolComponentContractsEvidence({
          validatorApi: { ...api, [exportName]: withoutFailureObligations },
          verifySnapshot: false,
        }),
        hasEvidenceCode("COMPONENT_OBLIGATION_MISSING"),
      );
    });
  }

  await context.test("mutable Source failure obligations", async () => {
    const mutableFailureObligations = (...arguments_) => {
      const result = api.validateDesenSourceComponentContracts(...arguments_);
      return result.valid
        ? result
        : Object.freeze({ ...result, obligations: [...result.obligations] });
    };
    await assert.rejects(
      buildProtocolComponentContractsEvidence({
        validatorApi: {
          ...api,
          validateDesenSourceComponentContracts: mutableFailureObligations,
        },
        verifySnapshot: false,
      }),
      hasEvidenceCode("COMPONENT_RESULT_MUTABLE"),
    );
  });

  await context.test("non-JSON Bundle failure obligations", async () => {
    const nonJsonFailureObligations = (...arguments_) => {
      const result = api.validateDesenBundleComponentContracts(...arguments_);
      return result.valid
        ? result
        : Object.freeze({ ...result, obligations: Object.freeze([() => undefined]) });
    };
    await assert.rejects(
      buildProtocolComponentContractsEvidence({
        validatorApi: {
          ...api,
          validateDesenBundleComponentContracts: nonJsonFailureObligations,
        },
        verifySnapshot: false,
      }),
      hasEvidenceCode("COMPONENT_OBLIGATION_NOT_JSON"),
    );
  });
});

test("rejects a generic dispatcher result that differs from its specialized API", async () => {
  const api = await import("../packages/validator/dist/index.js");
  const mismatchedDispatcher = (target, document, catalogSet) => {
    const result = api.validateDesenComponentContracts(target, document, catalogSet);
    return target === "source"
      ? Object.freeze({ ...result, obligations: Object.freeze([...result.obligations].reverse()) })
      : result;
  };

  await assert.rejects(
    buildProtocolComponentContractsEvidence({
      validatorApi: { ...api, validateDesenComponentContracts: mismatchedDispatcher },
      verifySnapshot: false,
    }),
    hasEvidenceCode("COMPONENT_DISPATCHER_MISMATCH"),
  );
});

test("records project mutation goldens, scope fences, commands, and code-free delivery", async () => {
  const { artifact } = await buildProtocolComponentContractsEvidence();

  assert.deepEqual(artifact.verification.commands, [
    "pnpm generate:protocol-component-contracts",
    "pnpm verify:protocol-component-contracts",
    "pnpm test:protocol-component-contracts",
    "pnpm check",
  ]);
  assert.deepEqual(artifact.verification.artifactWriter, {
    parentResolution: "realpath",
    temporaryFile: "same-directory exclusive create",
    durabilityBeforeCommit: "file sync",
    commit: "atomic rename",
    failureCleanup: "temporary file removed",
    rejectedDestinations: ["symlink", "directory", "special file", "symlink parent"],
  });
  assert.deepEqual(artifact.frozenValidation.officialT08Invalid, []);
  assert.equal(artifact.componentProps.projectMutationGoldens.length, 6);
  assert.equal(artifact.slots.projectMutationGoldens.length, 4);
  assert.equal(artifact.styles.projectMutationGoldens.length, 5);
  assert.equal(artifact.laterTaskScopeAccepted.length, 7);
  assert.equal(artifact.implementation.schemaEngine.runtimeCompilation, false);
  assert.equal(artifact.security.documentCodeExecution, false);
  assert.equal(artifact.security.remoteSchemaResolution, false);
  assert.deepEqual(artifact.traceability.schemaFamilies, [
    { id: "SC-029", expectedConstraints: 5 },
    { id: "SC-042", expectedConstraints: 26 },
    { id: "SC-043", expectedConstraints: 26 },
    { id: "SC-046", expectedConstraints: 70 },
    { id: "SC-052", expectedConstraints: 18 },
    { id: "SC-055", expectedConstraints: 7 },
    { id: "SC-057", expectedConstraints: 39 },
  ]);
  assert.ok(artifact.traceability.mandatoryClauses.every(({ status }) => status === "TESTED"));
  assert.equal(artifact.traceability.implementationFindings.slotEdgeSemantics.id, "PF-010");
  assert.equal(artifact.traceability.implementationFindings.regexSafety.id, "PF-011");
  assert.equal(artifact.traceability.implementationFindings.regexSafety.status, "OPEN");
  assert.equal(artifact.traceability.implementationFindings.regexSafety.evaluationBudget, 50_000);
  assert.deepEqual(artifact.implementation.schemaEngine.regexSafetyProfile, {
    finding: "PF-011",
    profile: "host-safe component-schema profile",
    maximumSchemaDepth: 128,
    maximumPatternCodeUnits: 256,
    maximumPatternTokens: 128,
    maximumQuantifier: 1_024,
    maximumExpandedFixedWidth: 4_096,
    maximumUnanchoredFixedPatternWidth: 16,
    maximumSchemaNodes: 4_096,
    maximumLocalReferenceEdges: 4_096,
    maximumPatterns: 64,
    maximumAggregatePatternCodeUnits: 4_096,
    evaluationBudget: 50_000,
    variableWidthPlacement: "final consuming atom; only a terminal $ may follow",
    unsafeNativeRegExpExecution: false,
    scope: ["component props", "style-part properties"],
  });
  assert.deepEqual(artifact.schemaSafetyGoldens, {
    publicBoundary: "validateDesenComponentCatalogSet",
    profile: "host-safe component-schema profile",
    maximumSchemaDepth: 128,
    maximumUnanchoredFixedPatternWidth: 16,
    variableWidthPlacement: "final consuming atom; only a terminal $ may follow",
    accepted: [
      { id: "maximum-schema-depth", boundary: 128, valid: true },
      { id: "maximum-unanchored-fixed-width", boundary: 16, valid: true },
      { id: "final-variable-width-atom", boundary: "^a+$", valid: true },
    ],
    rejected: [
      {
        id: "above-maximum-schema-depth",
        boundary: 129,
        valid: false,
        diagnostics: [
          {
            code: "run.desen.validator/INVALID_COMPONENT_CONTRACT",
            pointer: "/0/components/com.example.ui~1Button/propsSchema",
          },
        ],
      },
      {
        id: "above-maximum-unanchored-fixed-width",
        boundary: 17,
        valid: false,
        diagnostics: [
          {
            code: "run.desen.validator/INVALID_COMPONENT_CONTRACT",
            pointer:
              "/0/components/com.example.ui~1Button/propsSchema/patternProperties/abcdefghijklmnopq",
          },
        ],
      },
      {
        id: "fixed-suffix-after-variable-width",
        boundary: "^a+b$",
        valid: false,
        diagnostics: [
          {
            code: "run.desen.validator/INVALID_COMPONENT_CONTRACT",
            pointer: "/0/components/com.example.ui~1Button/propsSchema/pattern",
          },
        ],
      },
      {
        id: "pathological-quantified-prefix-suffix",
        boundary: "^.*a{1024}a{1024}a{1024}$",
        valid: false,
        diagnostics: [
          {
            code: "run.desen.validator/INVALID_COMPONENT_CONTRACT",
            pointer: "/0/components/com.example.ui~1Button/propsSchema/pattern",
          },
        ],
      },
    ],
  });
  assert.deepEqual(
    artifact.dynamicObligations.storeMap.map(({ valueSpec, obligation }) => ({
      valueSpec,
      kind: obligation.kind,
      pointer: obligation.pointer,
    })),
    [
      {
        valueSpec: "$format",
        kind: "component-prop",
        pointer: "/surfaces/stores/root/slots/default/0/slots/popup/0/props/text",
      },
      {
        valueSpec: "$token",
        kind: "style-part-property",
        pointer: "/surfaces/stores/root/slots/default/0/style/base/marker/fill",
      },
      {
        valueSpec: "$token",
        kind: "style-part-property",
        pointer: "/surfaces/stores/root/slots/default/0/style/base/selectedMarker/fill",
      },
    ],
  );
  assert.equal(artifact.dynamicObligations.failures.source.length, 3);
  assert.equal(artifact.dynamicObligations.failures.bundle.length, 3);
  assert.equal(artifact.prerequisites.diagnostics.verifiedBy, "verifyProtocolDiagnostics");
  assert.equal(
    artifact.prerequisites.semanticFoundation.verifiedBy,
    "verifyProtocolSemanticFoundation",
  );
  assert.deepEqual(artifact.implementation.runtimeDependencies, [
    { name: "@desen/protocol", version: "workspace:*", license: "Apache-2.0" },
  ]);
  assert.deepEqual(artifact.implementation.transitiveRuntimeDependencies, []);
  assert.deepEqual(artifact.security.platformAudit.packages.validator.allowedImports, [
    "relative",
    "@desen/protocol",
  ]);
  assert.deepEqual(artifact.security.platformAudit.packages.protocol.allowedImports, ["relative"]);
  assert.deepEqual(
    artifact.security.platformAudit.guardGoldens.map(({ id }) => id),
    [
      "validator-node-prefix",
      "validator-bare-node-builtin",
      "validator-other-bare-dependency",
      "validator-protocol-subpath",
      "protocol-bare-dependency",
      "dynamic-code-execution",
    ],
  );
  assert.ok(artifact.implementation.trackedFiles.length > 20);
  assert.ok(
    artifact.implementation.trackedFiles.every(({ sha256 }) => /^[0-9a-f]{64}$/u.test(sha256)),
  );
  for (const trackedPath of [
    "docs/proof/PROTOCOL-COMPONENT-CONTRACTS.md",
    "packages/protocol/src/index.ts",
    "packages/protocol/src/canonicalization.ts",
    "packages/protocol/src/diagnostics.ts",
    "packages/protocol/src/json-pointer.ts",
    "packages/protocol/dist/index.js",
    "packages/protocol/dist/canonicalization.js",
    "packages/protocol/dist/diagnostics.js",
    "packages/protocol/dist/json-pointer.js",
  ]) {
    assert.ok(
      artifact.implementation.trackedFiles.some(({ path: filePath }) => filePath === trackedPath),
      trackedPath,
    );
  }
  for (const sharedPath of [
    "package.json",
    "pnpm-lock.yaml",
    "turbo.json",
    "docs/plan/PROTOCOL-FINDINGS.md",
    "docs/proof/NORMATIVE-COVERAGE.md",
  ]) {
    assert.equal(
      artifact.implementation.trackedFiles.some(({ path: filePath }) => filePath === sharedPath),
      false,
      sharedPath,
    );
  }
});

test("built distribution exposes the exact component-contract runtime API", async () => {
  const api = await import("../packages/validator/dist/index.js");
  for (const exportName of [
    "validateDesenBundleComponentContracts",
    "validateDesenComponentCatalogSet",
    "validateDesenComponentContracts",
    "validateDesenSourceComponentContracts",
  ]) {
    assert.equal(typeof api[exportName], "function", exportName);
  }
  assert.match(api.INVALID_COMPONENT_CONTRACT_CODE, /^run\.desen\.validator\//u);
});

test("evidence writer rejects a symlink destination before generating an artifact", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-component-symlink-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const realTarget = path.join(directory, "real.json");
  const linkedTarget = path.join(directory, "linked.json");
  await writeFile(realTarget, "unchanged\n");
  await symlink(realTarget, linkedTarget);

  await assert.rejects(
    writeProtocolComponentContractsEvidence({ artifactPath: linkedTarget }),
    hasEvidenceCode("COMPONENT_ARTIFACT_UNSUPPORTED_ENTRY"),
  );
  assert.equal(await readFile(realTarget, "utf8"), "unchanged\n");
});

test("evidence writer atomically renames a same-directory exclusive file and cleans failures", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-component-atomic-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifactPath = path.join(directory, "component-contracts.json");
  await writeFile(artifactPath, "previous complete artifact\n");

  let successfulTemporaryPath;
  let successfulTemporaryBytes;
  const result = await writeProtocolComponentContractsEvidence({
    artifactPath,
    beforeAtomicRename: async ({ artifactPath: resolvedTarget, temporaryPath }) => {
      successfulTemporaryPath = temporaryPath;
      assert.equal(path.dirname(temporaryPath), path.dirname(resolvedTarget));
      assert.equal(await readFile(resolvedTarget, "utf8"), "previous complete artifact\n");
      successfulTemporaryBytes = await readFile(temporaryPath);
    },
  });
  assert.deepEqual(successfulTemporaryBytes, result.artifactBytes);
  assert.deepEqual(await readFile(artifactPath), result.artifactBytes);
  assert.ok(!(await readdir(directory)).includes(path.basename(successfulTemporaryPath)));

  await writeFile(artifactPath, "still complete\n");
  let failedTemporaryPath;
  await assert.rejects(
    writeProtocolComponentContractsEvidence({
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
