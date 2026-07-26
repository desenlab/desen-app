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
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-CORE-REACTIVE-REEVALUATION.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-core-0.1.0-reactive-reevaluation.json";
const ARTIFACT_FILE_NAME = "runtime-core-0.1.0-reactive-reevaluation.json";
const ROOT_TEST_PATH = "tests/runtime-core-reactive-reevaluation.test.mjs";
const HISTORICAL_TRANSFER_RECORDS = Object.freeze({
  "scripts/lib/runtime-core-reactive-reevaluation-proof.mjs": Object.freeze({
    path: "scripts/lib/runtime-core-reactive-reevaluation-proof.mjs",
    bytes: 74_729,
    sha256: "d30bc915dfc90435951a9ffdd277c2c63be9c9e42b98a82f77d25d3d412a254c",
  }),
  [ROOT_TEST_PATH]: Object.freeze({
    path: ROOT_TEST_PATH,
    bytes: 24_906,
    sha256: "74aabe03536c20cbe76034c53b6d0c59b67d6543a17c3d1d59481d66ea574ff7",
  }),
});

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

function pinArtifactReferences(proofText, proofMatrixText, artifactSha256) {
  let proofPins = 0;
  const proof = proofText
    .split(/\r?\n/u)
    .map((line) => {
      if (!/^Its SHA-256 is `[0-9a-f]{64}`\.$/u.test(line)) return line;
      proofPins += 1;
      return `Its SHA-256 is \`${artifactSha256}\`.`;
    })
    .join("\n");
  let matrixArtifacts = 0;
  const matrixLines = proofMatrixText.split(/\r?\n/u);
  for (let index = 0; index < matrixLines.length; index += 1) {
    if (matrixLines[index] !== `\`${ARTIFACT_FILE_NAME}\``) continue;
    matrixArtifacts += 1;
    matrixLines[index + 1] = `\`sha256:${artifactSha256}\`.`;
  }
  assert.equal(proofPins, 1);
  assert.equal(matrixArtifacts, 1);
  return { proof, proofMatrix: matrixLines.join("\n") };
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
  assert.equal(result.rootMutationTests, 31);
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
  assert.equal(first.artifact.evidence.rootMutationTests, 30);
  assert.equal(first.currentRootMutationTests, 31);
  const tracked = new Map(
    first.artifact.evidence.trackedFiles.map((record) => [record.path, record]),
  );
  for (const [relativePath, historical] of Object.entries(HISTORICAL_TRANSFER_RECORDS)) {
    assert.deepEqual(tracked.get(relativePath), historical);
  }
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

test("rejects relocated or duplicated M04-T15 artifact SHA pins", async () => {
  await rejectsCode(
    () =>
      verifyRuntimeCoreReactiveReevaluationEvidence({
        buildOptions: { validatorApi: Object.freeze({}) },
      }),
    "REACTIVE_OPTIONS_INVALID",
  );
  const evidence = await buildRuntimeCoreReactiveReevaluationEvidence();
  const [proofText, proofMatrixText] = await Promise.all([
    readFile(new URL(`../${PROOF_DOCUMENT_PATH}`, import.meta.url), "utf8"),
    readFile(new URL(`../${PROOF_MATRIX_PATH}`, import.meta.url), "utf8"),
  ]);
  const pinned = pinArtifactReferences(proofText, proofMatrixText, evidence.artifactSha256);
  const verifyWith = (proof, proofMatrix) =>
    verifyRuntimeCoreReactiveReevaluationEvidence({
      artifactBytes: evidence.artifactBytes,
      buildOptions: {
        fileOverrides: {
          [PROOF_DOCUMENT_PATH]: proof,
          [PROOF_MATRIX_PATH]: proofMatrix,
        },
      },
    });
  assert.equal((await verifyWith(pinned.proof, pinned.proofMatrix)).result, "PASS");

  const wrongSha256 = "0".repeat(64);
  const proofPair = `\`${ARTIFACT_RELATIVE_PATH}\`.\nIts SHA-256 is \`${evidence.artifactSha256}\`.`;
  await rejectsCode(
    () =>
      verifyWith(
        `${pinned.proof.replace(proofPair, "")}\n## Relocated evidence\n\n${proofPair}\n`,
        pinned.proofMatrix,
      ),
    "REACTIVE_ARTIFACT_REFERENCE_DRIFT",
  );
  await rejectsCode(
    () =>
      verifyWith(
        `${pinned.proof.replace(
          `Its SHA-256 is \`${evidence.artifactSha256}\`.`,
          `Its SHA-256 is \`${wrongSha256}\`.`,
        )}\n<!-- relocated ${evidence.artifactSha256} -->\n`,
        pinned.proofMatrix,
      ),
    "REACTIVE_ARTIFACT_REFERENCE_DRIFT",
  );
  await rejectsCode(
    () =>
      verifyWith(
        `${pinned.proof.trimEnd()}\n\n\`${ARTIFACT_RELATIVE_PATH}\`.\nIts SHA-256 is \`${evidence.artifactSha256}\`.\n`,
        pinned.proofMatrix,
      ),
    "REACTIVE_ARTIFACT_REFERENCE_DRIFT",
  );
  await rejectsCode(
    () =>
      verifyWith(
        pinned.proof,
        `${pinned.proofMatrix.replace(
          `\`sha256:${evidence.artifactSha256}\`.`,
          `\`sha256:${wrongSha256}\`.`,
        )}\n<!-- relocated sha256:${evidence.artifactSha256} -->\n`,
      ),
    "REACTIVE_ARTIFACT_REFERENCE_DRIFT",
  );
  const matrixPair = `\`${ARTIFACT_FILE_NAME}\`\n\`sha256:${evidence.artifactSha256}\`.`;
  await rejectsCode(
    () =>
      verifyWith(
        pinned.proof,
        `${pinned.proofMatrix.replace(matrixPair, "")}\n## Relocated matrix evidence\n\n${matrixPair}\n`,
      ),
    "REACTIVE_ARTIFACT_REFERENCE_DRIFT",
  );
  await rejectsCode(
    () =>
      verifyWith(
        pinned.proof,
        `${pinned.proofMatrix.trimEnd()}\n\`${ARTIFACT_FILE_NAME}\`\n\`sha256:${evidence.artifactSha256}\`.\n`,
      ),
    "REACTIVE_ARTIFACT_REFERENCE_DRIFT",
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
  const normativePath = "docs/proof/NORMATIVE-COVERAGE.md";
  const normative = await readFile(new URL(`../${normativePath}`, import.meta.url), "utf8");
  const determinismRow = normative.split(/\r?\n/u).find((line) => line.startsWith("| N-003 "));
  assert.ok(determinismRow?.includes("TESTED"));
  await rejectsCode(
    async () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: await sourceMutation(normativePath, "| N-003 |", "| N-003-removed |"),
      }),
    "REACTIVE_NORMATIVE_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: {
          [normativePath]: normative.replace(
            determinismRow,
            determinismRow.replace("TESTED", "IMPLEMENTED"),
          ),
        },
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
    if (Object.hasOwn(HISTORICAL_TRANSFER_RECORDS, relativePath)) {
      const baseline = await buildRuntimeCoreReactiveReevaluationEvidence();
      const transferred = await buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: { [relativePath]: bytes },
      });
      assert.deepEqual(transferred.artifactBytes, baseline.artifactBytes, relativePath);
      continue;
    }
    await assert.rejects(
      () =>
        verifyRuntimeCoreReactiveReevaluationEvidence({
          buildOptions: { fileOverrides: { [relativePath]: bytes } },
        }),
      RuntimeCoreReactiveReevaluationEvidenceError,
      relativePath,
    );
  }
  const rootTests = await readFile(new URL(import.meta.url), "utf8");
  await rejectsCode(
    () =>
      buildRuntimeCoreReactiveReevaluationEvidence({
        fileOverrides: {
          [ROOT_TEST_PATH]: rootTests.replace(
            "rejects relocated or duplicated M04-T15 artifact SHA pins",
            "accepts relocated M04-T15 artifact SHA pins",
          ),
        },
      }),
    "REACTIVE_ROOT_TEST_INVENTORY_DRIFT",
  );
});
