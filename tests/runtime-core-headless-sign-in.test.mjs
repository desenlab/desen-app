import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ts from "typescript";

import {
  ProtocolInteractionContractsEvidenceError,
  verifyProtocolInteractionNormativeCompatibility,
} from "../scripts/lib/protocol-interaction-contracts-proof.mjs";
import {
  ReferenceCatalogWebParityEvidenceError,
  verifyReferenceCatalogWebParityNormativeCompatibility,
} from "../scripts/lib/reference-catalog-web-parity-proof.mjs";
import {
  RuntimeCoreHeadlessSignInEvidenceError,
  buildRuntimeCoreHeadlessSignInEvidence,
  verifyRuntimeCoreHeadlessSignInEvidence,
} from "../scripts/lib/runtime-core-headless-sign-in-proof.mjs";

const PREREQUISITES = Object.freeze([
  ["tokenFormat", "../docs/proof/artifacts/runtime-core-0.1.0-token-format-resolution.json"],
  ["predicate", "../docs/proof/artifacts/runtime-core-0.1.0-predicate-evaluation.json"],
  ["variantStyle", "../docs/proof/artifacts/runtime-core-0.1.0-variant-style-evaluation.json"],
  ["localState", "../docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json"],
  ["repeat", "../docs/proof/artifacts/runtime-core-0.1.0-repeat-materialization.json"],
  ["resource", "../docs/proof/artifacts/runtime-core-0.1.0-resource-lifecycle.json"],
  ["operation", "../docs/proof/artifacts/runtime-core-0.1.0-operation-lifecycle.json"],
  ["stateNavigation", "../docs/proof/artifacts/runtime-core-0.1.0-state-navigation-actions.json"],
  [
    "operationResource",
    "../docs/proof/artifacts/runtime-core-0.1.0-operation-resource-actions.json",
  ],
  ["commandEvent", "../docs/proof/artifacts/runtime-core-0.1.0-command-event-actions.json"],
  ["actionTurns", "../docs/proof/artifacts/runtime-core-0.1.0-action-turns.json"],
  ["adapterBridges", "../docs/proof/artifacts/runtime-core-0.1.0-adapter-bridges.json"],
  ["reactiveReevaluation", "../docs/proof/artifacts/runtime-core-0.1.0-reactive-reevaluation.json"],
]);
const OWNED_PATHS = Object.freeze([
  "packages/runtime-core/src/headless-materialization.ts",
  "packages/runtime-core/src/headless-session.ts",
  "packages/runtime-core/test/headless-materialization.test.ts",
  "packages/runtime-core/test/headless-session.test.ts",
  "packages/runtime-core/test/headless-session.types.ts",
  "packages/runtime-core/dist/headless-materialization.js",
  "packages/runtime-core/dist/headless-materialization.js.map",
  "packages/runtime-core/dist/headless-materialization.d.ts",
  "packages/runtime-core/dist/headless-materialization.d.ts.map",
  "packages/runtime-core/dist/headless-session.js",
  "packages/runtime-core/dist/headless-session.js.map",
  "packages/runtime-core/dist/headless-session.d.ts",
  "packages/runtime-core/dist/headless-session.d.ts.map",
  "scripts/lib/runtime-core-headless-sign-in-proof.mjs",
  "scripts/generate-runtime-core-headless-sign-in-proof.mjs",
  "scripts/verify-runtime-core-headless-sign-in.mjs",
  "tests/runtime-core-headless-sign-in.test.mjs",
  "scripts/lib/protocol-interaction-contracts-proof.mjs",
  "tests/protocol-interaction-contracts.test.mjs",
  "scripts/lib/reference-catalog-web-parity-proof.mjs",
  "tests/reference-catalog-web-parity.test.mjs",
]);
const MATERIALIZATION_SOURCE = "packages/runtime-core/src/headless-materialization.ts";
const SESSION_SOURCE = "packages/runtime-core/src/headless-session.ts";

let baselinePromise;

function baseline() {
  baselinePromise ??= buildRuntimeCoreHeadlessSignInEvidence({
    allowPendingArtifactReference: true,
  });
  return baselinePromise;
}

async function rejectsCode(action, expectedCode) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof RuntimeCoreHeadlessSignInEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

async function sourceMutation(relativePath, from, to = "") {
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
  assert.ok(source.includes(from), `Mutation anchor is missing: ${from}`);
  return { [relativePath]: source.replace(from, to) };
}

