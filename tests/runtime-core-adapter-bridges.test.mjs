import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ts from "typescript";

import {
  RuntimeCoreAdapterBridgesEvidenceError,
  buildRuntimeCoreAdapterBridgesEvidence,
  verifyRuntimeCoreAdapterBridgesEvidence,
} from "../scripts/lib/runtime-core-adapter-bridges-proof.mjs";

const REPEAT_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-repeat-materialization.json",
  import.meta.url,
);
const COMMAND_EVENT_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-command-event-actions.json",
  import.meta.url,
);
const SOURCE = new URL("../packages/runtime-core/src/adapter-bridges.ts", import.meta.url);
const BUILT_ADAPTER = new URL("../packages/runtime-core/dist/adapter-bridges.js", import.meta.url);
const SOURCE_INDEX = new URL("../packages/runtime-core/src/index.ts", import.meta.url);
const BUILT_INDEX = new URL("../packages/runtime-core/dist/index.js", import.meta.url);
const BUILT_INDEX_DECLARATION = new URL(
  "../packages/runtime-core/dist/index.d.ts",
  import.meta.url,
);
const FOCUSED_TESTS = new URL(
  "../packages/runtime-core/test/adapter-bridges.test.ts",
  import.meta.url,
);
const TYPE_TESTS = new URL(
  "../packages/runtime-core/test/adapter-bridges.types.ts",
  import.meta.url,
);
const TRACE = new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url);
const NORMATIVE = new URL("../docs/proof/NORMATIVE-COVERAGE.md", import.meta.url);
const FINDINGS = new URL("../docs/plan/PROTOCOL-FINDINGS.md", import.meta.url);
const PROOF_DOCUMENT = new URL("../docs/proof/RUNTIME-CORE-ADAPTER-BRIDGES.md", import.meta.url);
const PROOF_MATRIX = new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url);
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-CORE-ADAPTER-BRIDGES.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-core-0.1.0-adapter-bridges.json";
const ARTIFACT_FILE_NAME = "runtime-core-0.1.0-adapter-bridges.json";
const ROOT_TEST_PATH = "tests/runtime-core-adapter-bridges.test.mjs";
const HISTORICAL_TRANSFER_RECORDS = Object.freeze({
  "scripts/lib/runtime-core-adapter-bridges-proof.mjs": Object.freeze({
    path: "scripts/lib/runtime-core-adapter-bridges-proof.mjs",
    bytes: 57_717,
    sha256: "e933f2e4824b0f529a14e3626185a6b526e0ebbb9c45e977eebd675d70117bda",
  }),
  [ROOT_TEST_PATH]: Object.freeze({
    path: ROOT_TEST_PATH,
    bytes: 22_699,
    sha256: "efd0d3eac5570e80c001989382a028c80e50dff3d0b17dd321761a2a392dde44",
  }),
});

async function rejectsCode(action, expectedCode) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof RuntimeCoreAdapterBridgesEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

async function sourceText() {
  return readFile(SOURCE, "utf8");
}

async function sourceMutation(from, to = "") {
  const source = await sourceText();
  assert.ok(source.includes(from), `Mutation anchor is missing: ${from}`);
  return {
    "packages/runtime-core/src/adapter-bridges.ts": source.replace(from, to),
  };
}

async function sourceFunctionMutation(functionName, transform) {
  const source = await sourceText();
  const parsed = ts.createSourceFile("adapter-bridges.ts", source, ts.ScriptTarget.Latest, true);
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
    "packages/runtime-core/src/adapter-bridges.ts": `${source.slice(0, start)}${mutated}${source.slice(
      declaration.end,
    )}`,
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

test("accepts tracked deterministic M04-T14 adapter-bridge evidence", async () => {
  const result = await verifyRuntimeCoreAdapterBridgesEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.runtimeExports, 8);
  assert.equal(result.typeExports, 27);
  assert.equal(result.tsdocDeclarations, 35);
  assert.equal(result.focusedTests, 28);
  assert.equal(result.compilerNegativeCases, 11);
  assert.equal(result.rootMutationTests, 22);
  assert.equal(result.traceRules, 4);
  assert.equal(result.normativeTested, 1);
  assert.equal(result.trackedFiles, 11);
  assert.equal(result.requestLeaks, 0);
  assert.equal(result.platformEffects, 0);
});

