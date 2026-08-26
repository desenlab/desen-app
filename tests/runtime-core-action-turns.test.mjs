import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ts from "typescript";

import {
  RuntimeCoreActionTurnsEvidenceError,
  buildRuntimeCoreActionTurnsEvidence,
  verifyRuntimeCoreActionTurnsEvidence,
} from "../scripts/lib/runtime-core-action-turns-proof.mjs";

import * as runtimeApi from "../packages/runtime-core/dist/index.js";

const STATE_NAVIGATION_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-state-navigation-actions.json",
  import.meta.url,
);
const OPERATION_RESOURCE_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-operation-resource-actions.json",
  import.meta.url,
);
const COMMAND_EVENT_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-command-event-actions.json",
  import.meta.url,
);
const ACTION_SOURCE = new URL("../packages/runtime-core/src/action-turns.ts", import.meta.url);
const SOURCE_INDEX = new URL("../packages/runtime-core/src/index.ts", import.meta.url);
const PACKAGE_TESTS = new URL(
  "../packages/runtime-core/test/action-turns.test.ts",
  import.meta.url,
);
const TYPE_TESTS = new URL("../packages/runtime-core/test/action-turns.types.ts", import.meta.url);
const TRACE = new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url);
const NORMATIVE = new URL("../docs/proof/NORMATIVE-COVERAGE.md", import.meta.url);
const FINDINGS = new URL("../docs/plan/PROTOCOL-FINDINGS.md", import.meta.url);
const PROOF_DOCUMENT = new URL("../docs/proof/RUNTIME-CORE-ACTION-TURNS.md", import.meta.url);

async function rejectsCode(action, expectedCode) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof RuntimeCoreActionTurnsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

function withRuntime(overrides) {
  return Object.freeze({ ...runtimeApi, ...overrides });
}

function withCompletionMutation(transform) {
  return withRuntime({
    executeRuntimeActionTurn(handle, request) {
      const result = runtimeApi.executeRuntimeActionTurn(handle, request);
      if (result.status !== "started" && result.status !== "queued") return result;
      return Object.freeze({
        ...result,
        completion: result.completion.then(transform),
      });
    },
  });
}

async function sourceText() {
  return readFile(ACTION_SOURCE, "utf8");
}

async function sourceMutation(from, to = "") {
  const source = await sourceText();
  assert.ok(source.includes(from), `Mutation anchor is missing: ${from}`);
  return {
    "packages/runtime-core/src/action-turns.ts": source.replace(from, to),
  };
}

async function sourceFunctionMutation(functionName, transform) {
  const source = await sourceText();
  const parsed = ts.createSourceFile("action-turns.ts", source, ts.ScriptTarget.Latest, true);
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
    "packages/runtime-core/src/action-turns.ts": `${source.slice(0, start)}${mutated}${source.slice(
      declaration.end,
    )}`,
  };
}

test("accepts tracked deterministic M04-T13 action-turn evidence", async () => {
  const result = await verifyRuntimeCoreActionTurnsEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.traceRules, 5);
  assert.equal(result.trackedFiles, 11);
  assert.equal(result.rootMutationTests, 32);
  assert.equal(result.focusedTests, 43);
  assert.equal(result.compilerNegativeCases, 11);
  assert.equal(result.preparedProgramProbes, 5);
  assert.equal(result.mountProbes, 7);
  assert.equal(result.dispatchProbes, 9);
  assert.equal(result.orderProbes, 11);
  assert.equal(result.snapshotProbes, 15);
  assert.equal(result.queueProbes, 27);
  assert.equal(result.settlementProbes, 32);
  assert.equal(result.finalizationProbes, 24);
  assert.equal(result.limitProbes, 15);
  assert.equal(result.disposalProbes, 12);
  assert.equal(result.delegateCalls, 107);
  assert.equal(result.duplicateEffects, 0);
  assert.equal(result.platformEffects, 0);
});

test("builds byte-identical action-turn evidence twice", async () => {
  const first = await buildRuntimeCoreActionTurnsEvidence();
  const second = await buildRuntimeCoreActionTurnsEvidence();
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or tampered action-turn evidence", async () => {
  const evidence = await buildRuntimeCoreActionTurnsEvidence();
  const bytes = Buffer.from(evidence.artifactBytes);
  bytes[bytes.length - 2] ^= 1;
  await rejectsCode(
    () => verifyRuntimeCoreActionTurnsEvidence({ artifactBytes: bytes }),
    "ACTION_TURN_ARTIFACT_DRIFT",
  );
});

