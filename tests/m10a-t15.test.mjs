import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import prettier from "prettier";

import prettierConfig from "../prettier.config.mjs";
import {
  buildM10AT15Evidence,
  captureM10AT15SourceAuthority,
  M10AT15ProofError,
  validateM10AT15EvidenceBytes,
  verifyM10AT15Evidence,
  writeM10AT15Evidence,
} from "../scripts/lib/m10a-t15-proof.mjs";

import {
  executeM10AT15Workloads,
  M10AT15ExecutionError,
  parseM10AT15BrowserReceipt,
  parseM10AT15VitestReceipt,
  parseM10AT15WorkbenchGraph,
} from "../scripts/lib/m10a-t15-execution.mjs";
import {
  M10A_T15_APP_TEST_FILES,
  M10A_T15_CORE_TEST_FILES,
  M10A_T15_INHERITED_REUSE_TESTS,
  M10A_T15_MASTER_BROWSER_TITLE,
  M10A_T15_STYLE_ASSERTIONS,
  M10A_T15_STYLE_BROWSER_TITLE,
  M10A_T15_THEME_ASSERTIONS,
  M10A_T15_THEME_BROWSER_TITLES,
  M10A_T15_WORKLOADS,
} from "../scripts/lib/m10a-t15-workloads.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const invalid = (error) =>
  error instanceof M10AT15ExecutionError && error.code === "M10A_T15_REPORT_INVALID";

function browser(kind) {
  if (kind === "theme-browser")
    return {
      profile: "desen.m10a-t03.browser-proof.v1",
      result: "PASS",
      tests: M10A_T15_THEME_BROWSER_TITLES.map((title) => ({ title, result: "PASS" })),
      graphReceipts: ["theme-workbench"],
      assertions: Object.fromEntries(M10A_T15_THEME_ASSERTIONS.map((name) => [name, true])),
    };
  if (kind === "style-browser")
    return {
      profile: "desen.m10a-t12.browser-proof.v1",
      result: "PASS",
      tests: [{ title: M10A_T15_STYLE_BROWSER_TITLE, result: "PASS" }],
      assertions: Object.fromEntries(M10A_T15_STYLE_ASSERTIONS.map((name) => [name, true])),
    };
  return {
    profile: "desen.m10a-t15.browser-proof.v1",
    result: "PASS",
    tests: [{ title: M10A_T15_MASTER_BROWSER_TITLE, result: "PASS" }],
    observations: {
      allLinkedProjectSha256: "a".repeat(64),
      beforeMasterProjectSha256: "b".repeat(64),
      updatedProjectSha256: "c".repeat(64),
      reopenedProjectSha256: "c".repeat(64),
      instanceIds: ["instance.1", "instance.2"],
      detachedRootId: "detached.title",
      observedWorkspacePutCount: 6,
    },
  };
}

function vitest(owner) {
  const packagePath = owner === "app-behavior" ? "apps/desen-app" : "packages/design-system-core";
  const files = owner === "app-behavior" ? M10A_T15_APP_TEST_FILES : M10A_T15_CORE_TEST_FILES;
  const testResults = files.map((file) => ({
    status: "passed",
    name: path.join(ROOT, packagePath, file),
    assertionResults: (file === "test/application.test.tsx"
      ? M10A_T15_INHERITED_REUSE_TESTS
      : [file]
    ).map((title) => ({ status: "passed", fullName: `bounded fixture ${title}` })),
  }));
  const total = testResults.reduce((count, suite) => count + suite.assertionResults.length, 0);
  return {
    success: true,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    numFailedTestSuites: 0,
    numTotalTests: total,
    numPassedTests: total,
    testResults,
  };
}

function graph() {
  return {
    schemaVersion: 1,
    graph: "theme-workbench",
    entry: "index.html",
    result: "PASS",
    assertions: {
      designSystemAuthoringPresent: true,
      isolatedProofGraph: true,
      forbiddenAuthorities: {
        desenApp: false,
        editor: false,
        publisher: false,
        runtime: false,
        starterCatalog: false,
      },
    },
    modules: [
      "apps/design-system-workbench-proof/src/main.tsx",
      "packages/design-system-authoring/dist/theme-authoring.js",
    ],
  };
}