test("builds byte-identical adapter-bridge evidence twice", async () => {
  const first = await buildRuntimeCoreAdapterBridgesEvidence();
  const second = await buildRuntimeCoreAdapterBridgesEvidence();
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.evidence.rootMutationTests, 21);
  assert.equal(first.currentRootMutationTests, 22);
  const tracked = new Map(
    first.artifact.evidence.trackedFiles.map((record) => [record.path, record]),
  );
  for (const [relativePath, historical] of Object.entries(HISTORICAL_TRANSFER_RECORDS)) {
    assert.deepEqual(tracked.get(relativePath), historical);
  }
});

test("rejects stale or tampered adapter-bridge evidence", async () => {
  const evidence = await buildRuntimeCoreAdapterBridgesEvidence();
  const bytes = Buffer.from(evidence.artifactBytes);
  bytes[bytes.length - 2] ^= 1;
  await rejectsCode(
    () => verifyRuntimeCoreAdapterBridgesEvidence({ artifactBytes: bytes }),
    "ADAPTER_BRIDGE_ARTIFACT_DRIFT",
  );
});

test("rejects relocated or duplicated M04-T14 artifact SHA pins", async () => {
  await rejectsCode(
    () =>
      verifyRuntimeCoreAdapterBridgesEvidence({
        buildOptions: { runtimeApi: Object.freeze({}) },
      }),
    "ADAPTER_BRIDGE_OPTIONS_INVALID",
  );
  const evidence = await buildRuntimeCoreAdapterBridgesEvidence();
  const [proofText, proofMatrixText] = await Promise.all([
    readFile(PROOF_DOCUMENT, "utf8"),
    readFile(PROOF_MATRIX, "utf8"),
  ]);
  const pinned = pinArtifactReferences(proofText, proofMatrixText, evidence.artifactSha256);
  const verifyWith = (proof, proofMatrix) =>
    verifyRuntimeCoreAdapterBridgesEvidence({
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
    "ADAPTER_BRIDGE_ARTIFACT_REFERENCE_DRIFT",
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
    "ADAPTER_BRIDGE_ARTIFACT_REFERENCE_DRIFT",
  );
  await rejectsCode(
    () =>
      verifyWith(
        `${pinned.proof.trimEnd()}\n\n\`${ARTIFACT_RELATIVE_PATH}\`.\nIts SHA-256 is \`${evidence.artifactSha256}\`.\n`,
        pinned.proofMatrix,
      ),
    "ADAPTER_BRIDGE_ARTIFACT_REFERENCE_DRIFT",
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
    "ADAPTER_BRIDGE_ARTIFACT_REFERENCE_DRIFT",
  );
  const matrixPair = `\`${ARTIFACT_FILE_NAME}\`\n\`sha256:${evidence.artifactSha256}\`.`;
  await rejectsCode(
    () =>
      verifyWith(
        pinned.proof,
        `${pinned.proofMatrix.replace(matrixPair, "")}\n## Relocated matrix evidence\n\n${matrixPair}\n`,
      ),
    "ADAPTER_BRIDGE_ARTIFACT_REFERENCE_DRIFT",
  );
  await rejectsCode(
    () =>
      verifyWith(
        pinned.proof,
        `${pinned.proofMatrix.trimEnd()}\n\`${ARTIFACT_FILE_NAME}\`\n\`sha256:${evidence.artifactSha256}\`.\n`,
      ),
    "ADAPTER_BRIDGE_ARTIFACT_REFERENCE_DRIFT",
  );
});

test("rejects stale M04-T07 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(REPEAT_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        prerequisiteBytes: { repeat: bytes },
      }),
    "ADAPTER_BRIDGE_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M04-T12 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(COMMAND_EVENT_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        prerequisiteBytes: { commandEvent: bytes },
      }),
    "ADAPTER_BRIDGE_PREREQUISITE_DRIFT",
  );
});

test("detects exact T12 Catalog, port-owner, and snapshot authority drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceMutation(
          "current.commandEventPorts === bound.commandEventPorts",
          "true",
        ),
      }),
    "ADAPTER_BRIDGE_T12_AUTHORITY_DRIFT",
  );
});

test("detects direct, replay, and foreign normalized-command admission drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceFunctionMutation("invokeComponentCommand", (source) =>
          source.replace("consumeRuntimeComponentCommandHostRequestForAdapterBridge(", "Boolean("),
        ),
      }),
    "ADAPTER_BRIDGE_COMMAND_AUTHORITY_DRIFT",
  );
});

test("detects least-authority adapter command request drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceMutation("input: detachedInput", "input: request"),
      }),
    "ADAPTER_BRIDGE_COMMAND_CONTAINMENT_DRIFT",
  );
});