async function sourceFunctionMutation(relativePath, functionName, transform) {
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
  const parsed = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  const declaration = parsed.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === functionName &&
      statement.body,
  );
  assert.ok(declaration, `Function mutation target is missing: ${functionName}`);
  const start = declaration.getStart(parsed);
  const original = source.slice(start, declaration.end);
  const mutated = transform(original);
  assert.notEqual(mutated, original, `Function mutation made no change: ${functionName}`);
  return {
    [relativePath]: `${source.slice(0, start)}${mutated}${source.slice(declaration.end)}`,
  };
}

function mutateMarkdownRow(markdown, id, transform) {
  let changed = false;
  const mutated = markdown
    .split("\n")
    .map((line) => {
      if (!line.trimStart().startsWith(`| ${id} `)) return line;
      changed = true;
      return transform(line);
    })
    .join("\n");
  assert.equal(changed, true, `Markdown row is missing: ${id}`);
  return mutated;
}

async function buildWithBaselineProbe(options = {}) {
  const evidence = await baseline();
  return buildRuntimeCoreHeadlessSignInEvidence({
    allowPendingArtifactReference: true,
    runtimeProbe: evidence.artifact.runtime,
    ...options,
  });
}

test("accepts tracked deterministic M04-T16 and G04 headless evidence", async () => {
  const result = await verifyRuntimeCoreHeadlessSignInEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.runtimeExports, 7);
  assert.equal(result.typeExports, 22);
  assert.equal(result.moduleExports, 35);
  assert.equal(result.tsdocDeclarations, 35);
  assert.equal(result.focusedTests, 34);
  assert.equal(result.compilerNegativeCases, 11);
  assert.equal(result.rootMutationTests, 24);
  assert.equal(result.traceRules, 72);
  assert.equal(result.currentTraceRules, 67);
  assert.equal(result.deferredTraceRules, 5);
  assert.equal(result.normativeStatusChanges, 1);
  assert.equal(result.proofMatrixStatusChanges, 0);
  assert.equal(result.trackedFiles, 21);
  assert.equal(result.historicalVerifierTransfers, 4);
  assert.equal(result.deterministicRuns, 6);
  assert.equal(result.sessionsPerScenario, 2);
  assert.equal(result.scenarioCount, 3);
  assert.equal(result.executableValues, 0);
  assert.equal(result.platformValues, 0);
  assert.equal(result.staleNavigations, 0);
  assert.equal(result.frozenTraceEnvelopes, result.traceEntries + 10);
});

test("builds byte-identical headless evidence twice", async () => {
  const first = await buildRuntimeCoreHeadlessSignInEvidence({
    allowPendingArtifactReference: true,
  });
  const second = await buildRuntimeCoreHeadlessSignInEvidence({
    allowPendingArtifactReference: true,
  });
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.runtime.traceSha256, second.artifact.runtime.traceSha256);
});

test("rejects stale or tampered headless evidence", async () => {
  const evidence = await baseline();
  const bytes = Buffer.from(evidence.artifactBytes);
  bytes[bytes.length - 2] ^= 1;
  await rejectsCode(
    () =>
      verifyRuntimeCoreHeadlessSignInEvidence({
        artifactBytes: bytes,
        buildOptions: {
          allowPendingArtifactReference: true,
          runtimeProbe: evidence.artifact.runtime,
        },
      }),
    "HEADLESS_ARTIFACT_DRIFT",
  );
});

test("rejects drift in every M04-T03 through M04-T15 prerequisite", async () => {
  for (const [key, relativePath] of PREREQUISITES) {
    const bytes = Buffer.from(await readFile(new URL(relativePath, import.meta.url)));
    bytes[0] ^= 1;
    await rejectsCode(
      () =>
        buildWithBaselineProbe({
          prerequisiteBytes: { [key]: bytes },
        }),
      "HEADLESS_PREREQUISITE_DRIFT",
    );
  }
});

test("detects reviewed source byte drift", async () => {
  await rejectsCode(
    async () =>
      buildWithBaselineProbe({
        fileOverrides: await sourceMutation(
          SESSION_SOURCE,
          "Validates unknown Catalog and Bundle ingress",
          "Validates unknown Bundle and Catalog ingress",
        ),
      }),
    "HEADLESS_SOURCE_BYTE_DRIFT",
  );
});

