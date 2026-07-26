import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RuntimeCoreCommandEventActionsEvidenceError,
  buildRuntimeCoreCommandEventActionsEvidence,
  verifyRuntimeCoreCommandEventActionsEvidence,
} from "../scripts/lib/runtime-core-command-event-actions-proof.mjs";

import * as runtimePortApi from "../packages/runtime-core/dist/command-event-ports.js";
import * as runtimeApi from "../packages/runtime-core/dist/index.js";

const STATE_NAVIGATION_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-state-navigation-actions.json",
  import.meta.url,
);
const INTERACTION_CONTRACT_ARTIFACT = new URL(
  "../docs/proof/artifacts/protocol-0.1.0-interaction-contracts.json",
  import.meta.url,
);
const EXECUTION_CONTRACT_ARTIFACT = new URL(
  "../docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
  import.meta.url,
);
const PORT_SOURCE = new URL("../packages/runtime-core/src/command-event-ports.ts", import.meta.url);
const ACTION_SOURCE = new URL(
  "../packages/runtime-core/src/command-event-actions.ts",
  import.meta.url,
);
const SOURCE_INDEX = new URL("../packages/runtime-core/src/index.ts", import.meta.url);
const PACKAGE_TESTS = new URL(
  "../packages/runtime-core/test/command-event-actions.test.ts",
  import.meta.url,
);
const TYPE_TESTS = new URL(
  "../packages/runtime-core/test/command-event-actions.types.ts",
  import.meta.url,
);

async function rejectsCode(action, expectedCode) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof RuntimeCoreCommandEventActionsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

function withRuntime(overrides) {
  return Object.freeze({ ...runtimeApi, ...overrides });
}

function withPorts(overrides) {
  return Object.freeze({ ...runtimePortApi, ...overrides });
}

test("accepts tracked deterministic M04-T12 command/event evidence", async () => {
  const result = await verifyRuntimeCoreCommandEventActionsEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.runtimeExports, 7);
  assert.equal(result.typeExports, 25);
  assert.equal(result.internalRuntimeExports, 4);
  assert.equal(result.internalTypeExports, 3);
  assert.equal(result.focusedTests, 53);
  assert.equal(result.compilerNegativeCases, 21);
  assert.equal(result.rootMutationTests, 19);
  assert.equal(result.traceRules, 6);
  assert.equal(result.normativeTested, 1);
  assert.equal(result.trackedFiles, 16);
  assert.equal(result.hostilePayloadReads, 0);
  assert.equal(result.falseGuardEffects, 0);
  assert.equal(result.falseGuardDiagnosticCalls, 0);
  assert.equal(result.rawHostFailuresExposed, false);
  assert.equal(result.platformEffects, 0);
});

test("builds byte-identical command/event evidence twice", async () => {
  const first = await buildRuntimeCoreCommandEventActionsEvidence();
  const second = await buildRuntimeCoreCommandEventActionsEvidence();
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or tampered command/event evidence", async () => {
  const evidence = await buildRuntimeCoreCommandEventActionsEvidence();
  const tampered = Buffer.from(evidence.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await rejectsCode(
    () => verifyRuntimeCoreCommandEventActionsEvidence({ artifactBytes: tampered }),
    "COMMAND_EVENT_ACTION_ARTIFACT_DRIFT",
  );
});

test("rejects stale M04-T10 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(STATE_NAVIGATION_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreCommandEventActionsEvidence({
        prerequisiteBytes: { stateNavigation: bytes },
      }),
    "COMMAND_EVENT_ACTION_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M02-T09 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(INTERACTION_CONTRACT_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreCommandEventActionsEvidence({
        prerequisiteBytes: { interactionContracts: bytes },
      }),
    "COMMAND_EVENT_ACTION_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M02-T11 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(EXECUTION_CONTRACT_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreCommandEventActionsEvidence({
        prerequisiteBytes: { executionContracts: bytes },
      }),
    "COMMAND_EVENT_ACTION_PREREQUISITE_DRIFT",
  );
});

test("detects guard-first hostile observation drift", async () => {
  const mutated = withRuntime({
    executeRuntimeCommandEventAction(handle, action, ...rest) {
      Reflect.get(action, "type");
      return runtimeApi.executeRuntimeCommandEventAction(handle, action, ...rest);
    },
  });
  await assert.rejects(() => buildRuntimeCoreCommandEventActionsEvidence({ runtimeApi: mutated }));
});

