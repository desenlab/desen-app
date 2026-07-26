import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ts from "typescript";

import {
  RuntimeCoreReactiveReevaluationEvidenceError,
  buildRuntimeCoreReactiveReevaluationEvidence,
  verifyRuntimeCoreReactiveReevaluationEvidence,
} from "../scripts/lib/runtime-core-reactive-reevaluation-proof.mjs";

const PREREQUISITES = Object.freeze([
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
]);
const OWNED_PATHS = Object.freeze([
  "packages/runtime-core/src/reactive-host-ports.ts",
  "packages/runtime-core/src/reactive-reevaluation.ts",
  "packages/runtime-core/test/reactive-host-ports.test.ts",
  "packages/runtime-core/test/reactive-reevaluation.test.ts",
  "packages/runtime-core/test/reactive-reevaluation.types.ts",
  "packages/runtime-core/dist/reactive-host-ports.js",
  "packages/runtime-core/dist/reactive-host-ports.js.map",
  "packages/runtime-core/dist/reactive-host-ports.d.ts",
  "packages/runtime-core/dist/reactive-host-ports.d.ts.map",
  "packages/runtime-core/dist/reactive-reevaluation.js",
  "packages/runtime-core/dist/reactive-reevaluation.js.map",
  "packages/runtime-core/dist/reactive-reevaluation.d.ts",
  "packages/runtime-core/dist/reactive-reevaluation.d.ts.map",
  "scripts/lib/runtime-core-reactive-reevaluation-proof.mjs",
  "scripts/generate-runtime-core-reactive-reevaluation-proof.mjs",
  "scripts/verify-runtime-core-reactive-reevaluation.mjs",
  "tests/runtime-core-reactive-reevaluation.test.mjs",
]);
const HOST_SOURCE_PATH = "packages/runtime-core/src/reactive-host-ports.ts";
const REEVALUATION_SOURCE_PATH = "packages/runtime-core/src/reactive-reevaluation.ts";

async function rejectsCode(action, expectedCode) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof RuntimeCoreReactiveReevaluationEvidenceError);
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

function removeModuleExportDeclaration(moduleText, fileName, moduleName, isTypeOnly) {
  const parsed = ts.createSourceFile(fileName, moduleText, ts.ScriptTarget.Latest, true);
  const declaration = parsed.statements.find(
    (statement) =>
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === moduleName &&
      statement.isTypeOnly === isTypeOnly,
  );
  assert.ok(declaration, `Export mutation target is missing: ${fileName} ${moduleName}`);
  return `${moduleText.slice(0, declaration.getFullStart())}${moduleText.slice(declaration.end)}`;
}

test("accepts tracked deterministic M04-T15 reactive evidence", async () => {
  const result = await verifyRuntimeCoreReactiveReevaluationEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.runtimeExports, 6);
  assert.equal(result.typeExports, 17);
  assert.equal(result.moduleExports, 24);
  assert.equal(result.tsdocDeclarations, 24);
  assert.equal(result.focusedTests, 54);
  assert.equal(result.compilerNegativeCases, 11);
  assert.equal(result.rootMutationTests, 30);
  assert.equal(result.revokedProxyRedactions, 1);
  assert.equal(result.revokedInputProbes, 2);
  assert.equal(result.failedSubscriptionCleanupProbes, 7);
  assert.equal(result.traceRules, 6);
  assert.equal(result.normativeStatusChanges, 0);
  assert.equal(result.proofMatrixStatusChanges, 0);
  assert.equal(result.trackedFiles, 17);
  assert.equal(result.evaluatorAuthorityLeaks, 0);
  assert.equal(result.requestLeaks, 0);
  assert.equal(result.platformEffects, 0);
});

test("builds byte-identical reactive evidence twice", async () => {
  const first = await buildRuntimeCoreReactiveReevaluationEvidence();
  const second = await buildRuntimeCoreReactiveReevaluationEvidence();
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or tampered reactive evidence", async () => {
  const evidence = await buildRuntimeCoreReactiveReevaluationEvidence();
  const bytes = Buffer.from(evidence.artifactBytes);
  bytes[bytes.length - 2] ^= 1;
  await rejectsCode(
    () => verifyRuntimeCoreReactiveReevaluationEvidence({ artifactBytes: bytes }),
    "REACTIVE_ARTIFACT_DRIFT",
  );
});

