import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RuntimeCoreOperationResourceActionsEvidenceError,
  buildRuntimeCoreOperationResourceActionsEvidence,
  verifyRuntimeCoreOperationResourceActionsEvidence,
} from "../scripts/lib/runtime-core-operation-resource-actions-proof.mjs";

import * as runtimeInternalApi from "../packages/runtime-core/dist/operation-resource-actions.js";
import * as runtimeApi from "../packages/runtime-core/dist/index.js";

const RESOURCE_LIFECYCLE_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-resource-lifecycle.json",
  import.meta.url,
);
const OPERATION_LIFECYCLE_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-operation-lifecycle.json",
  import.meta.url,
);
const STATE_NAVIGATION_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-state-navigation-actions.json",
  import.meta.url,
);
const EXECUTION_CONTRACT_ARTIFACT = new URL(
  "../docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
  import.meta.url,
);
const ACTION_SOURCE = new URL(
  "../packages/runtime-core/src/operation-resource-actions.ts",
  import.meta.url,
);
const SOURCE_INDEX = new URL("../packages/runtime-core/src/index.ts", import.meta.url);
const PACKAGE_TESTS = new URL(
  "../packages/runtime-core/test/operation-resource-actions.test.ts",
  import.meta.url,
);
const TYPE_TESTS = new URL(
  "../packages/runtime-core/test/operation-resource-actions.types.ts",
  import.meta.url,
);

async function rejectsCode(action, expectedCode) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof RuntimeCoreOperationResourceActionsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

function withRuntime(overrides) {
  return Object.freeze({ ...runtimeApi, ...overrides });
}

function withInternal(overrides) {
  return Object.freeze({ ...runtimeInternalApi, ...overrides });
}

test("accepts tracked deterministic M04-T11 operation/resource evidence", async () => {
  const result = await verifyRuntimeCoreOperationResourceActionsEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.traceRules, 2);
  assert.equal(result.trackedFiles, 11);
  assert.equal(result.rootMutationTests, 19);
  assert.equal(result.hostilePayloadReads, 0);
  assert.equal(result.falseGuardEffects, 0);
  assert.equal(result.falseGuardDiagnosticCalls, 0);
  assert.equal(result.rawHostFailuresExposed, false);
  assert.equal(result.platformEffects, 0);
});

test("builds byte-identical operation/resource evidence twice", async () => {
  const first = await buildRuntimeCoreOperationResourceActionsEvidence();
  const second = await buildRuntimeCoreOperationResourceActionsEvidence();
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or tampered operation/resource evidence", async () => {
  const evidence = await buildRuntimeCoreOperationResourceActionsEvidence();
  const tampered = Buffer.from(evidence.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await rejectsCode(
    () => verifyRuntimeCoreOperationResourceActionsEvidence({ artifactBytes: tampered }),
    "OPERATION_RESOURCE_ACTION_ARTIFACT_DRIFT",
  );
});

test("rejects stale M04-T08 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(RESOURCE_LIFECYCLE_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationResourceActionsEvidence({
        prerequisiteBytes: { resourceLifecycle: bytes },
      }),
    "OPERATION_RESOURCE_ACTION_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M04-T09 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(OPERATION_LIFECYCLE_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationResourceActionsEvidence({
        prerequisiteBytes: { operationLifecycle: bytes },
      }),
    "OPERATION_RESOURCE_ACTION_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M04-T10 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(STATE_NAVIGATION_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationResourceActionsEvidence({
        prerequisiteBytes: { stateNavigation: bytes },
      }),
    "OPERATION_RESOURCE_ACTION_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M02-T11 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(EXECUTION_CONTRACT_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationResourceActionsEvidence({
        prerequisiteBytes: { executionContracts: bytes },
      }),
    "OPERATION_RESOURCE_ACTION_PREREQUISITE_DRIFT",
  );
});