test("rejects stale M04-T10 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(STATE_NAVIGATION_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreActionTurnsEvidence({
        prerequisiteBytes: { stateNavigation: bytes },
      }),
    "ACTION_TURN_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M04-T11 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(OPERATION_RESOURCE_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreActionTurnsEvidence({
        prerequisiteBytes: { operationResource: bytes },
      }),
    "ACTION_TURN_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M04-T12 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(COMMAND_EVENT_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreActionTurnsEvidence({
        prerequisiteBytes: { commandEvent: bytes },
      }),
    "ACTION_TURN_PREREQUISITE_DRIFT",
  );
});

test("detects prepared-program brand, inert-copy, and deep-freeze drift", async () => {
  const mutated = withRuntime({
    prepareRuntimeActionProgram(actions) {
      const result = runtimeApi.prepareRuntimeActionProgram(actions);
      return result.status === "prepared"
        ? Object.freeze({ ...result, program: Object.freeze({ forged: true }) })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreActionTurnsEvidence({ runtimeApi: mutated }),
    "ACTION_TURN_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects private route metadata and coordinator discriminator-read drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceMutation(
          "const PROGRAM_AUTHORITIES = new WeakMap",
          "const PROGRAM_AUTHORITIES = new Map",
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects duplicate child delegation and cross-family dispatch drift", async () => {
  const mutated = withRuntime({
    executeRuntimeActionTurn(handle, request) {
      const first = runtimeApi.executeRuntimeActionTurn(handle, request);
      runtimeApi.executeRuntimeActionTurn(handle, request);
      return first;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreActionTurnsEvidence({ runtimeApi: mutated }),
    "ACTION_TURN_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects source-order, skipped-continue, and failed-stop drift", async () => {
  const mutated = withCompletionMutation((completion) =>
    Object.freeze({ ...completion, steps: Object.freeze([...completion.steps].reverse()) }),
  );
  await rejectsCode(
    () => buildRuntimeCoreActionTurnsEvidence({ runtimeApi: mutated }),
    "ACTION_TURN_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects the exact 64/65 action boundary and core diagnostic drift", async () => {
  const mutated = withRuntime({
    prepareRuntimeActionProgram(actions) {
      const result = runtimeApi.prepareRuntimeActionProgram(actions);
      return result.status === "prepared" && result.actionCount === 65
        ? Object.freeze({ ...result, overflow: false })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreActionTurnsEvidence({ runtimeApi: mutated }),
    "ACTION_TURN_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects the exact 16/17 settlement-depth and parent-depth drift", async () => {
  const mutated = withCompletionMutation((completion) =>
    Object.freeze({ ...completion, settlementDepth: 17 }),
  );
  await rejectsCode(
    () => buildRuntimeCoreActionTurnsEvidence({ runtimeApi: mutated }),
    "ACTION_TURN_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects repeated synchronous-transition ceiling drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceMutation(
          "maxSynchronousTurnTransitions: 64",
          "maxSynchronousTurnTransitions: 63",
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects reentrant FIFO and outer-turn completion-order drift", async () => {
  const mutated = withCompletionMutation((completion) =>
    Object.freeze({ ...completion, turnId: `${completion.turnId}:reordered` }),
  );
  await rejectsCode(
    () => buildRuntimeCoreActionTurnsEvidence({ runtimeApi: mutated }),
    "ACTION_TURN_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects shared queue reservation and retained-action/code-unit drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceMutation(
          "maxRetainedQueuedActions: 4_096",
          "maxRetainedQueuedActions: 4_095",
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects four fresh reads and current resolution-snapshot rebuild drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceMutation(
          "readRuntimeSurfaceState(authority.stateHandle)",
          "readRuntimeSurfaceState({})",
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects invalid-snapshot retry and duplicate-effect drift", async () => {
  const mutated = withCompletionMutation((completion) =>
    completion.status === "terminated" && completion.reason === "invalid-snapshot"
      ? Object.freeze({
          ...completion,
          steps: Object.freeze([...completion.steps, ...completion.steps]),
        })
      : completion,
  );
  await rejectsCode(
    () => buildRuntimeCoreActionTurnsEvidence({ runtimeApi: mutated }),
    "ACTION_TURN_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects monotonic command-registry snapshot adoption drift", async () => {
  const mutated = withCompletionMutation((completion) =>
    Object.freeze({
      ...completion,
      snapshot: Object.freeze({
        ...completion.snapshot,
        commandEventSnapshot: Object.freeze({
          ...completion.snapshot.commandEventSnapshot,
          generation: 0,
        }),
      }),
    }),
  );
  await rejectsCode(
    () => buildRuntimeCoreActionTurnsEvidence({ runtimeApi: mutated }),
    "ACTION_TURN_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects navigation terminality and queued old-surface cancellation drift", async () => {
  const mutated = withCompletionMutation((completion) =>
    completion.status === "navigated" || completion.status === "disposed"
      ? Object.freeze({ ...completion, status: "completed" })
      : completion,
  );
  await rejectsCode(
    () => buildRuntimeCoreActionTurnsEvidence({ runtimeApi: mutated }),
    "ACTION_TURN_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects settlement branch, nonblocking, and event-scope fence drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceMutation("event: UNAVAILABLE_EVENT", "event: scope.event"),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects empty-handler and successful-handler finalization drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceMutation('finalized.status === "finalized"', "false"),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects failure, throw, limit, navigation, and disposal finalization drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceMutation(
          'if (item.origin === "settlement") {',
          'if (item.origin === "never") {',
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects staged same-alias promotion and finalization safe-point drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceMutation(
          "const finalized = finalizeSettlementItem(authority, item);",
          "const finalized = true;",
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects finite turn-generation and pending-settlement reservation drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceMutation(
          "maxTurnGeneration: Number.MAX_SAFE_INTEGER",
          "maxTurnGeneration: Infinity",
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects hostile admission, reporting reentry, and completion-promise drift", async () => {
  const mutated = withRuntime({
    executeRuntimeActionTurn() {
      return Object.freeze({
        status: "started",
        turnId: "forged",
        snapshot: Object.freeze({}),
        completion: Promise.reject(new Error("must never reject")),
      });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreActionTurnsEvidence({ runtimeApi: mutated }),
    "ACTION_TURN_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects process initial-resolution and catch containment drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("processWorkItem", (source) =>
          source.replace(
            [
              "  try {",
              "    const initialResolution = composeResolutionSnapshot(authority, item.scope);",
            ].join("\n"),
            [
              "  const initialResolution = composeResolutionSnapshot(authority, item.scope);",
              "  try {",
            ].join("\n"),
          ),
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );

  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("processWorkItem", (source) => {
          const catchStart = source.indexOf('\n  } catch {\n    completionStatus = "disposed";');
          const finallyStart = source.indexOf("\n  } finally {", catchStart);
          assert.ok(catchStart >= 0 && finallyStart > catchStart);
          return `${source.slice(
            0,
            catchStart,
          )}\n  } catch {\n    throw new TypeError("mutated process escape");${source.slice(
            finallyStart,
          )}`;
        }),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects one-shot settlement-finalizer containment drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation(
          "attemptSettlementTicketFinalization",
          (source) =>
            source.replace(
              [
                '  if (ATTEMPTED_SETTLEMENT_FINALIZATION_TICKETS.has(ticket)) return "already-attempted";',
                "  ATTEMPTED_SETTLEMENT_FINALIZATION_TICKETS.add(ticket);",
              ].join("\n"),
              "",
            ),
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );

  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation(
          "attemptSettlementTicketFinalization",
          (source) => {
            const returnStart = source.indexOf(
              "  try {\n    return finalizeRuntimeOperationActionSettlement(",
            );
            const catchStart = source.indexOf(
              '\n  } catch {\n    return "failed";\n  }',
              returnStart,
            );
            assert.ok(returnStart >= 0 && catchStart > returnStart);
            const tryBody = source.slice(returnStart + "  try {\n".length, catchStart);
            const catchEnd = catchStart + '\n  } catch {\n    return "failed";\n  }'.length;
            return `${source.slice(0, returnStart)}${tryBody}${source.slice(catchEnd)}`;
          },
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );

  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("processWorkItem", (source) => {
          const finalResolution = [
            "    const finalResolution = composeResolutionSnapshot(authority, item.scope);",
            "    if (finalResolution !== undefined) resolutionSnapshot = finalResolution;",
            "",
          ].join("\n");
          assert.ok(source.includes(finalResolution));
          const withoutFinalResolution = source.replace(finalResolution, "");
          return withoutFinalResolution.replace(
            '    if (item.origin === "settlement") {',
            `${finalResolution}    if (item.origin === "settlement") {`,
          );
        }),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );

  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("processWorkItem", (source) =>
          source.replace(
            [
              '    if (completionStatus === "navigated" || completionStatus === "disposed") {',
              "      try {",
              "        disposeRuntimeActionTurns(handle);",
              "      } catch {",
              '        completionStatus = "disposed";',
              "        terminationReason = undefined;",
              "        navigationSurface = undefined;",
              "      }",
              "    }",
            ].join("\n"),
            [
              '    if (completionStatus === "navigated" || completionStatus === "disposed") {',
              "      disposeRuntimeActionTurns(handle);",
              "    }",
            ].join("\n"),
          ),
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects operation/resource settlement callback containment drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation(
          "finalizeDetachedSettlementDescriptor",
          (source) =>
            source.replace(
              "  attemptSettlementTicketFinalization(authority, descriptor.ticket);",
              [
                "  finalizeRuntimeOperationActionSettlement(",
                "    authority.operationResourceActionsHandle,",
                "    descriptor.ticket,",
                "  );",
              ].join("\n"),
            ),
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );

  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("attachOperationSettlement", (source) =>
          source.replace(
            [
              "          try {",
              "            enqueueSettlementDescriptor(handle, authority, reservation, descriptor);",
              "          } catch {",
              "            containOperationSettlementCallbackFailure(handle, authority, reservation, descriptor);",
              "          }",
            ].join("\n"),
            "          enqueueSettlementDescriptor(handle, authority, reservation, descriptor);",
          ),
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );

  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("attachOperationSettlement", (source) => {
          const catchStart = source.indexOf("\n      .catch(() => {");
          const catchEndStart = source.indexOf("\n      });", catchStart);
          assert.ok(catchStart >= 0 && catchEndStart > catchStart);
          return `${source.slice(0, catchStart)};${source.slice(
            catchEndStart + "\n      });".length,
          )}`;
        }),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );

  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("attachResourceSettlement", (source) =>
          source.replace(
            [
              "          try {",
              "            observeResourceSettlement(handle, authority, result);",
              "          } catch {",
              "            containCoordinatorFailure(handle, authority);",
              "          }",
            ].join("\n"),
            "          observeResourceSettlement(handle, authority, result);",
          ),
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );

  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("attachResourceSettlement", (source) =>
          source.replace(
            "        () => containCoordinatorFailure(handle, authority),",
            "        () => undefined,",
          ),
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects drain emergency-completion containment drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("drainQueue", (source) => {
          const catchStart = source.indexOf(
            '\n      } catch {\n        if (item.origin === "settlement")',
          );
          const finallyStart = source.indexOf("\n      } finally {", catchStart);
          assert.ok(catchStart >= 0 && finallyStart > catchStart);
          return `${source.slice(
            0,
            catchStart,
          )}\n      } catch {\n        throw new TypeError("mutated drain escape");${source.slice(
            finallyStart,
          )}`;
        }),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );

  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("drainQueue", (source) =>
          source.replace(
            "item.resolve(completion ?? item.emergencyCompletion)",
            "item.resolve(completion)",
          ),
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects admission-time native completion resolution drift", async () => {
  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("makeEmergencyEventCompletion", (source) =>
          source.replace("return Object.freeze({", "return Object({"),
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );

  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("executeRuntimeActionTurn", (source) =>
          source.replace(
            "new Promise<RuntimeActionTurnCompletion>",
            "Promise.resolve<RuntimeActionTurnCompletion>",
          ),
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );

  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("executeRuntimeActionTurn", (source) =>
          source.replace("      emergencyCompletion,\n      resolve:", "      resolve:"),
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );

  await rejectsCode(
    async () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: await sourceFunctionMutation("resolveDisposedEventItem", (source) =>
          source.replace("  item.resolve(completion);", "  void completion;"),
        ),
      }),
    "ACTION_TURN_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects task-owned byte, trace, normative, and proof-document drift", async () => {
  const evidence = await buildRuntimeCoreActionTurnsEvidence();
  const typeTests = await readFile(TYPE_TESTS, "utf8");
  await rejectsCode(
    () =>
      verifyRuntimeCoreActionTurnsEvidence({
        artifactBytes: evidence.artifactBytes,
        buildOptions: {
          fileOverrides: {
            "packages/runtime-core/test/action-turns.types.ts": `${typeTests}\n`,
          },
        },
      }),
    "ACTION_TURN_ARTIFACT_DRIFT",
  );

  const trace = JSON.parse(await readFile(TRACE, "utf8"));
  const rule = trace.proseRules.find(({ id }) => id === "R-081");
  rule.owners = [];
  await rejectsCode(
    () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: {
          "docs/proof/protocol-0.1.0-traceability.json": JSON.stringify(trace),
        },
      }),
    "ACTION_TURN_TRACE_DRIFT",
  );

  const normative = await readFile(NORMATIVE, "utf8");
  const normativeMutations = [
    normative.replace("| N-032 |", "| N-032-MUTATED |"),
    normative.replace(/^(\| N-014 \|.*?\| )TESTED(\s+\|)/mu, "$1PLANNED$2"),
    normative.replace(/^(\| N-032 \|.*?\| )TESTED(\s+\|)/mu, "$1PLANNED$2"),
    normative.replace(/^(\| N-041 \|.*?\| )PLANNED(\s+\|)/mu, "$1TESTED$2"),
    normative.replace(/^(\| N-014 \|.*?\| .*?), M08-T03(\s+\| TESTED\s+\|)/mu, "$1$2"),
    normative.replace(
      "sha256:0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b",
      "sha256:1d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b",
    ),
    normative.replace(/^(\| N-014 \|.*)$/mu, "$1\n$1"),
  ];
  for (const mutatedNormative of normativeMutations) {
    assert.notEqual(mutatedNormative, normative);
    await rejectsCode(
      () =>
        buildRuntimeCoreActionTurnsEvidence({
          fileOverrides: {
            "docs/proof/NORMATIVE-COVERAGE.md": mutatedNormative,
          },
        }),
      "ACTION_TURN_NORMATIVE_DRIFT",
    );
  }

  const [findings, proof] = await Promise.all([
    readFile(FINDINGS, "utf8"),
    readFile(PROOF_DOCUMENT, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: {
          "docs/plan/PROTOCOL-FINDINGS.md": findings.replace("## PF-043", "## PF-043-MUTATED"),
          "docs/proof/RUNTIME-CORE-ACTION-TURNS.md": proof,
        },
      }),
    "ACTION_TURN_DOCUMENTATION_DRIFT",
  );
});

test("detects public export, TSDoc, internal non-leak, platform, focused-test, and compiler-negative inventory drift", async () => {
  const [index, source, packageTests, typeTests] = await Promise.all([
    readFile(SOURCE_INDEX, "utf8"),
    sourceText(),
    readFile(PACKAGE_TESTS, "utf8"),
    readFile(TYPE_TESTS, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": index.replace("  executeRuntimeActionTurn,\n", ""),
        },
      }),
    "ACTION_TURN_INDEX_EXPORT_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/action-turns.ts": source.replace(
            "/** Reference-profile ceilings",
            "/* Reference-profile ceilings",
          ),
        },
      }),
    "ACTION_TURN_TSDOC_MISSING",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": `${index}\nexport { readRuntimeStateNavigationActions } from "./state-navigation-actions.js";\n`,
        },
      }),
    "ACTION_TURN_INTERNAL_EXPORT_LEAK",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/action-turns.ts": `${source}\nvoid window;\n`,
        },
      }),
    "ACTION_TURN_PLATFORM_BOUNDARY_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: {
          "packages/runtime-core/test/action-turns.test.ts": packageTests.replace(
            /\bit\(/u,
            "it.skip(",
          ),
        },
      }),
    "ACTION_TURN_TEST_INVENTORY_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreActionTurnsEvidence({
        fileOverrides: {
          "packages/runtime-core/test/action-turns.types.ts": typeTests.replace(
            /\/\/ @ts-expect-error [^\r\n]+\r?\n/u,
            "",
          ),
        },
      }),
    "ACTION_TURN_TYPE_TEST_DRIFT",
  );
});