test("M10A-T15 retains explicit fresh owners for recipes and all inherited behavior", async () => {
  assert.deepEqual(
    M10A_T15_WORKLOADS.map(({ id }) => id),
    [
      "build-app-closure",
      "build-control-plane",
      "protocol-snapshot",
      "runtime-baseline",
      "core-public-contract",
      "theme-public-contract",
      "starter-public-contract",
      "core-behavior",
      "theme-behavior",
      "starter-behavior",
      "asset-behavior",
      "source-history",
      "app-behavior",
      "browser-types",
      "theme-browser",
      "style-browser",
      "master-browser",
    ],
  );
  assert.equal(M10A_T15_INHERITED_REUSE_TESTS.length, 7);
  assert.equal(M10A_T15_THEME_BROWSER_TITLES.length, 4);
  assert.equal(M10A_T15_THEME_ASSERTIONS.length, 15);
  assert.equal(M10A_T15_STYLE_ASSERTIONS.length, 11);
  const t12 = JSON.parse(
    await readFile(new URL("../docs/proof/artifacts/m10a-t12.json", import.meta.url)),
  );
  for (const file of t12.focusedTests.appFiles)
    assert.ok(M10A_T15_APP_TEST_FILES.includes(file.replace("apps/desen-app/", "")), file);
  for (const step of M10A_T15_WORKLOADS) {
    assert.ok(Object.isFrozen(step));
    assert.ok(Object.isFrozen(step.args));
    assert.ok(
      !step.args.some(
        (arg) => arg.includes("passWithNoTests") || arg.includes("--testNamePattern"),
      ),
    );
  }
  for (const file of [
    ...M10A_T15_CORE_TEST_FILES.map((file) => `packages/design-system-core/${file}`),
    ...M10A_T15_APP_TEST_FILES.map((file) => `apps/desen-app/${file}`),
  ])
    assert.ok((await readFile(path.join(ROOT, file))).byteLength > 0, file);
});

for (const kind of ["theme-browser", "style-browser", "master-browser"]) {
  test(`M10A-T15 admits the exact ${kind} observation shape and rejects missing or failed cases`, () => {
    const fixture = browser(kind);
    const result = parseM10AT15BrowserReceipt(kind, fixture);
    assert.deepEqual(result, fixture);
    assert.notEqual(result, fixture);
    assert.ok(Object.isFrozen(result.tests));
    for (const change of [
      (value) => {
        value.result = "FAIL";
      },
      (value) => {
        value.tests = [];
      },
      (value) => {
        value.tests.push(value.tests[0]);
      },
      (value) => {
        value.tests[0].result = "SKIP";
      },
      (value) => {
        value.tests[0].title = "unrelated easy test";
      },
      (value) => {
        value.extra = true;
      },
    ]) {
      const value = structuredClone(fixture);
      change(value);
      assert.throws(() => parseM10AT15BrowserReceipt(kind, value), invalid);
    }
  });
}

test("M10A-T15 rejects every lost original theme/style claim", () => {
  for (const kind of ["theme-browser", "style-browser"]) {
    for (const name of Object.keys(browser(kind).assertions)) {
      const value = browser(kind);
      value.assertions[name] = false;
      assert.throws(() => parseM10AT15BrowserReceipt(kind, value), invalid, name);
      Reflect.deleteProperty(value.assertions, name);
      assert.throws(() => parseM10AT15BrowserReceipt(kind, value), invalid, name);
    }
  }
});

test("M10A-T15 rejects an unchanged, incompletely saved, aliased or mismatched reopened master observation", () => {
  for (const change of [
    (value) => {
      value.reopenedProjectSha256 = "d".repeat(64);
    },
    (value) => {
      value.beforeMasterProjectSha256 = value.updatedProjectSha256;
    },
    (value) => {
      value.instanceIds = ["same", "same"];
    },
    (value) => {
      value.instanceIds.pop();
    },
    (value) => {
      value.detachedRootId = "";
    },
    (value) => {
      value.observedWorkspacePutCount = 5;
    },
    (value) => {
      value.updatedProjectSha256 = "not a digest";
    },
  ]) {
    const value = browser("master-browser");
    change(value.observations);
    assert.throws(() => parseM10AT15BrowserReceipt("master-browser", value), invalid);
  }
});

