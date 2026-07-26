import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RuntimeCoreStateNavigationActionsEvidenceError,
  buildRuntimeCoreStateNavigationActionsEvidence,
  verifyRuntimeCoreStateNavigationActionsEvidence,
} from "../scripts/lib/runtime-core-state-navigation-actions-proof.mjs";

import * as runtimeApi from "../packages/runtime-core/dist/index.js";
import * as stateNavigationApi from "../packages/runtime-core/dist/state-navigation-actions.js";

const TOKEN_FORMAT_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-token-format-resolution.json",
  import.meta.url,
);
const PREDICATE_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-predicate-evaluation.json",
  import.meta.url,
);
const LOCAL_STATE_ARTIFACT = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json",
  import.meta.url,
);
const EXECUTION_CONTRACT_ARTIFACT = new URL(
  "../docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
  import.meta.url,
);
const ACTION_SOURCE = new URL(
  "../packages/runtime-core/src/state-navigation-actions.ts",
  import.meta.url,
);
const ACTION_EVALUATION_SOURCE = new URL(
  "../packages/runtime-core/src/action-evaluation.ts",
  import.meta.url,
);
const SOURCE_INDEX = new URL("../packages/runtime-core/src/index.ts", import.meta.url);
const PACKAGE_TESTS = new URL(
  "../packages/runtime-core/test/state-navigation-actions.test.ts",
  import.meta.url,
);
const TYPE_TESTS = new URL(
  "../packages/runtime-core/test/state-navigation-actions.types.ts",
  import.meta.url,
);

async function rejectsCode(action, expectedCode) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof RuntimeCoreStateNavigationActionsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

function withRuntime(overrides) {
  return Object.freeze({ ...runtimeApi, ...overrides });
}

function withStateNavigationApi(overrides) {
  return Object.freeze({ ...stateNavigationApi, ...overrides });
}

test("accepts tracked deterministic M04-T10 state/navigation evidence", async () => {
  const result = await verifyRuntimeCoreStateNavigationActionsEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.focusedTests, 44);
  assert.equal(result.compilerNegativeCases, 14);
  assert.equal(result.rootMutationTests, 20);
  assert.equal(result.traceRules, 5);
  assert.equal(result.trackedFiles, 16);
  assert.equal(result.runtimeExports, 4);
  assert.equal(result.typeExports, 18);
  assert.equal(result.internalRuntimeExports, 1);
  assert.equal(result.internalTypeExports, 1);
  assert.equal(result.currentReadProbes, 14);
  assert.equal(result.hostilePayloadReads, 0);
  assert.equal(result.falseGuardDiagnosticCalls, 0);
  assert.equal(result.platformEffects, 0);
});

test("builds byte-identical state/navigation evidence twice", async () => {
  const first = await buildRuntimeCoreStateNavigationActionsEvidence();
  const second = await buildRuntimeCoreStateNavigationActionsEvidence();
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or tampered state/navigation evidence", async () => {
  const evidence = await buildRuntimeCoreStateNavigationActionsEvidence();
  const tampered = Buffer.from(evidence.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await rejectsCode(
    () => verifyRuntimeCoreStateNavigationActionsEvidence({ artifactBytes: tampered }),
    "STATE_ACTION_ARTIFACT_DRIFT",
  );
});

test("rejects stale M04-T03 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(TOKEN_FORMAT_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        prerequisiteBytes: { tokenFormat: bytes },
      }),
    "STATE_ACTION_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M04-T04 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(PREDICATE_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        prerequisiteBytes: { predicateEvaluation: bytes },
      }),
    "STATE_ACTION_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M04-T06 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(LOCAL_STATE_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        prerequisiteBytes: { localState: bytes },
      }),
    "STATE_ACTION_PREREQUISITE_DRIFT",
  );
});

test("rejects stale M02-T11 prerequisite bytes", async () => {
  const bytes = Buffer.from(await readFile(EXECUTION_CONTRACT_ARTIFACT));
  bytes[0] ^= 1;
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        prerequisiteBytes: { executionContracts: bytes },
      }),
    "STATE_ACTION_PREREQUISITE_DRIFT",
  );
});