test("detects shared token-session and command input drift", async () => {
  const mutated = withRuntime({
    createRuntimeHostPorts(input) {
      return runtimeApi.createRuntimeHostPorts({
        ...input,
        tokens: {
          resolve(request) {
            const result = Reflect.apply(input.tokens.resolve, undefined, [request]);
            Reflect.apply(input.tokens.resolve, undefined, [request]);
            return result;
          },
        },
      });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreCommandEventActionsEvidence({ runtimeApi: mutated }),
    "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects Catalog authorization-before-materialization drift", async () => {
  const mutated = withRuntime({
    executeRuntimeCommandEventAction(handle, action, ...rest) {
      const result = runtimeApi.executeRuntimeCommandEventAction(handle, action, ...rest);
      if (result.status === "unknown-command") Reflect.get(action, "input");
      return result;
    },
  });
  await assert.rejects(() => buildRuntimeCoreCommandEventActionsEvidence({ runtimeApi: mutated }));
});

test("detects outbound allowlist and validation-before-emission drift", async () => {
  const mutated = withRuntime({
    createRuntimeCommandEventHostPorts(input) {
      return runtimeApi.createRuntimeCommandEventHostPorts({
        commands: input.commands,
        events: {
          validate(request) {
            Reflect.apply(input.events.emit, undefined, [request]);
            return { status: "valid" };
          },
          emit(request) {
            Reflect.apply(input.events.validate, undefined, [request]);
            return { status: "succeeded" };
          },
        },
      });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreCommandEventActionsEvidence({ runtimeApi: mutated }),
    "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects synchronous receiver-independent port drift", async () => {
  const mutated = withPorts({
    invokeRuntimeComponentCommandHostPort() {
      return Object.freeze({ status: "succeeded" });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreCommandEventActionsEvidence({ runtimePortApi: mutated }),
    "COMMAND_EVENT_ACTION_PORT_BEHAVIOR_DRIFT",
  );
  const source = await readFile(PORT_SOURCE, "utf8");
  const wholeEnvelope = source.replace(
    "snapshotRuntimeJsonValue(captured.input)",
    "snapshotRuntimeJsonValue(input)",
  );
  assert.notEqual(wholeEnvelope, source);
  await rejectsCode(
    () =>
      buildRuntimeCoreCommandEventActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/command-event-ports.ts": wholeEnvelope,
        },
      }),
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );
});

test("detects target-ticket generation, ambiguity, and ABA drift", async () => {
  const mutated = withRuntime({
    unregisterRuntimeComponentCommandTarget(handle, input) {
      const result = runtimeApi.unregisterRuntimeComponentCommandTarget(handle, input);
      return result.status === "stale-ticket"
        ? Object.freeze({ status: "unregistered", sourceNodeId: "map", snapshot: input.snapshot })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreCommandEventActionsEvidence({ runtimeApi: mutated }),
    "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects command/event TOCTOU and reentry drift", async () => {
  const mutated = withRuntime({
    executeRuntimeCommandEventAction(handle, action, ...rest) {
      const first = runtimeApi.executeRuntimeCommandEventAction(handle, action, ...rest);
      if (first.status === "command-succeeded" || first.status === "event-emitted") {
        runtimeApi.executeRuntimeCommandEventAction(handle, action, ...rest);
      }
      return first;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreCommandEventActionsEvidence({ runtimeApi: mutated }),
    "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects diagnostics and adapter-redaction drift", async () => {
  const mutated = withRuntime({
    executeRuntimeCommandEventAction(handle, action, ...rest) {
      const result = runtimeApi.executeRuntimeCommandEventAction(handle, action, ...rest);
      return result.status === "adapter-failed"
        ? Object.freeze({
            ...result,
            rawHostFailure: "private-command-adapter-stack",
          })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreCommandEventActionsEvidence({ runtimeApi: mutated }),
    "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects finite registration and request bounds drift", async () => {
  const mutated = withRuntime({
    registerRuntimeComponentCommandTarget(handle, input) {
      const result = runtimeApi.registerRuntimeComponentCommandTarget(handle, input);
      return result.status === "snapshot-limit"
        ? Object.freeze({
            status: "registered",
            sourceNodeId: input.sourceNodeId,
            runtimeInstanceId: input.runtimeInstanceId,
            registrationGeneration: 0,
            ticket: Object.freeze({}),
            snapshot: input.snapshot,
          })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreCommandEventActionsEvidence({ runtimeApi: mutated }),
    "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects terminal disposal and late-callback drift", async () => {
  const mutated = withRuntime({
    disposeRuntimeCommandEventActions() {
      return Object.freeze({ status: "already-disposed", disposedTargets: 0 });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreCommandEventActionsEvidence({ runtimeApi: mutated }),
    "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects task-owned byte drift", async () => {
  const source = await readFile(PORT_SOURCE, "utf8");
  await rejectsCode(
    () =>
      verifyRuntimeCoreCommandEventActionsEvidence({
        buildOptions: {
          fileOverrides: {
            "packages/runtime-core/src/command-event-ports.ts": `${source}\n// byte drift\n`,
          },
        },
      }),
    "COMMAND_EVENT_ACTION_ARTIFACT_DRIFT",
  );
});

test("detects public export, TSDoc, internal non-leak, and platform drift", async () => {
  const source = await readFile(ACTION_SOURCE, "utf8");
  const index = await readFile(SOURCE_INDEX, "utf8");
  await rejectsCode(
    () =>
      buildRuntimeCoreCommandEventActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/command-event-actions.ts": `${source}\nwindow;\n`,
        },
      }),
    "COMMAND_EVENT_ACTION_PLATFORM_BOUNDARY_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreCommandEventActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": index.replace(
            "createRuntimeCommandEventHostPorts",
            "createRuntimeCommandEventHostPortsAlias",
          ),
        },
      }),
    "COMMAND_EVENT_ACTION_INDEX_EXPORT_DRIFT",
  );
});

test("detects focused-test and compiler-negative inventory drift", async () => {
  const packageTests = await readFile(PACKAGE_TESTS, "utf8");
  const typeTests = await readFile(TYPE_TESTS, "utf8");
  await rejectsCode(
    () =>
      buildRuntimeCoreCommandEventActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/test/command-event-actions.test.ts": packageTests.replace(
            "it(",
            "it.skip(",
          ),
        },
      }),
    "COMMAND_EVENT_ACTION_TEST_INVENTORY_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreCommandEventActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/test/command-event-actions.types.ts": typeTests.replace(
            "@ts-expect-error",
            "@ts-ignore",
          ),
        },
      }),
    "COMMAND_EVENT_ACTION_TYPE_TEST_DRIFT",
  );
});