test("rejects drift in every M04-T05 through M04-T14 prerequisite", async () => {
  for (const [key, relativePath] of PREREQUISITES) {
    const bytes = Buffer.from(await readFile(new URL(relativePath, import.meta.url)));
    bytes[0] ^= 1;
    await rejectsCode(
      () =>
        buildRuntimeCoreReactiveReevaluationEvidence({
          prerequisiteBytes: { [key]: bytes },
        }),
      "REACTIVE_PREREQUISITE_DRIFT",
    );
  }
});

test("detects captured-host and receiver-independent invocation drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          HOST_SOURCE_PATH,
          "createRuntimeReactiveHostPorts",
          (source) =>
            source.replace("navigation: captured.navigation", "navigation: input.navigation"),
        ),
      }),
    "REACTIVE_HOST_CAPTURE_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          HOST_SOURCE_PATH,
          "sanitizedSettlement",
          (source) =>
            source.replace(
              "Reflect.apply(callback, undefined, [request])",
              "Reflect.apply(callback, callback, [request])",
            ),
        ),
      }),
    "REACTIVE_HOST_SETTLEMENT_FENCE_DRIFT",
  );
});

test("detects exact settlement-envelope and detachment drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          HOST_SOURCE_PATH,
          "sanitizeSettlement",
          (source) => source.replace('hasExactOwnKeys(candidate, ["status", "value"])', "true"),
        ),
      }),
    "REACTIVE_HOST_ENVELOPE_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          HOST_SOURCE_PATH,
          "sanitizeSettlement",
          (source) => source.replace("snapshotRuntimeJsonValue(value.value)", "value.value"),
        ),
      }),
    "REACTIVE_HOST_ENVELOPE_DRIFT",
  );
});

test("detects revoked settlement-Proxy redaction drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          HOST_SOURCE_PATH,
          "sanitizedSettlement",
          (source) =>
            source.replace(
              "} catch {\n        return Promise.reject();\n      }",
              "} catch (error) {\n        return Promise.reject(error);\n      }",
            ),
        ),
      }),
    "REACTIVE_HOST_SETTLEMENT_FENCE_DRIFT",
  );
});

test("detects pre-lifecycle stale-settlement fencing drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          HOST_SOURCE_PATH,
          "sanitizedSettlement",
          (source) =>
            source.replace(
              "Promise.resolve(candidate).then(",
              "Promise.resolve(sanitizeSettlement(candidate)).then(",
            ),
        ),
      }),
    "REACTIVE_HOST_SETTLEMENT_FENCE_DRIFT",
  );
});

test("detects reactive-host authenticity and package-root containment drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceMutation(
          REEVALUATION_SOURCE_PATH,
          "isRuntimeReactiveHostPorts(values.hostPorts)",
          'typeof values.hostPorts === "object"',
        ),
      }),
    "REACTIVE_MOUNT_AUTHORITY_DRIFT",
  );
  const indexPath = new URL("../packages/runtime-core/src/index.ts", import.meta.url);
  const indexText = await readFile(indexPath, "utf8");
  await rejectsCode(
    () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": `${indexText}\nexport { isRuntimeReactiveHostPorts } from "./reactive-host-ports.js";\n`,
        },
      }),
    "REACTIVE_INTERNAL_EXPORT_LEAK",
  );
});

test("detects revoked mount and invalidation reflection containment drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          REEVALUATION_SOURCE_PATH,
          "isPlainRecord",
          (source) =>
            source.replace(
              "try {\n    if (Array.isArray(value)) return false;",
              "if (Array.isArray(value)) return false;\n  try {",
            ),
        ),
      }),
    "REACTIVE_REFLECTION_CONTAINMENT_DRIFT",
  );
});

test("detects exact lower-authority mount drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          REEVALUATION_SOURCE_PATH,
          "initialAuthoritiesAreCurrent",
          (source) =>
            source.replace("state.snapshot === input.stateSnapshot", 'state.status === "active"'),
        ),
      }),
    "REACTIVE_MOUNT_AUTHORITY_DRIFT",
  );
});

test("detects complete double-sampled snapshot drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          REEVALUATION_SOURCE_PATH,
          "captureResolution",
          (source) => source.replace("confirmedContext?.canonical !== context.canonical", "false"),
        ),
      }),
    "REACTIVE_CONSISTENT_SNAPSHOT_DRIFT",
  );
});

test("detects seven-namespace whole-surface resolution drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          REEVALUATION_SOURCE_PATH,
          "captureResolution",
          (source) => source.replace("event: UNAVAILABLE_EVENT", "event: EMPTY_OBJECT"),
        ),
      }),
    "REACTIVE_CONSISTENT_SNAPSHOT_DRIFT",
  );
});