test("detects exact module and package-root export drift", async () => {
  await rejectsCode(
    async () =>
      buildWithBaselineProbe({
        fileOverrides: await sourceMutation(
          SESSION_SOURCE,
          "export function readRuntimeHeadlessSession",
          "function readRuntimeHeadlessSession",
        ),
      }),
    "HEADLESS_MODULE_EXPORT_DRIFT",
  );
  const indexPath = "packages/runtime-core/src/index.ts";
  const index = await readFile(new URL(`../${indexPath}`, import.meta.url), "utf8");
  await rejectsCode(
    () =>
      buildWithBaselineProbe({
        fileOverrides: {
          [indexPath]: index.replace("  readRuntimeHeadlessSession,", ""),
        },
      }),
    "HEADLESS_ROOT_EXPORT_DRIFT",
  );
});

test("detects exported declaration TSDoc drift", async () => {
  await rejectsCode(
    async () =>
      buildWithBaselineProbe({
        fileOverrides: await sourceMutation(
          MATERIALIZATION_SOURCE,
          "/** Reference-profile ceilings for one complete framework-neutral surface materialization. */",
          "",
        ),
      }),
    "HEADLESS_TSDOC_DRIFT",
  );
});

test("detects exact import and platform-boundary drift", async () => {
  await rejectsCode(
    async () =>
      buildWithBaselineProbe({
        fileOverrides: await sourceMutation(
          SESSION_SOURCE,
          "const LOCAL_IDENTIFIER_PATTERN",
          "const window = Object.freeze({});\nconst LOCAL_IDENTIFIER_PATTERN",
        ),
      }),
    "HEADLESS_PLATFORM_BOUNDARY_DRIFT",
  );
});

test("detects unknown-ingress and revision matching drift", async () => {
  await rejectsCode(
    async () =>
      buildWithBaselineProbe({
        fileOverrides: await sourceFunctionMutation(
          SESSION_SOURCE,
          "mountRuntimeHeadlessSession",
          (source) => source.replace("calculateDesenBundleRevision(bundle)", "bundle.revision"),
        ),
      }),
    "HEADLESS_INGRESS_VALIDATION_DRIFT",
  );
});

test("detects compact commitment and sidecar authentication drift", async () => {
  await rejectsCode(
    async () =>
      buildWithBaselineProbe({
        fileOverrides: await sourceFunctionMutation(
          MATERIALIZATION_SOURCE,
          "readRuntimeHeadlessMaterializationSidecar",
          (source) =>
            source.replace(
              "evaluationId !== authority.evaluationId",
              "evaluationId === authority.evaluationId",
            ),
        ),
      }),
    "HEADLESS_MATERIALIZATION_SIDECAR_DRIFT",
  );
});

test("detects same reactive host aggregate drift", async () => {
  await rejectsCode(
    async () =>
      buildWithBaselineProbe({
        fileOverrides: await sourceFunctionMutation(
          SESSION_SOURCE,
          "mountRuntimeHeadlessSession",
          (source) => source.replace("createSharedHostPorts", "createRuntimeHostPorts"),
        ),
      }),
    "HEADLESS_INGRESS_VALIDATION_DRIFT",
  );
});

test("detects seven-namespace event-origin drift", async () => {
  await rejectsCode(
    async () =>
      buildWithBaselineProbe({
        fileOverrides: await sourceFunctionMutation(
          SESSION_SOURCE,
          "dispatchPreparedEvent",
          (source) =>
            source.replace("currentResolutionSnapshot", "createRuntimeResolutionSnapshot"),
        ),
      }),
    "HEADLESS_EVENT_PROVENANCE_DRIFT",
  );
});

test("detects selector-to-prepared-program join drift", async () => {
  await rejectsCode(
    async () =>
      buildWithBaselineProbe({
        fileOverrides: await sourceFunctionMutation(
          SESSION_SOURCE,
          "dispatchPreparedEvent",
          (source) =>
            source.replace(
              "lifetime.definition.programs.get(key)",
              "lifetime.definition.programs.values().next().value",
            ),
        ),
      }),
    "HEADLESS_EVENT_PROVENANCE_DRIFT",
  );
});

test("detects absent descendant semantic inactivity drift", async () => {
  await rejectsCode(
    async () =>
      buildWithBaselineProbe({
        fileOverrides: await sourceFunctionMutation(
          MATERIALIZATION_SOURCE,
          "materializeTree",
          (source) => source.replace("if (!presence.present) continue;", "void presence.present;"),
        ),
      }),
    "HEADLESS_ABSENT_SUBTREE_DRIFT",
  );
});