test("detects guard-first hostile non-observation drift", async () => {
  const mutated = withRuntime({
    executeRuntimeStateNavigationAction(handle, action, snapshot, stateSnapshot) {
      const result = runtimeApi.executeRuntimeStateNavigationAction(
        handle,
        action,
        snapshot,
        stateSnapshot,
      );
      return result.status === "skipped"
        ? Object.freeze({
            ...result,
            diagnostics: Object.freeze([{ code: "MUTATED_GUARD_OBSERVATION" }]),
          })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreStateNavigationActionsEvidence({ runtimeApi: mutated }),
    "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects shared token-session and post-token TOCTOU drift", async () => {
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
    () => buildRuntimeCoreStateNavigationActionsEvidence({ runtimeApi: mutated }),
    "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects state-set schema and exact-snapshot drift", async () => {
  const mutated = withRuntime({
    executeRuntimeStateNavigationAction(handle, action, snapshot, stateSnapshot) {
      const result = runtimeApi.executeRuntimeStateNavigationAction(
        handle,
        action,
        snapshot,
        stateSnapshot,
      );
      return result.status === "state-rejected" && result.action === "state.set"
        ? Object.freeze({ ...result, status: "state-unchanged" })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreStateNavigationActionsEvidence({ runtimeApi: mutated }),
    "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects exact-boolean toggle drift", async () => {
  const mutated = withRuntime({
    executeRuntimeStateNavigationAction(handle, action, snapshot, stateSnapshot) {
      const result = runtimeApi.executeRuntimeStateNavigationAction(
        handle,
        action,
        snapshot,
        stateSnapshot,
      );
      return result.status === "state-rejected" && result.action === "state.toggle"
        ? Object.freeze({ ...result, reason: "mutated-toggle-coercion" })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreStateNavigationActionsEvidence({ runtimeApi: mutated }),
    "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects local-target-before-params drift", async () => {
  const mutated = withRuntime({
    executeRuntimeStateNavigationAction(handle, action, snapshot, stateSnapshot) {
      const result = runtimeApi.executeRuntimeStateNavigationAction(
        handle,
        action,
        snapshot,
        stateSnapshot,
      );
      return result.status === "unknown-surface"
        ? Object.freeze({
            ...result,
            diagnostics: Object.freeze([
              Object.freeze({ code: "ENTRY_NOT_FOUND", pointer: "/params" }),
            ]),
          })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreStateNavigationActionsEvidence({ runtimeApi: mutated }),
    "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects navigation request and receiver drift", async () => {
  const receiver = Object.freeze({ mutated: true });
  const mutated = withRuntime({
    createRuntimeHostPorts(input) {
      return runtimeApi.createRuntimeHostPorts({
        ...input,
        navigation: {
          navigate(request) {
            return Reflect.apply(input.navigation.navigate, receiver, [request]);
          },
        },
      });
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreStateNavigationActionsEvidence({ runtimeApi: mutated }),
    "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects denial and adapter-failure containment drift", async () => {
  const mutated = withRuntime({
    executeRuntimeStateNavigationAction(handle, action, snapshot, stateSnapshot) {
      const result = runtimeApi.executeRuntimeStateNavigationAction(
        handle,
        action,
        snapshot,
        stateSnapshot,
      );
      return result.status === "navigation-denied" || result.status === "adapter-failed"
        ? Object.freeze({ ...result, status: "navigated" })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreStateNavigationActionsEvidence({ runtimeApi: mutated }),
    "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects terminal navigation and state-disposal drift", async () => {
  const mutated = withRuntime({
    executeRuntimeStateNavigationAction(handle, action, snapshot, stateSnapshot) {
      const result = runtimeApi.executeRuntimeStateNavigationAction(
        handle,
        action,
        snapshot,
        stateSnapshot,
      );
      return result.status === "navigated"
        ? Object.freeze({ ...result, surface: "mutated-surface" })
        : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreStateNavigationActionsEvidence({ runtimeApi: mutated }),
    "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects explicit disposal and late-effect drift", async () => {
  const mutated = withRuntime({
    disposeRuntimeStateNavigationActions(handle) {
      const result = runtimeApi.disposeRuntimeStateNavigationActions(handle);
      return result.status === "disposed" ? Object.freeze({ status: "already-disposed" }) : result;
    },
  });
  await rejectsCode(
    () => buildRuntimeCoreStateNavigationActionsEvidence({ runtimeApi: mutated }),
    "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
});

test("detects semantic source ordering drift", async () => {
  const [sourceText, evaluationText] = await Promise.all([
    readFile(ACTION_SOURCE, "utf8"),
    readFile(ACTION_EVALUATION_SOURCE, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/state-navigation-actions.ts": sourceText.replace(
            "  authority.transitioning = true;\n",
            "  void authority.transitioning;\n",
          ),
        },
      }),
    "STATE_ACTION_SOURCE_SEMANTIC_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/action-evaluation.ts": evaluationText.replace(
            "retained.sort(",
            "retained.reverse(",
          ),
        },
      }),
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );
});

test("detects public export, TSDoc, and platform drift", async () => {
  const [indexText, sourceText, evaluationText] = await Promise.all([
    readFile(SOURCE_INDEX, "utf8"),
    readFile(ACTION_SOURCE, "utf8"),
    readFile(ACTION_EVALUATION_SOURCE, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": indexText.replace(
            "  mountRuntimeStateNavigationActions,\n",
            "",
          ),
        },
      }),
    "STATE_ACTION_INDEX_EXPORT_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/state-navigation-actions.ts": sourceText.replace(
            "/** Finite deterministic identity ceiling",
            "/* Finite deterministic identity ceiling",
          ),
        },
      }),
    "STATE_ACTION_TSDOC_MISSING",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/state-navigation-actions.ts": `${sourceText}\nvoid window;\n`,
        },
      }),
    "STATE_ACTION_PLATFORM_BOUNDARY_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": `${indexText}\nexport { captureRuntimeActionWhen } from "./action-evaluation.js";\n`,
        },
      }),
    "ACTION_EVALUATION_INDEX_LEAK",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/action-evaluation.ts": evaluationText.replace(
            "/** @internal Opaque action-wide cache",
            "/* @internal Opaque action-wide cache",
          ),
        },
      }),
    "ACTION_EVALUATION_TSDOC_MISSING",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/action-evaluation.ts": `${evaluationText}\nvoid window;\n`,
        },
      }),
    "ACTION_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
  );
});

test("detects current-read seam and package-root non-leak drift", async () => {
  const [indexText, sourceText] = await Promise.all([
    readFile(SOURCE_INDEX, "utf8"),
    readFile(ACTION_SOURCE, "utf8"),
  ]);
  const mutatedRead = withStateNavigationApi({
    readRuntimeStateNavigationActions(handle) {
      const result = stateNavigationApi.readRuntimeStateNavigationActions(handle);
      return result.status === "read"
        ? Object.freeze({ ...result, documentId: "com.desen.mutated" })
        : result;
    },
  });
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        stateNavigationApi: mutatedRead,
      }),
    "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/state-navigation-actions.ts": sourceText
            .replace(
              "export type RuntimeStateNavigationActionsReadResult =",
              "type RuntimeStateNavigationActionsReadResult =",
            )
            .replace(
              "export function readRuntimeStateNavigationActions(",
              "function readRuntimeStateNavigationActions(",
            ),
        },
      }),
    "STATE_ACTION_SOURCE_EXPORT_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/src/index.ts": `${indexText}
export { readRuntimeStateNavigationActions } from "./state-navigation-actions.js";
export type { RuntimeStateNavigationActionsReadResult } from "./state-navigation-actions.js";
`,
        },
      }),
    "STATE_ACTION_INDEX_EXPORT_DRIFT",
  );
});

test("detects focused-test and compiler-negative inventory drift", async () => {
  const [packageTests, typeTests] = await Promise.all([
    readFile(PACKAGE_TESTS, "utf8"),
    readFile(TYPE_TESTS, "utf8"),
  ]);
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/test/state-navigation-actions.test.ts": packageTests.replace(
            /\bit\(/u,
            "test(",
          ),
        },
      }),
    "STATE_ACTION_TEST_INVENTORY_DRIFT",
  );
  await rejectsCode(
    () =>
      buildRuntimeCoreStateNavigationActionsEvidence({
        fileOverrides: {
          "packages/runtime-core/test/state-navigation-actions.types.ts": typeTests.replace(
            /\/\/ @ts-expect-error [^\r\n]+\r?\n/u,
            "",
          ),
        },
      }),
    "STATE_ACTION_TYPE_TEST_DRIFT",
  );
});