test("detects least-authority evaluator request drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          REEVALUATION_SOURCE_PATH,
          "evaluateCurrent",
          (source) =>
            source.replace(
              "resolutionSnapshot: captured.resolutionSnapshot,",
              "resolutionSnapshot: captured.resolutionSnapshot,\n    hostPorts: hostPorts,",
            ),
        ),
      }),
    "REACTIVE_EVALUATOR_AUTHORITY_LEAK",
  );
});

test("detects pre-reflection and post-reflection stale checks", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          REEVALUATION_SOURCE_PATH,
          "evaluateCurrent",
          (source) => {
            const anchor = "!resolutionRemainsCurrent(authority, captured, capturedEpoch)";
            const position = source.lastIndexOf(anchor);
            assert.ok(position >= 0);
            return `${source.slice(0, position)}false${source.slice(position + anchor.length)}`;
          },
        ),
      }),
    "REACTIVE_STALE_CANDIDATE_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          REEVALUATION_SOURCE_PATH,
          "resolutionRemainsCurrent",
          (source) => source.replace("authenticateResolution(authority, captured)", "true"),
        ),
      }),
    "REACTIVE_POST_AUTHORITY_RECHECK_DRIFT",
  );
});

test("detects dirty-bit batching and synchronous drain drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          REEVALUATION_SOURCE_PATH,
          "markDirty",
          (source) => source.replace("authority.dirty = true", "authority.dirty = false"),
        ),
      }),
    "REACTIVE_BATCHING_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(REEVALUATION_SOURCE_PATH, "drain", (source) =>
          source.replace("if (authority.draining) return", "if (false) return"),
        ),
      }),
    "REACTIVE_BATCHING_DRIFT",
  );
});

test("detects byte-equal publication and monotonic generation drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          REEVALUATION_SOURCE_PATH,
          "publishOutcome",
          (source) => source.replace("authority.outcomeKey === key", "false"),
        ),
      }),
    "REACTIVE_PUBLICATION_DRIFT",
  );
});

test("detects finite lower-only generation limits", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceMutation(
          REEVALUATION_SOURCE_PATH,
          "maxSynchronousTransitions: 64",
          "maxSynchronousTransitions: Number.POSITIVE_INFINITY",
        ),
      }),
    "REACTIVE_LIMIT_DRIFT",
  );
});

test("detects invalidation reflection, subscription, and failed-mount cleanup drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          REEVALUATION_SOURCE_PATH,
          "invalidateRuntimeReactiveReevaluation",
          (source) =>
            source.replace(
              "const currentEntry = REACTIVE_AUTHORITIES.get(handle)",
              "const currentEntry = entry",
            ),
        ),
      }),
    "REACTIVE_INVALIDATION_AUTHORITY_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          REEVALUATION_SOURCE_PATH,
          "mountRuntimeReactiveReevaluation",
          (source) =>
            source.replace(
              "const subscriptions = revokeAuthority(authority);",
              "const subscriptions = Object.freeze({ context: authority.contextUnsubscribe, environment: authority.environmentUnsubscribe });",
            ),
        ),
      }),
    "REACTIVE_SUBSCRIPTION_DRIFT",
  );
});

test("detects centralized revocation graph cleanup drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          REEVALUATION_SOURCE_PATH,
          "revokeAuthority",
          (source) => source.replace("authority.hostPorts = undefined", "void authority.hostPorts"),
        ),
      }),
    "REACTIVE_REVOCATION_DRIFT",
  );
});

test("detects revocation, tombstone, and exact-once disposal drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceFunctionMutation(
          REEVALUATION_SOURCE_PATH,
          "disposeRuntimeReactiveReevaluation",
          (source) =>
            source.replace(
              "const subscriptions = revokeAuthority(entry);",
              "const subscriptions = Object.freeze({ context: entry.contextUnsubscribe, environment: entry.environmentUnsubscribe });",
            ),
        ),
      }),
    "REACTIVE_DISPOSAL_DRIFT",
  );
});

test("detects source module export and TSDoc drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceMutation(
          HOST_SOURCE_PATH,
          "export function isRuntimeReactiveHostPorts",
          "function isRuntimeReactiveHostPorts",
        ),
      }),
    "REACTIVE_PUBLIC_API_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceMutation(
          REEVALUATION_SOURCE_PATH,
          "/** Reference-profile ceilings for one whole-surface reactive coordinator. */",
          "",
        ),
      }),
    "REACTIVE_TSDOC_MISSING",
  );
});