test("detects sign-in success failure retry and stale-race drift", async () => {
  const evidence = await baseline();
  assert.equal(evidence.artifact.runtime.successOperationCalls, 1);
  assert.equal(evidence.artifact.runtime.successNavigationCalls, 1);
  assert.equal(evidence.artifact.runtime.failureRetryAttempts, 2);
  assert.equal(evidence.artifact.runtime.staleRaceAttempts, 2);
  assert.equal(evidence.artifact.runtime.staleNavigations, 0);
});

test("detects deterministic navigation and disposal drift", async () => {
  const evidence = await baseline();
  assert.equal(evidence.artifact.runtime.exactOnceSubscriptionCleanups, 4);
  await rejectsCode(
    async () =>
      buildWithBaselineProbe({
        fileOverrides: await sourceFunctionMutation(
          SESSION_SOURCE,
          "disposeCompleteSurface",
          (source) =>
            source.replace(
              "disposeRuntimeReactiveReevaluation(lifetime.reactiveHandle)",
              "disposeRuntimeActionTurns(lifetime.turnsHandle)",
            ),
        ),
      }),
    "HEADLESS_DISPOSAL_ORDER_DRIFT",
  );
});

test("detects finite-limit enforcement drift", async () => {
  await rejectsCode(
    async () =>
      buildWithBaselineProbe({
        fileOverrides: await sourceMutation(SESSION_SOURCE, "  maxNodes: 5_000,", ""),
      }),
    "HEADLESS_SESSION_LIMIT_DRIFT",
  );
});

test("detects canonical trace determinism drift", async () => {
  const evidence = await baseline();
  assert.equal(evidence.artifact.runtime.deterministicRuns, 6);
  for (const scenario of Object.values(evidence.artifact.runtime.scenarios)) {
    assert.equal(scenario.runs, 2);
    assert.equal(scenario.canonicalEqual, true);
    assert.match(scenario.sha256, /^[a-f0-9]{64}$/u);
  }
  assert.match(evidence.artifact.runtime.traceSha256, /^[a-f0-9]{64}$/u);
  assert.ok(evidence.artifact.runtime.traceCanonicalCodeUnits > 0);
  const mutatedRuntime = Object.freeze({
    ...evidence.artifact.runtime,
    scenarios: Object.freeze({
      ...evidence.artifact.runtime.scenarios,
      failureRetry: Object.freeze({
        ...evidence.artifact.runtime.scenarios.failureRetry,
        sha256: "0".repeat(64),
      }),
    }),
  });
  await rejectsCode(
    () => buildWithBaselineProbe({ runtimeProbe: mutatedRuntime }),
    "HEADLESS_RUNTIME_TRACE_DRIFT",
  );
  const runtime = evidence.artifact.runtime;
  const staleReplacement = runtime.trace.staleReplacement;
  const hostileRun = Object.freeze([
    Object.freeze({ ...staleReplacement[1][0], callback: () => undefined }),
    ...staleReplacement[1].slice(1),
  ]);
  const executableRuntime = Object.freeze({
    ...runtime,
    trace: Object.freeze({
      ...runtime.trace,
      staleReplacement: Object.freeze([staleReplacement[0], hostileRun]),
    }),
  });
  await rejectsCode(
    () => buildWithBaselineProbe({ runtimeProbe: executableRuntime }),
    "HEADLESS_RUNTIME_TRACE_DRIFT",
  );
});

test("detects JSON round-trip and executable-value drift", async () => {
  const evidence = await baseline();
  const trace = evidence.artifact.runtime.trace;
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(trace))), JSON.stringify(trace));
  assert.equal(evidence.artifact.runtime.executableValues, 0);
  assert.equal(evidence.artifact.runtime.platformValues, 0);
});

test("detects hostile mutation containment drift", async () => {
  const materializationTests = await readFile(
    new URL("../packages/runtime-core/test/headless-materialization.test.ts", import.meta.url),
    "utf8",
  );
  const sessionTests = await readFile(
    new URL("../packages/runtime-core/test/headless-session.test.ts", import.meta.url),
    "utf8",
  );
  for (const anchor of ["Proxy", "accessor", "Object.isFrozen", "disposed"]) {
    assert.ok(
      materializationTests.includes(anchor) || sessionTests.includes(anchor),
      `Hostile focused-test anchor is missing: ${anchor}`,
    );
  }
});

