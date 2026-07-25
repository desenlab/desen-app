import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RuntimeCoreRepeatMaterializationEvidenceError,
  buildRuntimeCoreRepeatMaterializationEvidence,
  verifyRuntimeCoreRepeatMaterializationEvidence,
} from "../scripts/lib/runtime-core-repeat-materialization-proof.mjs";

import * as runtimeApi from "../packages/runtime-core/dist/index.js";

const VALUE_RESOLUTION_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-value-resolution.json",
  import.meta.url,
);
const LOCAL_STATE_IDENTITY_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json",
  import.meta.url,
);
const REPEAT_SOURCE = new URL(
  "../packages/runtime-core/src/repeat-materialization.ts",
  import.meta.url,
);
const SOURCE_INDEX = new URL("../packages/runtime-core/src/index.ts", import.meta.url);
const PACKAGE_TESTS = new URL(
  "../packages/runtime-core/test/repeat-materialization.test.ts",
  import.meta.url,
);
const TYPE_TESTS = new URL(
  "../packages/runtime-core/test/repeat-materialization.types.ts",
  import.meta.url,
);

async function rejectsCode(action, expectedCode) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof RuntimeCoreRepeatMaterializationEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

function withRuntime(overrides) {
  return Object.freeze({ ...runtimeApi, ...overrides });
}

test("accepts tracked deterministic M04-T07 repeat evidence", async () => {
  const result = await verifyRuntimeCoreRepeatMaterializationEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.focusedTests, 34);
  assert.equal(result.compilerNegativeCases, 7);
  assert.equal(result.traceRules, 7);
  assert.equal(result.platformEffects, 0);
});

test("builds byte-identical repeat evidence twice", async () => {
  const first = await buildRuntimeCoreRepeatMaterializationEvidence();
  const second = await buildRuntimeCoreRepeatMaterializationEvidence();
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or tampered repeat evidence", async () => {
  const evidence = await buildRuntimeCoreRepeatMaterializationEvidence();
  const tampered = Buffer.from(evidence.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await rejectsCode(
    () => verifyRuntimeCoreRepeatMaterializationEvidence({ artifactBytes: tampered }),
    "REPEAT_ARTIFACT_DRIFT",
  );
});

test("rejects stale M04-T02 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(VALUE_RESOLUTION_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreRepeatMaterializationEvidence({
        prerequisiteBytes: { valueResolution: bytes },
      }),
    "REPEAT_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M04-T06 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(LOCAL_STATE_IDENTITY_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreRepeatMaterializationEvidence({
        prerequisiteBytes: { localStateIdentity: bytes },
      }),
    "REPEAT_PREREQUISITE_DRIFT",
  );
});