test("detects source package-root export parity drift", async () => {
  const relativePath = "packages/runtime-core/src/index.ts";
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
  await rejectsCode(
    () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: {
          [relativePath]: removeModuleExportDeclaration(
            source,
            "src/index.ts",
            "./reactive-reevaluation.js",
            false,
          ),
        },
      }),
    "REACTIVE_INDEX_EXPORT_DRIFT",
  );
});

test("detects generated module export parity drift", async () => {
  const relativePath = "packages/runtime-core/dist/reactive-reevaluation.js";
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
  assert.ok(source.includes("export function readRuntimeReactiveReevaluation"));
  await rejectsCode(
    () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: {
          [relativePath]: source.replace(
            "export function readRuntimeReactiveReevaluation",
            "function readRuntimeReactiveReevaluation",
          ),
        },
      }),
    "REACTIVE_DISTRIBUTION_DRIFT",
  );
});

test("detects generated package-root export parity drift", async () => {
  const relativePath = "packages/runtime-core/dist/index.d.ts";
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
  await rejectsCode(
    () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: {
          [relativePath]: removeModuleExportDeclaration(
            source,
            "dist/index.d.ts",
            "./reactive-host-ports.js",
            true,
          ),
        },
      }),
    "REACTIVE_DISTRIBUTION_DRIFT",
  );
});

test("detects focused runtime and compiler-negative inventory drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceMutation(
          "packages/runtime-core/test/reactive-reevaluation.test.ts",
          '  it("mounts one atomic whole-surface result with least-authority evaluator inputs"',
          '  it.skip("mounts one atomic whole-surface result with least-authority evaluator inputs"',
        ),
      }),
    "REACTIVE_TEST_INVENTORY_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceMutation(
          "packages/runtime-core/test/reactive-reevaluation.types.ts",
          "@ts-expect-error stale-safe host aggregates carry factory-only authority",
          "stale-safe host aggregates carry factory-only authority",
        ),
      }),
    "REACTIVE_TYPE_TEST_DRIFT",
  );
});

test("detects exact import allowlists and platform-boundary drift", async () => {
  const hostSource = await readFile(
    new URL("../packages/runtime-core/src/reactive-host-ports.ts", import.meta.url),
    "utf8",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: {
          [HOST_SOURCE_PATH]: `${hostSource}\nimport "./unexpected.js";\n`,
        },
      }),
    "REACTIVE_PLATFORM_BOUNDARY_DRIFT",
  );
  const reevaluationSource = await readFile(
    new URL("../packages/runtime-core/src/reactive-reevaluation.ts", import.meta.url),
    "utf8",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: {
          [REEVALUATION_SOURCE_PATH]: `${reevaluationSource}\nvoid setTimeout;\n`,
        },
      }),
    "REACTIVE_PLATFORM_BOUNDARY_DRIFT",
  );
});

test("detects trace-owner drift without rewriting shared ownership", async () => {
  const relativePath = "docs/proof/protocol-0.1.0-traceability.json";
  const trace = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
  assert.ok(trace.includes('"owners": ["M04-T15"]'));
  await rejectsCode(
    () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: {
          [relativePath]: trace.replace('"owners": ["M04-T15"]', '"owners": ["M04-T16"]'),
        },
      }),
    "REACTIVE_TRACE_DRIFT",
  );
});

test("detects normative, finding, and proof-document drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceMutation(
          "docs/proof/NORMATIVE-COVERAGE.md",
          "| N-003 |",
          "| N-003-removed |",
        ),
      }),
    "REACTIVE_NORMATIVE_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceMutation(
          "docs/plan/PROTOCOL-FINDINGS.md",
          "## PF-045 —",
          "## PF-045-removed —",
        ),
      }),
    "REACTIVE_DOCUMENTATION_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceMutation(
          "docs/proof/RUNTIME-CORE-REACTIVE-REEVALUATION.md",
          "M04-T15 is **PASS**",
          "M04-T15 is pending",
        ),
      }),
    "REACTIVE_DOCUMENTATION_DRIFT",
  );
});

test("detects every task-owned byte boundary", async () => {
  for (const relativePath of OWNED_PATHS) {
    const bytes = Buffer.from(await readFile(new URL(`../${relativePath}`, import.meta.url)));
    bytes[0] ^= 1;
    await assert.rejects(
      () =>
        verifyRuntimeCoreReactiveReevaluationEvidence({
          buildOptions: { fileOverrides: { [relativePath]: bytes } },
        }),
      RuntimeCoreReactiveReevaluationEvidenceError,
      relativePath,
    );
  }
});