test("detects focused runtime and compiler-negative inventory drift", async () => {
  const testsPath = "packages/runtime-core/test/headless-session.test.ts";
  const tests = await readFile(new URL(`../${testsPath}`, import.meta.url), "utf8");
  assert.ok(tests.includes("it("));
  await rejectsCode(
    () =>
      buildWithBaselineProbe({
        fileOverrides: { [testsPath]: tests.replace("it(", "it.skip(") },
      }),
    "HEADLESS_FOCUSED_TEST_DRIFT",
  );
});

test("detects trace-owner drift without rewriting shared ownership", async () => {
  const evidence = await baseline();
  const assignments = evidence.artifact.evidence.traceAssignments;
  assert.deepEqual(assignments.auditedBaseline, {
    ownerAssignments: 6,
    testAssignments: 70,
    uniqueRules: 72,
  });
  assert.deepEqual(assignments.historicalLedger, assignments.auditedBaseline);
  assert.deepEqual(assignments.currentApplicable, {
    ownerAssignments: 6,
    testAssignments: 65,
    uniqueRules: 67,
    correctedOverclaims: 5,
  });
  assert.deepEqual(assignments.classifications, {
    "t03-t15-prerequisite": 26,
    "t16-integration": 41,
    "future-deferred": 5,
  });
  assert.deepEqual(
    assignments.records
      .filter(({ classification }) => classification === "future-deferred")
      .map(({ id, futureTests }) => [id, futureTests]),
    [
      ["R-048", ["M05-T02"]],
      ["R-104", ["M05-T05"]],
      ["R-129", ["M12-T05"]],
      ["A-011", ["M05-T08", "M06-T11", "M12-T08"]],
      ["D-009", ["M05-T06", "M06-T11"]],
    ],
  );
  const tracePath = "docs/proof/protocol-0.1.0-traceability.json";
  const trace = await readFile(new URL(`../${tracePath}`, import.meta.url), "utf8");
  await rejectsCode(
    () =>
      buildWithBaselineProbe({
        fileOverrides: {
          [tracePath]: trace.replace('"owners": ["M04-T16"]', '"owners": ["M99-T99"]'),
        },
      }),
    "HEADLESS_TRACE_DRIFT",
  );
  const historicalArtifactPath = "docs/proof/artifacts/protocol-0.1.0-traceability.json";
  const historicalArtifact = Buffer.from(
    await readFile(new URL(`../${historicalArtifactPath}`, import.meta.url)),
  );
  historicalArtifact[0] ^= 1;
  await rejectsCode(
    () =>
      buildWithBaselineProbe({
        fileOverrides: {
          [historicalArtifactPath]: historicalArtifact,
        },
      }),
    "HEADLESS_TRACE_DRIFT",
  );
});

