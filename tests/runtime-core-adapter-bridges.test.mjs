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

test("accepts tracked deterministic M04-T14 adapter-bridge evidence", async () => {
  const result = await verifyRuntimeCoreAdapterBridgesEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.runtimeExports, 8);
  assert.equal(result.typeExports, 27);
  assert.equal(result.tsdocDeclarations, 35);
  assert.equal(result.focusedTests, 27);
  assert.equal(result.compilerNegativeCases, 10);
  assert.equal(result.rootMutationTests, 21);
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
          "packages/runtime-core/dist/adapter-bridges.js": `${builtAdapter}\nexport * from \"./command-event-actions.js\";\n`,
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
  const [focused, types] = await Promise.all([
    readFile(FOCUSED_TESTS, "utf8"),
    readFile(TYPE_TESTS, "utf8"),
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
});
