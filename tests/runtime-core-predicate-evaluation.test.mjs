import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeCorePredicateEvaluationEvidenceError,
  buildRuntimeCorePredicateEvaluationEvidence,
  verifyRuntimeCorePredicateEvaluationEvidence,
  writeRuntimeCorePredicateEvaluationEvidence,
} from "../scripts/lib/runtime-core-predicate-evaluation-proof.mjs";

const runtimeApi = await import("../packages/runtime-core/dist/index.js");
const predicateModuleApi = await import("../packages/runtime-core/dist/predicate-evaluation.js");

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeCorePredicateEvaluationEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts tracked deterministic M04-T04 predicate evidence", async () => {
  const result = await verifyRuntimeCorePredicateEvaluationEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.sourceRuntimeExports, 5);
  assert.equal(result.runtimeExports, 2);
  assert.equal(result.typeExports, 10);
  assert.equal(result.internalRuntimeExports, 3);
  assert.equal(result.packageTests, 53);
  assert.equal(result.compilerNegativeCases, 13);
  assert.equal(result.rootMutationTests, 14);
  assert.equal(result.traceRules, 8);
  assert.equal(result.trackedFiles, 11);
  assert.equal(result.operatorProbes, 13);
  assert.equal(result.arityProbes, 162);
  assert.equal(result.truthyFalseProbes, 6);
  assert.equal(result.utf16Probes, 5);
  assert.equal(result.presenceProbes, 5);
  assert.equal(result.mismatchDiagnostics, 2);
  assert.equal(result.existenceProbes, 4);
  assert.equal(result.limitProbes, 4);
  assert.equal(result.earlyCutoffProbes, 1);
  assert.equal(result.terminalPrecedenceProbes, 2);
  assert.equal(result.platformEffects, 0);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent predicate evidence builds are byte-identical", async () => {
  const first = await buildRuntimeCorePredicateEvaluationEvidence({
    verifyPrerequisite: false,
  });
  const second = await buildRuntimeCorePredicateEvaluationEvidence({
    verifyPrerequisite: false,
  });

  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or one-byte-tampered predicate evidence", async () => {
  const pristine = await buildRuntimeCorePredicateEvaluationEvidence({
    verifyPrerequisite: false,
  });
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyRuntimeCorePredicateEvaluationEvidence({
      artifactBytes: tampered,
      buildOptions: { verifyPrerequisite: false },
    }),
    hasEvidenceCode("PREDICATE_EVALUATION_ARTIFACT_DRIFT"),
  );
});