test("detects Catalog attachTo capability-or-category drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceFunctionMutation("registerBehavior", (source) =>
          source.replace("!attachment.categories.has(ownerCategory)", "true"),
        ),
      }),
    "ADAPTER_BRIDGE_BEHAVIOR_AUTHORITY_DRIFT",
  );
});

test("detects exact owner ticket and ABA-generation drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceFunctionMutation("ticketForBinding", (source) =>
          source.replace(
            "binding.registrationGeneration === ticketAuthority.registrationGeneration",
            "true",
          ),
        ),
      }),
    "ADAPTER_BRIDGE_TICKET_AUTHORITY_DRIFT",
  );
});

test("detects detached scope retention and behavior double-charge drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceFunctionMutation("registerBehavior", (source) =>
          source.replace(
            "reserveRegistration(authority, handledEvents, retainedCodeUnits, 0, 0)",
            "reserveRegistration(authority, handledEvents, retainedCodeUnits, 1, 1)",
          ),
        ),
      }),
    "ADAPTER_BRIDGE_BEHAVIOR_AUTHORITY_DRIFT",
  );
});

test("detects future unregister snapshot-reservation drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceMutation(
          "authority.limits.maxSnapshotGeneration - nextSnapshotGeneration < authority.bindings.size + 1",
          "false",
        ),
      }),
    "ADAPTER_BRIDGE_RESERVATION_DRIFT",
  );
});

test("detects declaration-before-payload and single-validator drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceMutation("!authority.bound.declaredEvents.has(", "Boolean("),
      }),
    "ADAPTER_BRIDGE_EVENT_ORDER_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceMutation(
          "validateDesenEventPayload(",
          "validateDesenEventPayload /* drift */ (",
        ),
      }),
    "ADAPTER_BRIDGE_EVENT_ORDER_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceMutation(
          "const validation = validateDesenEventPayload(",
          "void validateDesenEventPayload();\n    const validation = validateDesenEventPayload(",
        ),
      }),
    "ADAPTER_BRIDGE_EVENT_VALIDATION_DRIFT",
  );
});

test("detects post-validation authority and live-binding recheck drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceFunctionMutation("receiveRuntimeAdapterEvent", (source) => {
          const anchor = "if (!currentCommandAuthority(authority))";
          const position = source.lastIndexOf(anchor);
          assert.ok(position >= 0);
          return `${source.slice(0, position)}if (false)${source.slice(position + anchor.length)}`;
        }),
      }),
    "ADAPTER_BRIDGE_EVENT_ORDER_DRIFT",
  );
});

test("detects busy fences around command, reflection, and event dispatch", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceFunctionMutation("invokeComponentCommand", (source) =>
          source.replace(
            'const status = captureClosedStatus(result, ["succeeded", "denied"]);',
            'authority.commandActive = false;\n    const status = captureClosedStatus(result, ["succeeded", "denied"]);',
          ),
        ),
      }),
    "ADAPTER_BRIDGE_COMMAND_AUTHORITY_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceFunctionMutation("invokeComponentCommand", (source) => {
          const anchor = "!currentCommandAuthority(authority)";
          const position = source.lastIndexOf(anchor);
          assert.ok(position >= 0);
          return `${source.slice(0, position)}false${source.slice(position + anchor.length)}`;
        }),
      }),
    "ADAPTER_BRIDGE_COMMAND_AUTHORITY_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceFunctionMutation("disposeRuntimeAdapterBridges", (source) =>
          source.replace("authority.eventActivityDepth > 0", "false"),
        ),
      }),
    "ADAPTER_BRIDGE_REENTRY_FENCE_DRIFT",
  );
});

test("detects current-snapshot cleanup, revocation, and terminal tombstone drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceFunctionMutation("disposeRuntimeAdapterBridges", (source) =>
          source.replace('authority.status = "revoked"', 'authority.status = "bound"'),
        ),
      }),
    "ADAPTER_BRIDGE_DISPOSAL_DRIFT",
  );
});

test("detects lower-only finite-limit drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceMutation("maxLiveBindings: 5_000", "maxLiveBindings: Infinity"),
      }),
    "ADAPTER_BRIDGE_LIMIT_DRIFT",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceFunctionMutation("registerComponent", (source) =>
          source.replace(
            "handledEventsValue.value,\n    authority.limits.maxEventHandlerBindings,\n",
            "handledEventsValue.value,\n    authority.limits.maxEventHandlerBindings - authority.liveHandlerBindings,\n",
          ),
        ),
      }),
    "ADAPTER_BRIDGE_HANDLER_BUDGET_DRIFT",
  );
});

