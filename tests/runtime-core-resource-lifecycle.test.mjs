import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RuntimeCoreResourceLifecycleEvidenceError,
  buildRuntimeCoreResourceLifecycleEvidence,
  verifyRuntimeCoreResourceLifecycleEvidence,
} from "../scripts/lib/runtime-core-resource-lifecycle-proof.mjs";

import * as runtimeApi from "../packages/runtime-core/dist/index.js";

const TOKEN_FORMAT_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-token-format-resolution.json",
  import.meta.url,
);
const REPEAT_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-repeat-materialization.json",
  import.meta.url,
);
const EXECUTION_CONTRACT_ARTIFACT = new URL(
  "../docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
  import.meta.url,
);
const RESOURCE_SOURCE = new URL(
  "../packages/runtime-core/src/resource-lifecycle.ts",
  import.meta.url,
);
const SOURCE_INDEX = new URL("../packages/runtime-core/src/index.ts", import.meta.url);
const PACKAGE_TESTS = new URL(
  "../packages/runtime-core/test/resource-lifecycle.test.ts",
  import.meta.url,
);
const TYPE_TESTS = new URL(
  "../packages/runtime-core/test/resource-lifecycle.types.ts",
  import.meta.url,
);

async function rejectsCode(action, expectedCode) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof RuntimeCoreResourceLifecycleEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

function withRuntime(overrides) {
  return Object.freeze({ ...runtimeApi, ...overrides });
}

function mutateStartedSettlements(result, mutate) {
  if (result.status !== "started") return result;
  return Object.freeze({
    ...result,
    entries: Object.freeze(
      result.entries.map((entry) =>
        entry.status === "started"
          ? Object.freeze({ ...entry, settlement: entry.settlement.then(mutate) })
          : entry,
      ),
    ),
  });
}

test("accepts tracked deterministic M04-T08 resource evidence", async () => {
  const result = await verifyRuntimeCoreResourceLifecycleEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.focusedTests, 52);
  assert.equal(result.compilerNegativeCases, 9);
  assert.equal(result.rootMutationTests, 23);
  assert.equal(result.traceRules, 10);
  assert.equal(result.trackedFiles, 11);
  assert.equal(result.hostileEnvelopeReads, 0);
  assert.equal(result.platformEffects, 0);
});

test("builds byte-identical resource evidence twice", async () => {
  const first = await buildRuntimeCoreResourceLifecycleEvidence();
  const second = await buildRuntimeCoreResourceLifecycleEvidence();
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or tampered resource evidence", async () => {
  const evidence = await buildRuntimeCoreResourceLifecycleEvidence();
  const tampered = Buffer.from(evidence.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await rejectsCode(
    () => verifyRuntimeCoreResourceLifecycleEvidence({ artifactBytes: tampered }),
    "RESOURCE_ARTIFACT_DRIFT",
  );
});

test("rejects stale M04-T03 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(TOKEN_FORMAT_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreResourceLifecycleEvidence({
        prerequisiteBytes: { tokenFormat: bytes },
      }),
    "RESOURCE_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M04-T07 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(REPEAT_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreResourceLifecycleEvidence({
        prerequisiteBytes: { repeatMaterialization: bytes },
      }),
    "RESOURCE_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M02-T11 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(EXECUTION_CONTRACT_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreResourceLifecycleEvidence({
        prerequisiteBytes: { executionContracts: bytes },
      }),
    "RESOURCE_PREREQUISITE_DRIFT",
  );
});