test("rejects closed-operator and canonical-comparison semantic drift", async () => {
  const changedApis = [
    {
      ...runtimeApi,
      evaluateRuntimePredicate(predicate, snapshot) {
        const result = runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
        if (predicate?.op === "eq" && result.status === "evaluated") {
          return { ...result, value: false };
        }
        return result;
      },
    },
    {
      ...runtimeApi,
      evaluateRuntimePredicate(predicate, snapshot) {
        if (
          predicate?.op === "contains" &&
          predicate.args?.[0] === "e\u0301" &&
          predicate.args?.[1] === "\u00e9"
        ) {
          return { status: "evaluated", value: true, diagnostics: [] };
        }
        return runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
      },
    },
    {
      ...runtimeApi,
      evaluateRuntimePredicate(predicate, snapshot) {
        if (
          predicate?.op === "in" &&
          predicate.args?.[0] === "\u00e9" &&
          predicate.args?.[1] === "e\u0301"
        ) {
          return { status: "evaluated", value: true, diagnostics: [] };
        }
        return runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
      },
    },
    {
      ...runtimeApi,
      evaluateRuntimePredicate(predicate, snapshot) {
        if (
          predicate?.op === "contains" &&
          predicate.args?.[0] === "DESEN" &&
          predicate.args?.[1] === "desen"
        ) {
          return { status: "evaluated", value: true, diagnostics: [] };
        }
        return runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
      },
    },
    {
      ...runtimeApi,
      evaluateRuntimePredicate(predicate, snapshot) {
        if (predicate?.op === "all" && predicate.args?.length === 32) {
          return { status: "invalid", pointer: "/args", reason: "malformed-predicate" };
        }
        return runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
      },
    },
    {
      ...runtimeApi,
      evaluateRuntimePredicate(predicate, snapshot) {
        if (predicate?.op === "exists" && predicate.args?.length === 2) {
          return { status: "evaluated", value: true, diagnostics: [] };
        }
        return runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
      },
    },
    {
      ...runtimeApi,
      evaluateRuntimePredicate(predicate, snapshot) {
        if (predicate?.op === "all" && predicate.args?.[0]?.$token === "color.action") {
          return {
            status: "invalid",
            pointer: "",
            reason: "unsafe-or-unbounded-json",
          };
        }
        return runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
      },
    },
    {
      ...runtimeApi,
      evaluateRuntimePredicate(predicate, snapshot) {
        if (
          predicate?.op === "all" &&
          predicate.args?.[0]?.op === "eq" &&
          predicate.args?.[1]?.$token === "color.action"
        ) {
          return { status: "deferred", form: "token", pointer: "/args/1/$token" };
        }
        return runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
      },
    },
  ];

  for (const changedApi of changedApis) {
    await assert.rejects(
      buildRuntimeCorePredicateEvaluationEvidence({
        runtimeApi: changedApi,
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT"),
    );
  }

  const changedPredicateModuleApi = {
    ...predicateModuleApi,
    resolveRuntimePredicateOperands(prepared, snapshot) {
      const result = predicateModuleApi.resolveRuntimePredicateOperands(prepared, snapshot);
      if (!Array.isArray(result) && result.status === "invalid") {
        const value = "x".repeat(524_289);
        return Object.freeze([
          Object.freeze({ status: "resolved", value }),
          Object.freeze({ status: "resolved", value }),
        ]);
      }
      return result;
    },
  };
  await assert.rejects(
    buildRuntimeCorePredicateEvaluationEvidence({
      predicateModuleApi: changedPredicateModuleApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT"),
  );
});

test("rejects diagnostic-order and no-short-circuit semantic drift", async () => {
  const changedApi = {
    ...runtimeApi,
    evaluateRuntimePredicate(predicate, snapshot) {
      const result = runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
      if (
        predicate?.op === "all" &&
        predicate.args?.length === 3 &&
        result.status === "evaluated"
      ) {
        return { ...result, diagnostics: [] };
      }
      return result;
    },
  };

  await assert.rejects(
    buildRuntimeCorePredicateEvaluationEvidence({
      runtimeApi: changedApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT"),
  );
});

test("rejects unresolved, deferred, invalid, and exists semantic drift", async () => {
  const changedApis = [
    {
      ...runtimeApi,
      evaluateRuntimePredicate(predicate, snapshot) {
        if (predicate?.op === "truthy" && predicate.args?.[0]?.$token === "color.action") {
          return { status: "evaluated", value: false, diagnostics: [] };
        }
        return runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
      },
    },
    {
      ...runtimeApi,
      evaluateRuntimePredicate(predicate, snapshot) {
        if (predicate?.op === "exists" && predicate.args?.[0]?.fallback === true) {
          return { status: "evaluated", value: true, diagnostics: [] };
        }
        return runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
      },
    },
    {
      ...runtimeApi,
      evaluateRuntimePredicate(predicate, snapshot) {
        if (predicate?.op === "unknown") {
          return { status: "evaluated", value: false, diagnostics: [] };
        }
        return runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
      },
    },
    {
      ...runtimeApi,
      evaluateRuntimePredicate(predicate, snapshot) {
        const result = runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
        if (predicate?.op === "truthy" && predicate.args?.[0]?.$token === "color.action") {
          return { ...result };
        }
        return result;
      },
    },
    {
      ...runtimeApi,
      evaluateRuntimePredicate(predicate, snapshot) {
        if (
          predicate?.op === "eq" &&
          predicate.args?.[0]?.$ref === "state.aggregateString" &&
          predicate.args?.[1]?.$ref === "state.aggregateString"
        ) {
          return { status: "evaluated", value: true, diagnostics: [] };
        }
        return runtimeApi.evaluateRuntimePredicate(predicate, snapshot);
      },
    },
  ];

  for (const changedApi of changedApis) {
    await assert.rejects(
      buildRuntimeCorePredicateEvaluationEvidence({
        runtimeApi: changedApi,
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT"),
    );
  }
});

test("rejects conditional-presence fail-closed semantic drift", async () => {
  const changedApi = {
    ...runtimeApi,
    evaluateRuntimeConditionalPresence(when, snapshot) {
      if (when === undefined) {
        return { status: "evaluated", present: false, diagnostics: [] };
      }
      return runtimeApi.evaluateRuntimeConditionalPresence(when, snapshot);
    },
  };

  await assert.rejects(
    buildRuntimeCorePredicateEvaluationEvidence({
      runtimeApi: changedApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT"),
  );
});

test("rejects true conditional-presence semantic drift", async () => {
  const changedApi = {
    ...runtimeApi,
    evaluateRuntimeConditionalPresence(when, snapshot) {
      if (when?.op === "truthy" && when.args?.length === 1 && when.args[0] === true) {
        return { status: "evaluated", present: false, diagnostics: [] };
      }
      return runtimeApi.evaluateRuntimeConditionalPresence(when, snapshot);
    },
  };

  await assert.rejects(
    buildRuntimeCorePredicateEvaluationEvidence({
      runtimeApi: changedApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT"),
  );
});

test("rejects source, public export, TSDoc, platform, and distribution drift", async () => {
  const sourcePath = "packages/runtime-core/src/predicate-evaluation.ts";
  const indexPath = "packages/runtime-core/src/index.ts";
  const declarationPath = "packages/runtime-core/dist/predicate-evaluation.d.ts";
  const builtPath = "packages/runtime-core/dist/predicate-evaluation.js";
  const source = await readFile(new URL(`../${sourcePath}`, import.meta.url), "utf8");
  const index = await readFile(new URL(`../${indexPath}`, import.meta.url), "utf8");
  const declaration = await readFile(new URL(`../${declarationPath}`, import.meta.url), "utf8");
  const built = await readFile(new URL(`../${builtPath}`, import.meta.url), "utf8");

  for (const [fileOverrides, expectedCode] of [
    [{ [sourcePath]: source.replace("/**", "/*") }, "PREDICATE_EVALUATION_TSDOC_MISSING"],
    [
      { [sourcePath]: `import React from "react";\n${source}` },
      "PREDICATE_EVALUATION_IMPORT_BOUNDARY_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nvoid new Function("return 1");\n` },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nvoid Math.random();\n` },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      {
        [sourcePath]: `${source}\nconst nondeterministic = Math.random;\nvoid nondeterministic();\n`,
      },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nvoid RegExp("dynamic");\n` },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      {
        [sourcePath]: `${source}\nconst RuntimeRegExp = RegExp;\nvoid RuntimeRegExp("dynamic");\n`,
      },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      {
        [sourcePath]:
          `${source}\nconst dynamicFactory = (() => {}).constructor as FunctionConstructor;\n` +
          'void dynamicFactory("return 1")();\n',
      },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      {
        [sourcePath]:
          `${source}\nconst reflectedFactory = Reflect.get(() => {}, "constructor");\n` +
          'void reflectedFactory("return 1")();\n',
      },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nvoid WebAssembly;\n` },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nvoid "a".localeCompare("b");\n` },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      {
        [sourcePath]:
          `${source}\nconst collate = String.prototype.localeCompare;\n` +
          'void Reflect.apply(collate, "a", ["b"]);\n',
      },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      {
        [sourcePath]: `${source}\nObject.defineProperty(Object.prototype, "injected", { value: true });\n`,
      },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      {
        [sourcePath]:
          `${source}\nconst mutateGlobal = Object.defineProperty;\n` +
          'void mutateGlobal({}, "injected", { value: true });\n',
      },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nObject.prototype.injected = true;\n` },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nArray.prototype.injected = true;\n` },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      {
        [sourcePath]:
          `${source}\nconst arrayPrototype = Array.prototype;\n` +
          "arrayPrototype.injected = true;\n",
      },
      "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nconst addedExport = 1;\nexport { addedExport };\n` },
      "PREDICATE_EVALUATION_SOURCE_EXPORT_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nexport const { addedExport } = { addedExport: 1 };\n` },
      "PREDICATE_EVALUATION_SOURCE_EXPORT_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nexport default 1;\n` },
      "PREDICATE_EVALUATION_SOURCE_EXPORT_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nexport * from "./host-ports.js";\n` },
      "PREDICATE_EVALUATION_SOURCE_EXPORT_DRIFT",
    ],
    [
      {
        [sourcePath]: `${source}\ndeclare global { interface InjectedPredicateGlobal { value: true } }\n`,
      },
      "PREDICATE_EVALUATION_SOURCE_EXPORT_DRIFT",
    ],
    [
      {
        [sourcePath]: source.replace(
          'if (outcome.status === "resolved" && !chargeResolvedValue(outcome.value, budget)) {\n      return invalidPredicate(ROOT_POINTER, "unsafe-or-unbounded-json");\n    }\n    outcomes.push(outcome);',
          'if (outcome.status === "resolved" && !chargeResolvedValue(outcome.value, budget)) {\n      outcomes.push(outcome);\n      continue;\n    }\n    outcomes.push(outcome);',
        ),
      },
      "PREDICATE_EVALUATION_AGGREGATE_CUTOFF_DRIFT",
    ],
    [
      {
        [indexPath]: `${index}\nexport { prepareRuntimePredicateEvaluation } from "./predicate-evaluation.js";\n`,
      },
      "PREDICATE_EVALUATION_INDEX_EXPORT_DRIFT",
    ],
    [
      {
        [declarationPath]: declaration.replace(
          "RuntimePredicateTypeMismatch",
          "ChangedPredicateTypeMismatch",
        ),
      },
      "PREDICATE_EVALUATION_DECLARATION_DRIFT",
    ],
    [
      {
        [declarationPath]: `${declaration}\ndeclare const addedExport: 1;\nexport { addedExport };\n`,
      },
      "PREDICATE_EVALUATION_DECLARATION_DRIFT",
    ],
    [
      { [declarationPath]: `${declaration}\nexport as namespace InjectedPredicateNamespace;\n` },
      "PREDICATE_EVALUATION_DECLARATION_DRIFT",
    ],
    [
      { [builtPath]: `${built}\nvoid window;\n` },
      "PREDICATE_EVALUATION_DISTRIBUTION_BOUNDARY_DRIFT",
    ],
    [
      { [builtPath]: `${built}\nvoid Math.random();\n` },
      "PREDICATE_EVALUATION_DISTRIBUTION_BOUNDARY_DRIFT",
    ],
    [
      { [builtPath]: `${built}\nvoid new RegExp("dynamic");\n` },
      "PREDICATE_EVALUATION_DISTRIBUTION_BOUNDARY_DRIFT",
    ],
    [
      { [builtPath]: `${built}\nvoid "DESEN".toLocaleLowerCase();\n` },
      "PREDICATE_EVALUATION_DISTRIBUTION_BOUNDARY_DRIFT",
    ],
    [
      {
        [builtPath]: `${built}\nReflect.set(Object.prototype, "injected", true);\n`,
      },
      "PREDICATE_EVALUATION_DISTRIBUTION_BOUNDARY_DRIFT",
    ],
    [
      { [builtPath]: `${built}\ndelete Object.prototype.injected;\n` },
      "PREDICATE_EVALUATION_DISTRIBUTION_BOUNDARY_DRIFT",
    ],
    [
      { [builtPath]: `${built}\nconst addedExport = 1;\nexport { addedExport };\n` },
      "PREDICATE_EVALUATION_DISTRIBUTION_DRIFT",
    ],
    [
      { [builtPath]: `${built}\nexport const [addedExport] = [1];\n` },
      "PREDICATE_EVALUATION_DISTRIBUTION_DRIFT",
    ],
  ]) {
    await assert.rejects(
      buildRuntimeCorePredicateEvaluationEvidence({
        fileOverrides,
        verifyPrerequisite: false,
      }),
      hasEvidenceCode(expectedCode),
    );
  }
});

test("rejects package, root wiring, skipped tests, and conditional test registration drift", async () => {
  const packagePath = "packages/runtime-core/package.json";
  const rootPath = "package.json";
  const packageTestsPath = "packages/runtime-core/test/predicate-evaluation.test.ts";
  const typeTestsPath = "packages/runtime-core/test/predicate-evaluation.types.ts";
  const rootTestsPath = "tests/runtime-core-predicate-evaluation.test.mjs";
  const packageManifest = JSON.parse(
    await readFile(new URL(`../${packagePath}`, import.meta.url), "utf8"),
  );
  const rootManifest = JSON.parse(
    await readFile(new URL(`../${rootPath}`, import.meta.url), "utf8"),
  );
  const packageTests = await readFile(new URL(`../${packageTestsPath}`, import.meta.url), "utf8");
  const typeTests = await readFile(new URL(`../${typeTestsPath}`, import.meta.url), "utf8");
  const rootTests = await readFile(new URL(`../${rootTestsPath}`, import.meta.url), "utf8");

  packageManifest.scripts["test:predicate-evaluation"] = "vitest run";
  await assert.rejects(
    buildRuntimeCorePredicateEvaluationEvidence({
      fileOverrides: { [packagePath]: `${JSON.stringify(packageManifest)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("PREDICATE_EVALUATION_PACKAGE_CONTRACT_DRIFT"),
  );

  rootManifest.scripts["verify:runtime-core-predicate-evaluation"] = "node changed.mjs";
  await assert.rejects(
    buildRuntimeCorePredicateEvaluationEvidence({
      fileOverrides: { [rootPath]: `${JSON.stringify(rootManifest)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("PREDICATE_EVALUATION_ROOT_SCRIPT_DRIFT"),
  );

  for (const [targetPath, changedSource] of [
    [
      packageTestsPath,
      packageTests.replace('it("supports the complete', 'it.skip("supports the complete'),
    ],
    [typeTestsPath, typeTests.replace("@ts-expect-error", "@type-error")],
    [
      typeTestsPath,
      typeTests.replace(
        "the operator vocabulary is closed",
        "an unrelated expected error replaced the closed-operator contract",
      ),
    ],
    [
      rootTestsPath,
      rootTests.replace(
        'test("two independent predicate evidence builds',
        'false && test("two independent predicate evidence builds',
      ),
    ],
    [packageTestsPath, packageTests.replace('from "vitest";', 'from "fake-vitest";')],
    [
      packageTestsPath,
      packageTests.replace(
        'import { describe, expect, it, vi } from "vitest";',
        'import { describe, expect, it, vi } from "vitest";\nObject.defineProperty(it, "each", { value: () => () => undefined });',
      ),
    ],
    [
      packageTestsPath,
      packageTests.replace(
        'describe("evaluateRuntimePredicate", () => {',
        'describe("evaluateRuntimePredicate", { skip: true }, () => {',
      ),
    ],
    [rootTestsPath, rootTests.replace('import test from "node:test";', "const test = () => {};")],
    [
      rootTestsPath,
      rootTests.replace(
        'import assert from "node:assert/strict";',
        "const assert = Object.create(null);",
      ),
    ],
  ]) {
    await assert.rejects(
      buildRuntimeCorePredicateEvaluationEvidence({
        fileOverrides: { [targetPath]: changedSource },
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT"),
    );
  }
});

test("rejects direct trace ownership and PF-034 boundary drift", async () => {
  const tracePath = "docs/proof/protocol-0.1.0-traceability.json";
  const findingPath = "docs/plan/PROTOCOL-FINDINGS.md";
  const trace = JSON.parse(await readFile(new URL(`../${tracePath}`, import.meta.url), "utf8"));
  trace.proseRules.find((rule) => rule.id === "R-050").owners = ["M02-T10"];
  await assert.rejects(
    buildRuntimeCorePredicateEvaluationEvidence({
      fileOverrides: { [tracePath]: `${JSON.stringify(trace)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("PREDICATE_EVALUATION_TRACE_DRIFT"),
  );

  const findings = await readFile(new URL(`../${findingPath}`, import.meta.url), "utf8");
  await assert.rejects(
    buildRuntimeCorePredicateEvaluationEvidence({
      fileOverrides: {
        [findingPath]: findings.replace(
          "Evaluation is recursive left-to-right by argument position and does not short-circuit",
          "Evaluation order is unspecified",
        ),
      },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("PREDICATE_EVALUATION_FINDING_DRIFT"),
  );
});

test("rejects stale injected M04-T02 prerequisite bytes", async () => {
  const artifactPath = new URL(
    "../docs/proof/artifacts/runtime-core-0.1.0-value-resolution.json",
    import.meta.url,
  );
  const original = await readFile(artifactPath);
  const tampered = Buffer.concat([original, Buffer.from(" ")]);

  await assert.rejects(
    buildRuntimeCorePredicateEvaluationEvidence({
      prerequisiteArtifactBytes: tampered,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("PREDICATE_EVALUATION_PREREQUISITE_DRIFT"),
  );
});

test("atomic predicate writer rejects symlink destinations", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m04-predicate-symlink-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const target = path.join(directory, "target.json");
  const link = path.join(directory, "artifact.json");
  await writeFile(target, "{}\n");
  await symlink(target, link);
  const evidence = await buildRuntimeCorePredicateEvaluationEvidence({
    verifyPrerequisite: false,
  });

  await assert.rejects(
    writeRuntimeCorePredicateEvaluationEvidence({
      artifactPath: link,
      preparedEvidence: evidence,
      buildOptions: { verifyPrerequisite: false },
    }),
    /regular file/u,
  );
});

test("atomic predicate writer detects temporary-byte tampering before rename", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m04-predicate-tamper-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifactPath = path.join(directory, "artifact.json");
  const evidence = await buildRuntimeCorePredicateEvaluationEvidence({
    verifyPrerequisite: false,
  });

  await assert.rejects(
    writeRuntimeCorePredicateEvaluationEvidence({
      artifactPath,
      preparedEvidence: evidence,
      buildOptions: { verifyPrerequisite: false },
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "{}\n");
      },
    }),
    /temporary bytes changed/u,
  );
});