test("detects trace, normative, finding, and proof-document drift", async () => {
  const trace = JSON.parse(await readFile(TRACE, "utf8"));
  trace.proseRules.find(({ id }) => id === "R-044").owners = [];
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "docs/proof/protocol-0.1.0-traceability.json": JSON.stringify(trace),
        },
      }),
    "ADAPTER_BRIDGE_TRACE_DRIFT",
  );
  const pipelineTrace = JSON.parse(await readFile(TRACE, "utf8"));
  pipelineTrace.pipelineSteps.find(({ id }) => id === "PIPE-023").owners = [];
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "docs/proof/protocol-0.1.0-traceability.json": JSON.stringify(pipelineTrace),
        },
      }),
    "ADAPTER_BRIDGE_TRACE_DRIFT",
  );
  const normative = await readFile(NORMATIVE, "utf8");
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "docs/proof/NORMATIVE-COVERAGE.md": normative.replace("| N-033 |", "| N-033-X |"),
        },
      }),
    "ADAPTER_BRIDGE_NORMATIVE_DRIFT",
  );
  const normativeWithoutT14Owner = normative
    .split(/\r?\n/u)
    .map((line) => {
      if (!line.startsWith("| N-033 ")) return line;
      const cells = line.split("|");
      cells[4] = ` ${cells[4]
        .split(",")
        .map((owner) => owner.trim())
        .filter((owner) => owner !== "M04-T14")
        .join(", ")} `;
      return cells.join("|");
    })
    .join("\n");
  assert.ok(normativeWithoutT14Owner.includes("M04-T14 now admits"));
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "docs/proof/NORMATIVE-COVERAGE.md": normativeWithoutT14Owner,
        },
      }),
    "ADAPTER_BRIDGE_NORMATIVE_DRIFT",
  );
  const [findings, proof] = await Promise.all([
    readFile(FINDINGS, "utf8"),
    readFile(PROOF_DOCUMENT, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "docs/plan/PROTOCOL-FINDINGS.md": findings.replace("## PF-044", "## PF-044-X"),
          "docs/proof/RUNTIME-CORE-ADAPTER-BRIDGES.md": proof,
        },
      }),
    "ADAPTER_BRIDGE_DOCUMENTATION_DRIFT",
  );
});

test("detects public export and TSDoc drift", async () => {
  const [index, source, builtAdapter, builtIndex, builtIndexDeclaration] = await Promise.all([
    readFile(SOURCE_INDEX, "utf8"),
    sourceText(),
    readFile(BUILT_ADAPTER, "utf8"),
    readFile(BUILT_INDEX, "utf8"),
    readFile(BUILT_INDEX_DECLARATION, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": index.replace(
            "  receiveRuntimeAdapterEvent,\n",
            "",
          ),
        },
      }),
    "ADAPTER_BRIDGE_INDEX_EXPORT_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/src/adapter-bridges.ts": source.replace(
            "/** Finite default ceilings",
            "/* Finite default ceilings",
          ),
        },
      }),
    "ADAPTER_BRIDGE_TSDOC_MISSING",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/src/adapter-bridges.ts": `${source}\n/** Hostile source export. */\nexport class LeakedAdapterAuthority {}\n`,
        },
      }),
    "ADAPTER_BRIDGE_PUBLIC_API_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/src/adapter-bridges.ts": `${source}\nconst leakedSourceAuthority = true;\nexport { leakedSourceAuthority };\n`,
        },
      }),
    "ADAPTER_BRIDGE_PUBLIC_API_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/src/adapter-bridges.ts": `${source}\nexport default Object.freeze({});\n`,
        },
      }),
    "ADAPTER_BRIDGE_PUBLIC_API_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/src/adapter-bridges.ts": `${source}\nexport * from "./command-event-actions.js";\n`,
        },
      }),
    "ADAPTER_BRIDGE_PUBLIC_API_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/dist/adapter-bridges.js": `${builtAdapter}\nexport const leakedDistributionAuthority = true;\n`,
        },
      }),
    "ADAPTER_BRIDGE_DISTRIBUTION_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/dist/adapter-bridges.js": `${builtAdapter}\nconst leakedDistributionAuthority = true;\nexport { leakedDistributionAuthority };\n`,
        },
      }),
    "ADAPTER_BRIDGE_DISTRIBUTION_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/dist/adapter-bridges.js": `${builtAdapter}\nexport default Object.freeze({});\n`,
        },
      }),
    "ADAPTER_BRIDGE_DISTRIBUTION_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/dist/adapter-bridges.js": `${builtAdapter}\nexport * from "./command-event-actions.js";\n`,
        },
      }),
    "ADAPTER_BRIDGE_DISTRIBUTION_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/dist/index.js": removeModuleExportDeclaration(
            builtIndex,
            "index.js",
            "./adapter-bridges.js",
            false,
          ),
        },
      }),
    "ADAPTER_BRIDGE_DISTRIBUTION_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/dist/index.d.ts": removeModuleExportDeclaration(
            builtIndexDeclaration,
            "index.d.ts",
            "./adapter-bridges.js",
            false,
          ),
        },
      }),
    "ADAPTER_BRIDGE_DISTRIBUTION_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/dist/index.d.ts": removeModuleExportDeclaration(
            builtIndexDeclaration,
            "index.d.ts",
            "./adapter-bridges.js",
            true,
          ),
        },
      }),
    "ADAPTER_BRIDGE_DISTRIBUTION_DRIFT",
  );
});