test("M10A-T15 authenticates a fresh isolated workbench graph, not its claimed booleans alone", () => {
  assert.equal(parseM10AT15WorkbenchGraph(graph()).assertions.isolatedProofGraph, true);
  for (const module of [
    "apps/desen-app/src/main.tsx",
    "packages/editor-core/dist/index.js",
    "packages/editor-web/dist/index.js",
    "packages/publisher/dist/index.js",
    "packages/runtime-core/dist/index.js",
    "packages/runtime-react/dist/index.js",
    "packages/runtime-web/dist/index.js",
    "packages/starter-catalog-web/dist/index.js",
    "../foreign.js",
    "/foreign.js",
  ]) {
    const value = graph();
    value.modules.push(module);
    assert.throws(() => parseM10AT15WorkbenchGraph(value), invalid, module);
  }
  const noAuthoring = graph();
  noAuthoring.modules.pop();
  assert.throws(() => parseM10AT15WorkbenchGraph(noAuthoring), invalid);
  const falseClaim = graph();
  falseClaim.assertions.forbiddenAuthorities.editor = true;
  assert.throws(() => parseM10AT15WorkbenchGraph(falseClaim), invalid);
});

for (const owner of ["core-behavior", "app-behavior"]) {
  test(`M10A-T15 requires every ${owner} suite and passed assertion to execute`, () => {
    const fixture = vitest(owner);
    const result = parseM10AT15VitestReceipt(owner, fixture);
    assert.equal(result.passedTests, fixture.numPassedTests);
    assert.ok(Object.isFrozen(result.files[0].tests));
    for (const change of [
      (value) => {
        value.success = false;
      },
      (value) => {
        value.numPendingTests = 1;
      },
      (value) => {
        value.numTodoTests = 1;
      },
      (value) => {
        value.numPassedTests -= 1;
      },
      (value) => {
        value.testResults[0].assertionResults[0].status = "pending";
      },
      (value) => {
        value.testResults[0].name = "/foreign.test.ts";
      },
      (value) => {
        value.testResults.pop();
      },
      (value) => {
        value.testResults.push(value.testResults[0]);
      },
    ]) {
      const value = structuredClone(fixture);
      change(value);
      assert.throws(() => parseM10AT15VitestReceipt(owner, value), invalid);
    }
  });
}

test("M10A-T15 rejects each missing T14 reuse case even when the claimed counts remain coherent", () => {
  for (const title of M10A_T15_INHERITED_REUSE_TESTS) {
    const value = vitest("app-behavior");
    const assertion = value.testResults[0].assertionResults.find(({ fullName }) =>
      fullName.includes(title),
    );
    assertion.fullName = "unrelated passing case";
    assert.throws(() => parseM10AT15VitestReceipt("app-behavior", value), invalid, title);
  }
});

test("M10A-T15 rejects unsafe observation wrappers without executing accessors or Proxy traps", () => {
  let touched = false;
  const getter = Object.defineProperty({}, "result", {
    enumerable: true,
    get() {
      touched = true;
      return "PASS";
    },
  });
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        touched = true;
        return [];
      },
    },
  );
  const cycle = {};
  cycle.self = cycle;
  for (const value of [getter, proxy, cycle, Object.create(null)]) {
    assert.throws(() => parseM10AT15BrowserReceipt("master-browser", value), invalid);
    assert.throws(() => parseM10AT15WorkbenchGraph(value), invalid);
    assert.throws(() => parseM10AT15VitestReceipt("app-behavior", value), invalid);
  }
  assert.equal(touched, false);
});

test("M10A-T15 stops immediately on failed execution and cannot authorize success from empty child output", async () => {
  for (const exit of [
    { code: 1, signal: null },
    { code: 0, signal: "SIGTERM" },
    { code: 0, signal: null, failedToStart: true },
    { code: 0, signal: null, timedOut: true },
    { code: 0, signal: null },
  ]) {
    const seen = [];
    let diagnostics;
    try {
      await assert.rejects(
        executeM10AT15Workloads(async (step) => {
          seen.push(step.id);
          return exit;
        }),
        (error) => {
          assert.ok(error instanceof M10AT15ExecutionError);
          diagnostics = error.diagnosticsDirectory;
          assert.ok(
            typeof diagnostics === "string" &&
              path.dirname(diagnostics) === path.resolve(tmpdir()) &&
              path.basename(diagnostics).startsWith("desen-m10a-t15-proof-"),
          );
          return true;
        },
      );
      const zeroOnly =
        exit.code === 0 && exit.signal === null && !exit.failedToStart && !exit.timedOut;
      assert.deepEqual(
        seen,
        M10A_T15_WORKLOADS.slice(0, zeroOnly ? 8 : 1).map(({ id }) => id),
      );
    } finally {
      if (diagnostics !== undefined) await rm(diagnostics, { recursive: true, force: true });
    }
  }
});