test("detects guard-first hostile payload observation drift", async () => {
  const mutated = withRuntime({
    executeRuntimeOperationResourceAction(handle, action, ...rest) {
      Reflect.get(action, "type");
      return runtimeApi.executeRuntimeOperationResourceAction(handle, action, ...rest);
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationResourceActionsEvidence({ runtimeApi: mutated }),
    "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects false-guard effect and diagnostic drift", async () => {
  const mutated = withRuntime({
    executeRuntimeOperationResourceAction(handle, action, ...rest) {
      const result = runtimeApi.executeRuntimeOperationResourceAction(handle, action, ...rest);
      return result.status === "skipped"
        ? Object.freeze({ status: "invalid-action", diagnostics: Object.freeze([]) })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationResourceActionsEvidence({ runtimeApi: mutated }),
    "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects operation token-session and input drift", async () => {
  const mutated = withRuntime({
    createRuntimeHostPorts(input) {
      return runtimeApi.createRuntimeHostPorts({
        ...input,
        tokens: {
          resolve(request) {
            const first = Reflect.apply(input.tokens.resolve, undefined, [request]);
            Reflect.apply(input.tokens.resolve, undefined, [request]);
            return first;
          },
        },
      });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationResourceActionsEvidence({ runtimeApi: mutated }),
    "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects detached settlement-handler and mapping drift", async () => {
  const mutated = withRuntime({
    executeRuntimeOperationResourceAction(handle, action, ...rest) {
      const result = runtimeApi.executeRuntimeOperationResourceAction(handle, action, ...rest);
      if (!["operation-started", "operation-queued", "operation-staged"].includes(result.status)) {
        return result;
      }
      return Object.freeze({
        ...result,
        settlement: result.settlement.then((settlement) =>
          Object.freeze({ ...settlement, actions: Object.freeze([]) }),
        ),
      });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationResourceActionsEvidence({ runtimeApi: mutated }),
    "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects raw host and private lease leakage", async () => {
  const mutated = withRuntime({
    executeRuntimeOperationResourceAction(handle, action, ...rest) {
      const result = runtimeApi.executeRuntimeOperationResourceAction(handle, action, ...rest);
      return result.status === "operation-capability-mismatch"
        ? Object.freeze({ ...result, rawHostFailure: new Error("private-secret") })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationResourceActionsEvidence({ runtimeApi: mutated }),
    "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects acknowledgement gate and ticket-finalization drift", async () => {
  const mutatedInternal = withInternal({
    finalizeRuntimeOperationActionSettlement(handle, ticket) {
      const result = runtimeInternalApi.finalizeRuntimeOperationActionSettlement(handle, ticket);
      return result.status === "finalized"
        ? Object.freeze({ status: "already-finalized" })
        : result;
    },
  });
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationResourceActionsEvidence({
        runtimeInternalApi: mutatedInternal,
      }),
    "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects resource refresh snapshot and nonblocking drift", async () => {
  const mutated = withRuntime({
    executeRuntimeOperationResourceAction(handle, action, ...rest) {
      const result = runtimeApi.executeRuntimeOperationResourceAction(handle, action, ...rest);
      return result.status === "resource-started"
        ? Object.freeze({ ...result, status: "unknown-resource" })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationResourceActionsEvidence({ runtimeApi: mutated }),
    "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects exclusive ownership and disposal drift", async () => {
  const mutated = withRuntime({
    disposeRuntimeOperationResourceActions(handle) {
      const result = runtimeApi.disposeRuntimeOperationResourceActions(handle);
      return result.status === "disposed"
        ? Object.freeze({
            status: "already-disposed",
            disposedResources: 0,
            disposedInvocations: 0,
            invalidatedLeases: 0,
          })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationResourceActionsEvidence({ runtimeApi: mutated }),
    "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects task-owned byte drift", async () => {
  const sourceText = await readFile(ACTION_SOURCE, "utf8");
  await rejectsCode(
    () =>
      verifyRuntimeCoreOperationResourceActionsEvidence({
        buildOptions: {
          fileOverrides: {
            "packages/runtime-core/src/operation-resource-actions.ts": `${sourceText}\n`,
          },
        },
      }),
    "OPERATION_RESOURCE_ACTION_ARTIFACT_DRIFT",
  );
});

test("detects semantic source ordering drift", async () => {
  const sourceText = await readFile(ACTION_SOURCE, "utf8");
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationResourceActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/operation-resource-actions.ts": sourceText.replace(
            "  authority.transitioning = true;\n",
            "  void authority.transitioning;\n",
          ),
        },
      }),
    "OPERATION_RESOURCE_ACTION_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects public export, TSDoc, internal non-leak, and platform drift", async () => {
  const [indexText, sourceText] = await Promise.all([
    readFile(SOURCE_INDEX, "utf8"),
    readFile(ACTION_SOURCE, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationResourceActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": indexText.replace(
            "  mountRuntimeOperationResourceActions,\n",
            "",
          ),
        },
      }),
    "OPERATION_RESOURCE_ACTION_INDEX_EXPORT_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationResourceActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/operation-resource-actions.ts": sourceText.replace(
            "/** Finite ceilings",
            "/* Finite ceilings",
          ),
        },
      }),
    "OPERATION_RESOURCE_ACTION_TSDOC_MISSING",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationResourceActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/operation-resource-actions.ts": `${sourceText}\nvoid window;\n`,
        },
      }),
    "OPERATION_RESOURCE_ACTION_PLATFORM_BOUNDARY_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationResourceActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": `${indexText}\nexport { finalizeRuntimeOperationActionSettlement } from "./operation-resource-actions.js";\n`,
        },
      }),
    "OPERATION_RESOURCE_ACTION_INDEX_EXPORT_DRIFT",
  );
});

test("detects focused-test and compiler-negative inventory drift", async () => {
  const [packageTests, typeTests] = await Promise.all([
    readFile(PACKAGE_TESTS, "utf8"),
    readFile(TYPE_TESTS, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationResourceActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/test/operation-resource-actions.test.ts": packageTests.replace(
            /\bit\(/u,
            "test(",
          ),
        },
      }),
    "OPERATION_RESOURCE_ACTION_TEST_INVENTORY_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationResourceActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/test/operation-resource-actions.types.ts": typeTests.replace(
            /\/\/ @ts-expect-error [^\r\n]+\r?\n/u,
            "",
          ),
        },
      }),
    "OPERATION_RESOURCE_ACTION_TYPE_TEST_DRIFT",
  );
});