test("detects normative proof-matrix finding and task-status drift", async () => {
  const normativePath = "docs/proof/NORMATIVE-COVERAGE.md";
  const normative = await readFile(new URL(`../${normativePath}`, import.meta.url), "utf8");
  await rejectsCode(
    () =>
      buildWithBaselineProbe({
        fileOverrides: {
          [normativePath]: normative.replace("| N-003 |", "| N-999 |"),
        },
      }),
    "HEADLESS_DOCUMENTATION_DRIFT",
  );
  const compatibility = verifyProtocolInteractionNormativeCompatibility(normative);
  assert.deepEqual(compatibility.historicalProjection, [
    { id: "N-033", status: "PLANNED" },
    { id: "N-034", status: "PLANNED" },
  ]);
  assert.deepEqual(compatibility.currentStatuses, [
    { id: "N-033", status: "TESTED" },
    { id: "N-034", status: "PLANNED" },
  ]);
  const historicalNormative = mutateMarkdownRow(normative, "N-033", (row) =>
    row.replace("| TESTED", "| PLANNED"),
  );
  assert.doesNotThrow(() => verifyProtocolInteractionNormativeCompatibility(historicalNormative));
  for (const invalidStatus of ["NOT_STARTED", "BROKEN"]) {
    const invalidNormative = mutateMarkdownRow(normative, "N-033", (row) =>
      row.replace("| TESTED", `| ${invalidStatus}`),
    );
    assert.throws(
      () => verifyProtocolInteractionNormativeCompatibility(invalidNormative),
      (error) => {
        assert.ok(error instanceof ProtocolInteractionContractsEvidenceError);
        assert.equal(error.code, "INTERACTION_NORMATIVE_DRIFT");
        return true;
      },
    );
  }
  const historicalInteractionArtifactPath =
    "docs/proof/artifacts/protocol-0.1.0-interaction-contracts.json";
  const historicalInteractionArtifact = Buffer.from(
    await readFile(new URL(`../${historicalInteractionArtifactPath}`, import.meta.url)),
  );
  historicalInteractionArtifact[0] ^= 1;
  await rejectsCode(
    () =>
      buildWithBaselineProbe({
        fileOverrides: {
          [historicalInteractionArtifactPath]: historicalInteractionArtifact,
        },
      }),
    "HEADLESS_HISTORICAL_VERIFIER_DRIFT",
  );
  const referenceParityCompatibility =
    verifyReferenceCatalogWebParityNormativeCompatibility(normative);
  assert.deepEqual(referenceParityCompatibility.historicalProjection, [
    { id: "N-030", status: "PLANNED" },
    { id: "N-033", status: "PLANNED" },
    { id: "N-034", status: "PLANNED" },
    { id: "S-001", status: "PLANNED" },
    { id: "S-004", status: "TESTED" },
  ]);
  assert.equal(
    referenceParityCompatibility.currentStatuses.find(({ id }) => id === "N-033")?.status,
    "TESTED",
  );
  assert.doesNotThrow(() =>
    verifyReferenceCatalogWebParityNormativeCompatibility(historicalNormative),
  );
  for (const invalidStatus of ["NOT_STARTED", "IMPLEMENTED"]) {
    const invalidNormative = mutateMarkdownRow(normative, "N-033", (row) =>
      row.replace("| TESTED", `| ${invalidStatus}`),
    );
    assert.throws(
      () => verifyReferenceCatalogWebParityNormativeCompatibility(invalidNormative),
      (error) => {
        assert.ok(error instanceof ReferenceCatalogWebParityEvidenceError);
        assert.equal(error.code, "REFERENCE_PARITY_CLAIM_DRIFT");
        return true;
      },
    );
  }
  const historicalReferenceParityArtifactPath =
    "docs/proof/artifacts/reference-catalog-web-parity.json";
  const historicalReferenceParityArtifact = Buffer.from(
    await readFile(new URL(`../${historicalReferenceParityArtifactPath}`, import.meta.url)),
  );
  historicalReferenceParityArtifact[0] ^= 1;
  await rejectsCode(
    () =>
      buildWithBaselineProbe({
        fileOverrides: {
          [historicalReferenceParityArtifactPath]: historicalReferenceParityArtifact,
        },
      }),
    "HEADLESS_HISTORICAL_VERIFIER_DRIFT",
  );
  const proofMatrixPath = "docs/proof/PROOF-MATRIX.md";
  const proofMatrix = await readFile(new URL(`../${proofMatrixPath}`, import.meta.url), "utf8");
  await rejectsCode(
    () =>
      buildWithBaselineProbe({
        fileOverrides: {
          [proofMatrixPath]: mutateMarkdownRow(proofMatrix, "P-17", (row) =>
            row.replace(
              "runtime-core-0.1.0-headless-sign-in.json",
              "runtime-core-0.1.0-headless-sign-in.invalid",
            ),
          ),
        },
      }),
    "HEADLESS_DOCUMENTATION_DRIFT",
  );
  await rejectsCode(
    () =>
      buildWithBaselineProbe({
        fileOverrides: {
          [proofMatrixPath]: mutateMarkdownRow(proofMatrix, "P-18", (row) =>
            row.replaceAll("M08-T10", "M08-T99"),
          ),
        },
      }),
    "HEADLESS_DOCUMENTATION_DRIFT",
  );
});

test("detects every task-owned byte boundary", async () => {
  const evidence = await baseline();
  for (const relativePath of OWNED_PATHS) {
    const original = await readFile(new URL(`../${relativePath}`, import.meta.url));
    let changed;
    try {
      changed = await buildWithBaselineProbe({
        fileOverrides: {
          [relativePath]: Buffer.concat([original, Buffer.from("\n")]),
        },
      });
    } catch (error) {
      assert.ok(error instanceof RuntimeCoreHeadlessSignInEvidenceError, relativePath);
      continue;
    }
    assert.notEqual(changed.artifactSha256, evidence.artifactSha256, relativePath);
  }
});