test("M10A-T15 source capture binds the current implementation, exact Catalog and immutable predecessors", async () => {
  const source = await captureM10AT15SourceAuthority();
  assert.equal(source.catalog.version, "0.7.0");
  assert.equal(source.catalog.componentCount, 32);
  assert.equal(
    source.catalog.sha256,
    "aa8e9fb01fed930a7f56cd09cf7328e6a49ffa556c4fe80571b5454dd24f87b6",
  );
  assert.deepEqual(
    source.predecessors.map(({ task }) => task),
    ["M10A-T02", "M10A-T03", "M10A-T12", "M10A-T13", "M10A-T14"],
  );
  assert.equal(source.files.length, new Set(source.files.map(({ path: file }) => file)).size);
  for (const file of [
    "packages/design-system-core/src/recipe-transactions.ts",
    "packages/design-system-core/src/master-edit.ts",
    "apps/desen-app/src/project-authoring-controller.ts",
    "apps/desen-app/src/project-master-draft-controller.ts",
    "apps/desen-app/src/main.tsx",
    "apps/desen-app-browser-e2e/t15-masters-instances.pw.ts",
    "scripts/lib/m10a-t15-workloads.mjs",
    "scripts/lib/m10a-t15-execution.mjs",
    "scripts/lib/atomic-proof-artifact.mjs",
    "scripts/lib/m10a-t15-legacy-input-receipts.mjs",
    "prettier.config.mjs",
  ])
    assert.ok(
      source.files.some(({ path: name }) => name === file),
      file,
    );
  assert.ok(Object.isFrozen(source.files[0]));
});

test("M10A-T15 production capture and verification reject every observation, runner or workspace bypass", async () => {
  let touched = false;
  const hostile = Object.defineProperty({}, "runChild", {
    get() {
      touched = true;
      throw new Error("must not execute");
    },
  });
  for (const command of [
    captureM10AT15SourceAuthority,
    buildM10AT15Evidence,
    writeM10AT15Evidence,
    verifyM10AT15Evidence,
  ]) {
    for (const value of [
      {},
      null,
      hostile,
      new Proxy({}, {}),
      { browserObservation: browser("master-browser") },
      { workspaceRoot: ROOT },
      { runChild: async () => ({ code: 0, signal: null }) },
    ])
      await assert.rejects(
        command(value),
        (error) => error instanceof M10AT15ProofError && error.code === "M10A_T15_OPTIONS_INVALID",
      );
  }
  assert.equal(touched, false);
});

test("M10A-T15 compares exact canonical evidence bytes and rejects mutated values or formatting", async () => {
  // A byte-comparison unit fixture, not a fabricated production T15 evidence record.
  const expected = {
    source: { fingerprint: "a".repeat(64) },
    execution: [{ id: "fixture", result: "PASS" }],
    formattingBoundary: ["a".repeat(20), "b".repeat(20), "c".repeat(20)],
  };
  const bytes = Buffer.from(
    await prettier.format(JSON.stringify(expected, null, 2), { ...prettierConfig, parser: "json" }),
  );
  assert.equal(await prettier.check(bytes.toString(), { ...prettierConfig, parser: "json" }), true);
  await validateM10AT15EvidenceBytes(bytes, expected);
  for (const value of [
    Buffer.from(
      await prettier.format(JSON.stringify(expected), { parser: "json", printWidth: 80 }),
    ),
    Buffer.from(JSON.stringify(expected)),
    Buffer.concat([bytes, Buffer.from("\n")]),
    Buffer.from(bytes.toString().replace("PASS", "FAIL")),
    new Proxy(bytes, {}),
  ])
    await assert.rejects(
      validateM10AT15EvidenceBytes(value, expected),
      (error) => error instanceof M10AT15ProofError && error.code === "M10A_T15_ARTIFACT_DRIFT",
    );
});
