import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RuntimeCoreOperationLifecycleEvidenceError,
  buildRuntimeCoreOperationLifecycleEvidence,
  verifyRuntimeCoreOperationLifecycleEvidence,
} from "../scripts/lib/runtime-core-operation-lifecycle-proof.mjs";

import * as runtimeApi from "../packages/runtime-core/dist/index.js";

const VALUE_RESOLUTION_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-value-resolution.json",
  import.meta.url,
);
const EXECUTION_CONTRACT_ARTIFACT = new URL(
  "../docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
  import.meta.url,
);
const OPERATION_SOURCE = new URL(
  "../packages/runtime-core/src/operation-lifecycle.ts",
  import.meta.url,
);
const SOURCE_INDEX = new URL("../packages/runtime-core/src/index.ts", import.meta.url);
const PACKAGE_TESTS = new URL(
  "../packages/runtime-core/test/operation-lifecycle.test.ts",
  import.meta.url,
);
const TYPE_TESTS = new URL(
  "../packages/runtime-core/test/operation-lifecycle.types.ts",
  import.meta.url,
);

async function rejectsCode(action, expectedCode) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof RuntimeCoreOperationLifecycleEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

function withRuntime(overrides) {
  return Object.freeze({ ...runtimeApi, ...overrides });
}

function mapInvocationSettlement(result, mutate) {
  if (result.status !== "started" && result.status !== "queued") return result;
  return Object.freeze({
    ...result,
    settlement: result.settlement.then(mutate),
  });
}

test("accepts tracked deterministic M04-T09 operation evidence", async () => {
  const result = await verifyRuntimeCoreOperationLifecycleEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.focusedTests, 36);
  assert.equal(result.compilerNegativeCases, 10);
  assert.equal(result.rootMutationTests, 19);
  assert.equal(result.traceRules, 14);
  assert.equal(result.trackedFiles, 11);
  assert.equal(result.hostileEnvelopeReads, 0);
  assert.equal(result.platformEffects, 0);
});

test("builds byte-identical operation evidence twice", async () => {
  const first = await buildRuntimeCoreOperationLifecycleEvidence();
  const second = await buildRuntimeCoreOperationLifecycleEvidence();
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or tampered operation evidence", async () => {
  const evidence = await buildRuntimeCoreOperationLifecycleEvidence();
  const tampered = Buffer.from(evidence.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await rejectsCode(
    () => verifyRuntimeCoreOperationLifecycleEvidence({ artifactBytes: tampered }),
    "OPERATION_ARTIFACT_DRIFT",
  );
});

test("rejects stale M04-T02 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(VALUE_RESOLUTION_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationLifecycleEvidence({
        prerequisiteBytes: { valueResolution: bytes },
      }),
    "OPERATION_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M02-T11 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(EXECUTION_CONTRACT_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationLifecycleEvidence({
        prerequisiteBytes: { executionContracts: bytes },
      }),
    "OPERATION_PREREQUISITE_DRIFT",
  );
});