test("detects own-alias timing drift", async () => {
  const mutated = withRuntime({
    materializeRuntimeRepeat(scope, input) {
      if (input.items?.$ref === "item.row.children") {
        return Object.freeze({
          status: "materialized",
          instances: Object.freeze([]),
          effectiveLimit: 1_000,
        });
      }
      return runtimeApi.materializeRuntimeRepeat(scope, input);
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreRepeatMaterializationEvidence({ runtimeApi: mutated }),
    "REPEAT_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects active-alias shadowing drift", async () => {
  const mutated = withRuntime({
    materializeRuntimeRepeat(scope, input) {
      if (scope.aliasOrder.includes(input.as)) {
        return Object.freeze({
          status: "materialized",
          instances: Object.freeze([]),
          effectiveLimit: 1_000,
        });
      }
      return runtimeApi.materializeRuntimeRepeat(scope, input);
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreRepeatMaterializationEvidence({ runtimeApi: mutated }),
    "REPEAT_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects source-order drift", async () => {
  const mutated = withRuntime({
    materializeRuntimeRepeat(scope, input) {
      const result = runtimeApi.materializeRuntimeRepeat(scope, input);
      if (
        result.status === "materialized" &&
        result.instances.map(({ key }) => key).join(",") === "b,a"
      ) {
        return Object.freeze({
          ...result,
          instances: Object.freeze([...result.instances].reverse()),
        });
      }
      return result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreRepeatMaterializationEvidence({ runtimeApi: mutated }),
    "REPEAT_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects key coercion and negative-zero drift", async () => {
  const mutated = withRuntime({
    materializeRuntimeRepeat(scope, input) {
      const result = runtimeApi.materializeRuntimeRepeat(scope, input);
      if (
        result.status === "materialized" &&
        result.instances.map(({ keyIdentity }) => keyIdentity).join("|") === '1|"1"'
      ) {
        const [first, second] = result.instances;
        return Object.freeze({
          ...result,
          instances: Object.freeze([
            first,
            Object.freeze({ ...second, keyIdentity: first.keyIdentity }),
          ]),
        });
      }
      if (
        result.status === "invalid" &&
        result.reason === "duplicate-key" &&
        result.itemIndex === 1
      ) {
        return Object.freeze({
          status: "materialized",
          instances: Object.freeze([]),
          effectiveLimit: 1_000,
        });
      }
      return result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreRepeatMaterializationEvidence({ runtimeApi: mutated }),
    "REPEAT_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects repeat-limit truncation drift", async () => {
  const mutated = withRuntime({
    materializeRuntimeRepeat(scope, input) {
      const result = runtimeApi.materializeRuntimeRepeat(scope, input);
      if (result.status === "limit-exceeded") {
        return Object.freeze({
          status: "materialized",
          instances: Object.freeze([]),
          effectiveLimit: result.limit,
        });
      }
      return result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreRepeatMaterializationEvidence({ runtimeApi: mutated }),
    "REPEAT_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects partial-result drift", async () => {
  const mutated = withRuntime({
    materializeRuntimeRepeat(scope, input) {
      const result = runtimeApi.materializeRuntimeRepeat(scope, input);
      if (result.status === "invalid" && result.reason === "key-unresolved") {
        return Object.freeze({ ...result, instances: Object.freeze([]) });
      }
      return result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreRepeatMaterializationEvidence({ runtimeApi: mutated }),
    "REPEAT_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects array-index identity drift", async () => {
  const mutated = withRuntime({
    reconcileRuntimeRepeatedNodeIdentity(previousIdentity, nextDescriptor, nextScope) {
      if (JSON.stringify(previousIdentity.repeatKeys) === JSON.stringify(nextScope.repeatKeys)) {
        return Object.freeze({
          status: "replace-required",
          reason: "identity-changed",
          previousIdentity,
          nextIdentity: previousIdentity,
        });
      }
      return runtimeApi.reconcileRuntimeRepeatedNodeIdentity(
        previousIdentity,
        nextDescriptor,
        nextScope,
      );
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreRepeatMaterializationEvidence({ runtimeApi: mutated }),
    "REPEAT_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects ancestor-key identity drift", async () => {
  const mutated = withRuntime({
    reconcileRuntimeRepeatedNodeIdentity(previousIdentity, nextDescriptor, nextScope) {
      if (JSON.stringify(previousIdentity.repeatKeys) !== JSON.stringify(nextScope.repeatKeys)) {
        return Object.freeze({ status: "preserve-eligible", identity: previousIdentity });
      }
      return runtimeApi.reconcileRuntimeRepeatedNodeIdentity(
        previousIdentity,
        nextDescriptor,
        nextScope,
      );
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreRepeatMaterializationEvidence({ runtimeApi: mutated }),
    "REPEAT_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects public export, TSDoc, and platform drift", async () => {
  const [indexText, sourceText] = await Promise.all([
    readFile(SOURCE_INDEX, "utf8"),
    readFile(REPEAT_SOURCE, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreRepeatMaterializationEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": indexText.replace(
            "  createRuntimeRepeatRootScope,\n",
            "",
          ),
        },
      }),
    "REPEAT_INDEX_EXPORT_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreRepeatMaterializationEvidence({
        fileOverrides: {
          "packages/runtime-core/src/repeat-materialization.ts": sourceText.replace(
            "/** Finite Reference Profile",
            "/* Finite Reference Profile",
          ),
        },
      }),
    "REPEAT_TSDOC_MISSING",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreRepeatMaterializationEvidence({
        fileOverrides: {
          "packages/runtime-core/src/repeat-materialization.ts": `${sourceText}\nvoid window;\n`,
        },
      }),
    "REPEAT_PLATFORM_BOUNDARY_DRIFT",
  );
});

test("detects focused-test and compiler-negative inventory drift", async () => {
  const [packageTests, typeTests] = await Promise.all([
    readFile(PACKAGE_TESTS, "utf8"),
    readFile(TYPE_TESTS, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreRepeatMaterializationEvidence({
        fileOverrides: {
          "packages/runtime-core/test/repeat-materialization.test.ts": packageTests.replace(
            'it("creates a branded root',
            'test("creates a branded root',
          ),
        },
      }),
    "REPEAT_TEST_INVENTORY_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreRepeatMaterializationEvidence({
        fileOverrides: {
          "packages/runtime-core/test/repeat-materialization.types.ts": typeTests.replace(
            "// @ts-expect-error repeat key paths are immutable\n",
            "",
          ),
        },
      }),
    "REPEAT_TYPE_TEST_DRIFT",
  );
});