test("detects scoped authority leaks while preserving forward-compatible root exports", async () => {
  const [index, source] = await Promise.all([readFile(SOURCE_INDEX, "utf8"), sourceText()]);
  const futureRoot = await buildRuntimeCoreAdapterBridgesEvidence({
    fileOverrides: {
      "packages/runtime-core/src/index.ts": `${index}\nexport { FutureCoordinator } from "./future-coordinator.js";\n`,
    },
  });
  assert.equal(futureRoot.artifact.result, "PASS");
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": `${index}\nexport { readRuntimeCommandEventActionsForAdapterBridge } from "./command-event-actions.js";\n`,
        },
      }),
    "ADAPTER_BRIDGE_INTERNAL_EXPORT_LEAK",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": `${index}\nimport { readRuntimeCommandEventActionsForAdapterBridge as leakedAuthority } from "./command-event-actions.js";\nexport { leakedAuthority };\n`,
        },
      }),
    "ADAPTER_BRIDGE_INTERNAL_EXPORT_LEAK",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": `${index}\nexport * from "./command-event-actions.js";\n`,
        },
      }),
    "ADAPTER_BRIDGE_INTERNAL_EXPORT_LEAK",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": `${index}\nexport { consumeRuntimeComponentCommandHostRequestForAdapterBridge as leakedAuthority } from "./command-event-ports.js";\n`,
        },
      }),
    "ADAPTER_BRIDGE_INTERNAL_EXPORT_LEAK",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceMutation(
          "const request = Object.freeze({\n      eventId,",
          "const request = Object.freeze({\n      ticket: input.ticket,\n      eventId,",
        ),
      }),
    "ADAPTER_BRIDGE_EVENT_REQUEST_LEAK",
  );
  await rejectsCode(
    async () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: await sourceMutation(
          "const LOCAL_IDENTIFIER_PATTERN",
          "void window;\nconst LOCAL_IDENTIFIER_PATTERN",
        ),
      }),
    "ADAPTER_BRIDGE_PLATFORM_BOUNDARY_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/src/adapter-bridges.ts": `${source}\nimport { EventEmitter as E } from "node:events";\nvoid E;\n`,
        },
      }),
    "ADAPTER_BRIDGE_PLATFORM_BOUNDARY_DRIFT",
  );
});

test("detects focused and compiler-negative inventory drift", async () => {
  const [focused, types, rootTests] = await Promise.all([
    readFile(FOCUSED_TESTS, "utf8"),
    readFile(TYPE_TESTS, "utf8"),
    readFile(new URL(import.meta.url), "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/test/adapter-bridges.test.ts": focused.replace(
            /\bit\(/u,
            "it.skip(",
          ),
        },
      }),
    "ADAPTER_BRIDGE_TEST_INVENTORY_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          "packages/runtime-core/test/adapter-bridges.types.ts": types.replace(
            /\/\/ @ts-expect-error [^\r\n]+\r?\n/u,
            "",
          ),
        },
      }),
    "ADAPTER_BRIDGE_TYPE_TEST_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreAdapterBridgesEvidence({
        fileOverrides: {
          [ROOT_TEST_PATH]: rootTests.replace(
            "rejects relocated or duplicated M04-T14 artifact SHA pins",
            "accepts relocated M04-T14 artifact SHA pins",
          ),
        },
      }),
    "ADAPTER_BRIDGE_ROOT_TEST_INVENTORY_DRIFT",
  );
});