test("detects atomic alias mount drift", async () => {
  const mutated = withRuntime({
    mountRuntimeSurfaceOperations(input) {
      const result = runtimeApi.mountRuntimeSurfaceOperations(input);
      if (result.status !== "mounted") return result;
      return Object.freeze({
        ...result,
        snapshot: Object.freeze({ ...result.snapshot, generation: 1 }),
      });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationLifecycleEvidence({ runtimeApi: mutated }),
    "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects default-reject and accepted-only identity drift", async () => {
  const mutated = withRuntime({
    invokeRuntimeOperation(handle, input) {
      const result = runtimeApi.invokeRuntimeOperation(handle, input);
      return result.status === "rejected" ? Object.freeze({ status: "busy" }) : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationLifecycleEvidence({ runtimeApi: mutated }),
    "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects exact snapshot and alias authority drift", async () => {
  const mutated = withRuntime({
    invokeRuntimeOperation(handle, input) {
      const result = runtimeApi.invokeRuntimeOperation(handle, input);
      return result.status === "invalid-snapshot" || result.status === "capability-mismatch"
        ? Object.freeze({ status: "rejected", reason: "pending", alias: "signIn" })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationLifecycleEvidence({ runtimeApi: mutated }),
    "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects Catalog input, effect, and request-boundary drift", async () => {
  const mutated = withRuntime({
    createRuntimeHostPorts(input) {
      return runtimeApi.createRuntimeHostPorts({
        ...input,
        operations: {
          invoke(request) {
            return Reflect.apply(input.operations.invoke, undefined, [
              Object.freeze({ ...request, effect: "local" }),
            ]);
          },
        },
      });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationLifecycleEvidence({ runtimeApi: mutated }),
    "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects output and public-error containment drift", async () => {
  const mutated = withRuntime({
    invokeRuntimeOperation(handle, input) {
      return mapInvocationSettlement(
        runtimeApi.invokeRuntimeOperation(handle, input),
        (settlement) =>
          settlement.status === "failed"
            ? Object.freeze({ ...settlement, errorCode: "mutated-public-error" })
            : settlement,
      );
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationLifecycleEvidence({ runtimeApi: mutated }),
    "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects denial and adapter-failure containment drift", async () => {
  const mutated = withRuntime({
    invokeRuntimeOperation(handle, input) {
      return mapInvocationSettlement(
        runtimeApi.invokeRuntimeOperation(handle, input),
        (settlement) =>
          settlement.status === "denied" || settlement.status === "adapter-failed"
            ? Object.freeze({ ...settlement, status: "succeeded" })
            : settlement,
      );
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationLifecycleEvidence({ runtimeApi: mutated }),
    "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects replace supersession and stale-envelope drift", async () => {
  const mutated = withRuntime({
    invokeRuntimeOperation(handle, input) {
      return mapInvocationSettlement(
        runtimeApi.invokeRuntimeOperation(handle, input),
        (settlement) =>
          settlement.status === "superseded"
            ? Object.freeze({ ...settlement, status: "disposed" })
            : settlement,
      );
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationLifecycleEvidence({ runtimeApi: mutated }),
    "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects queue ordering and acknowledgement-seam drift", async () => {
  const mutated = withRuntime({
    acknowledgeRuntimeOperationSettlement(handle, lease) {
      const result = runtimeApi.acknowledgeRuntimeOperationSettlement(handle, lease);
      if (result.status !== "acknowledged" || result.promotedRequestId === undefined) {
        return result;
      }
      const withoutPromotion = Object.fromEntries(
        Object.entries(result).filter(([key]) => key !== "promotedRequestId"),
      );
      return Object.freeze(withoutPromotion);
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationLifecycleEvidence({ runtimeApi: mutated }),
    "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects finite queue, snapshot, and transport-limit drift", async () => {
  const mutated = withRuntime({
    mountRuntimeSurfaceOperations(input) {
      if (input.limits?.maxActiveTransports === 1) {
        const withoutLimits = Object.fromEntries(
          Object.entries(input).filter(([key]) => key !== "limits"),
        );
        return runtimeApi.mountRuntimeSurfaceOperations(withoutLimits);
      }
      return runtimeApi.mountRuntimeSurfaceOperations(input);
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationLifecycleEvidence({ runtimeApi: mutated }),
    "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects receiver and reentry drift", async () => {
  const receiver = Object.freeze({ mutated: true });
  const mutated = withRuntime({
    createRuntimeHostPorts(input) {
      return runtimeApi.createRuntimeHostPorts({
        ...input,
        operations: {
          invoke(request) {
            return Reflect.apply(input.operations.invoke, receiver, [request]);
          },
        },
        diagnostics: {
          report(diagnostic) {
            return Reflect.apply(input.diagnostics.report, receiver, [diagnostic]);
          },
        },
      });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationLifecycleEvidence({ runtimeApi: mutated }),
    "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects disposal and late-settlement drift", async () => {
  const mutated = withRuntime({
    disposeRuntimeSurfaceOperations(handle) {
      const result = runtimeApi.disposeRuntimeSurfaceOperations(handle);
      return result.status === "disposed"
        ? Object.freeze({ ...result, disposedInvocations: 0, invalidatedLeases: 0 })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreOperationLifecycleEvidence({ runtimeApi: mutated }),
    "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects settlement-lease source ordering drift", async () => {
  const sourceText = await readFile(OPERATION_SOURCE, "utf8");
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationLifecycleEvidence({
        fileOverrides: {
          "packages/runtime-core/src/operation-lifecycle.ts": sourceText.replace(
            "    const promoted = record.queue.shift();\n",
            "    const promoted = record.queue.splice(0, 1)[0];\n",
          ),
        },
      }),
    "OPERATION_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects public export, TSDoc, and platform drift", async () => {
  const [indexText, sourceText] = await Promise.all([
    readFile(SOURCE_INDEX, "utf8"),
    readFile(OPERATION_SOURCE, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationLifecycleEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": indexText.replace(
            "  mountRuntimeSurfaceOperations,\n",
            "",
          ),
        },
      }),
    "OPERATION_INDEX_EXPORT_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationLifecycleEvidence({
        fileOverrides: {
          "packages/runtime-core/src/operation-lifecycle.ts": sourceText.replace(
            "/** Finite default ceilings",
            "/* Finite default ceilings",
          ),
        },
      }),
    "OPERATION_TSDOC_MISSING",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationLifecycleEvidence({
        fileOverrides: {
          "packages/runtime-core/src/operation-lifecycle.ts": `${sourceText}\nvoid window;\n`,
        },
      }),
    "OPERATION_PLATFORM_BOUNDARY_DRIFT",
  );
});

test("detects focused-test and compiler-negative inventory drift", async () => {
  const [packageTests, typeTests] = await Promise.all([
    readFile(PACKAGE_TESTS, "utf8"),
    readFile(TYPE_TESTS, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationLifecycleEvidence({
        fileOverrides: {
          "packages/runtime-core/test/operation-lifecycle.test.ts": packageTests.replace(
            'it("mounts the whole alias inventory atomically',
            'test("mounts the whole alias inventory atomically',
          ),
        },
      }),
    "OPERATION_TEST_INVENTORY_DRIFT",
  );
  const negativeMarker = typeTests.match(/\/\/ @ts-expect-error [^\r\n]+/u)?.[0];
  assert.notEqual(negativeMarker, undefined);
  await rejectsCode(
    () =>
      buildRuntimeCoreOperationLifecycleEvidence({
        fileOverrides: {
          "packages/runtime-core/test/operation-lifecycle.types.ts": typeTests.replace(
            `${negativeMarker}\n`,
            "",
          ),
        },
      }),
    "OPERATION_TYPE_TEST_DRIFT",
  );
});