test("detects mount atomicity and host-isolation drift", async () => {
  const mutated = withRuntime({
    mountRuntimeSurfaceResources(input) {
      const result = runtimeApi.mountRuntimeSurfaceResources(input);
      if (result.status !== "mounted") return result;
      return Object.freeze({
        ...result,
        snapshot: Object.freeze({ ...result.snapshot, generation: 1 }),
      });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects policy ordering and pending-publication drift", async () => {
  const mutated = withRuntime({
    startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot) {
      const result = runtimeApi.startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot);
      if (
        result.status !== "started" ||
        !result.entries.some(({ instanceId }) => instanceId === "zOnce")
      ) {
        return result;
      }
      return Object.freeze({
        ...result,
        entries: Object.freeze([...result.entries].reverse()),
      });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects input-validation-before-host drift", async () => {
  const mutated = withRuntime({
    startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot) {
      const result = runtimeApi.startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot);
      if (
        result.status !== "started" ||
        !result.entries.some(({ status }) => status === "input-rejected")
      ) {
        return result;
      }
      return Object.freeze({
        ...result,
        entries: Object.freeze(
          result.entries.map((entry) =>
            entry.status === "input-rejected"
              ? Object.freeze({ status: "manual", instanceId: entry.instanceId })
              : entry,
          ),
        ),
      });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects manager snapshot identity and ABA drift", async () => {
  const mutated = withRuntime({
    startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot) {
      const result = runtimeApi.startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot);
      return result.status === "invalid-snapshot"
        ? Object.freeze({ status: "already-started", snapshot: result.snapshot })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects token-format atomicity and candidate-id drift", async () => {
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
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects output validation and public-error drift", async () => {
  const mutated = withRuntime({
    startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot) {
      const result = runtimeApi.startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot);
      return mutateStartedSettlements(result, (settlement) =>
        settlement.status === "failed"
          ? Object.freeze({ ...settlement, errorCode: "mutated-public-error" })
          : settlement,
      );
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects denial and adapter-failure containment drift", async () => {
  const mutated = withRuntime({
    startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot) {
      const result = runtimeApi.startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot);
      return mutateStartedSettlements(result, (settlement) =>
        settlement.status === "denied" || settlement.status === "adapter-failed"
          ? Object.freeze({ ...settlement, status: "succeeded" })
          : settlement,
      );
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects output-diagnostic redaction and freezing drift", async () => {
  const mutated = withRuntime({
    startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot) {
      const result = runtimeApi.startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot);
      return mutateStartedSettlements(result, (settlement) =>
        settlement.status === "invalid-output"
          ? {
              ...settlement,
              diagnostics: [
                ...settlement.diagnostics,
                { code: "RESOURCE_OUTPUT_INVALID", message: "private-server-field" },
              ],
            }
          : settlement,
      );
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects refresh supersession and stale-envelope drift", async () => {
  const mutated = withRuntime({
    refreshRuntimeSurfaceResource(handle, input) {
      const result = runtimeApi.refreshRuntimeSurfaceResource(handle, input);
      return result.status === "started"
        ? Object.freeze({ status: "invalid-snapshot", snapshot: result.snapshot })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects deterministic request-identity drift", async () => {
  const mutated = withRuntime({
    startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot) {
      const result = runtimeApi.startRuntimeSurfaceResources(handle, snapshot, resourceSnapshot);
      if (result.status !== "started") return result;
      return Object.freeze({
        ...result,
        entries: Object.freeze(
          result.entries.map((entry) =>
            entry.status === "started"
              ? Object.freeze({ ...entry, requestId: "resource:caller-controlled" })
              : entry,
          ),
        ),
      });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects finite limits and terminal-reservation drift", async () => {
  const mutated = withRuntime({
    mountRuntimeSurfaceResources(input) {
      if (
        input.limits?.maxSnapshotGeneration !== undefined ||
        input.limits?.maxAttemptGeneration !== undefined
      ) {
        const { limits: _limits, ...withoutLimits } = input;
        return runtimeApi.mountRuntimeSurfaceResources(withoutLimits);
      }
      return runtimeApi.mountRuntimeSurfaceResources(input);
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects active-transport queue and queued-replacement drift", async () => {
  const mutated = withRuntime({
    mountRuntimeSurfaceResources(input) {
      if (input.limits?.maxActiveTransports === 1) {
        const { limits: _limits, ...withoutLimits } = input;
        return runtimeApi.mountRuntimeSurfaceResources(withoutLimits);
      }
      return runtimeApi.mountRuntimeSurfaceResources(input);
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects receiver-dependent callback drift", async () => {
  const receiver = Object.freeze({ mutated: true });
  const mutated = withRuntime({
    createRuntimeHostPorts(input) {
      return runtimeApi.createRuntimeHostPorts({
        ...input,
        resources: {
          load(request) {
            return Reflect.apply(input.resources.load, receiver, [request]);
          },
        },
        tokens: {
          resolve(request) {
            return Reflect.apply(input.tokens.resolve, receiver, [request]);
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
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects disposal and late-settlement drift", async () => {
  const mutated = withRuntime({
    disposeRuntimeSurfaceResources(handle) {
      const result = runtimeApi.disposeRuntimeSurfaceResources(handle);
      return result.status === "disposed"
        ? Object.freeze({ ...result, disposedAttempts: 0 })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreResourceLifecycleEvidence({ runtimeApi: mutated }),
    "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects disposal-sentinel source drift", async () => {
  const sourceText = await readFile(RESOURCE_SOURCE, "utf8");
  await rejectsCode(
    () =>
      buildRuntimeCoreResourceLifecycleEvidence({
        fileOverrides: {
          "packages/runtime-core/src/resource-lifecycle.ts": sourceText.replace(
            "  authority.records.clear();\n",
            "  void authority.records;\n",
          ),
        },
      }),
    "RESOURCE_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects public export, TSDoc, and platform drift", async () => {
  const [indexText, sourceText] = await Promise.all([
    readFile(SOURCE_INDEX, "utf8"),
    readFile(RESOURCE_SOURCE, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreResourceLifecycleEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": indexText.replace(
            "  mountRuntimeSurfaceResources,\n",
            "",
          ),
        },
      }),
    "RESOURCE_INDEX_EXPORT_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreResourceLifecycleEvidence({
        fileOverrides: {
          "packages/runtime-core/src/resource-lifecycle.ts": sourceText.replace(
            "/** Deterministic counters",
            "/* Deterministic counters",
          ),
        },
      }),
    "RESOURCE_TSDOC_MISSING",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreResourceLifecycleEvidence({
        fileOverrides: {
          "packages/runtime-core/src/resource-lifecycle.ts": `${sourceText}\nvoid window;\n`,
        },
      }),
    "RESOURCE_PLATFORM_BOUNDARY_DRIFT",
  );
});

test("detects focused-test and compiler-negative inventory drift", async () => {
  const [packageTests, typeTests] = await Promise.all([
    readFile(PACKAGE_TESTS, "utf8"),
    readFile(TYPE_TESTS, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreResourceLifecycleEvidence({
        fileOverrides: {
          "packages/runtime-core/test/resource-lifecycle.test.ts": packageTests.replace(
            'it("mounts every declaration atomically',
            'test("mounts every declaration atomically',
          ),
        },
      }),
    "RESOURCE_TEST_INVENTORY_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreResourceLifecycleEvidence({
        fileOverrides: {
          "packages/runtime-core/test/resource-lifecycle.types.ts": typeTests.replace(
            "// @ts-expect-error resource lifecycle maps are recursively readonly\n",
            "",
          ),
        },
      }),
    "RESOURCE_TYPE_TEST_DRIFT",
  );
});
