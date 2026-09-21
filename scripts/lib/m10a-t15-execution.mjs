import { spawn } from "node:child_process";
import { mkdir, mkdtemp, lstat, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { isDeepStrictEqual, types } from "node:util";

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
} from "./m10a-t15-workloads.mjs";
import { M10A_T17_SUCCESSOR_TESTS } from "./m10a-t17-legacy-input-receipts.mjs";
import { M10A_T20_SUCCESSOR_TESTS } from "./m10a-t20-legacy-input-receipts.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MAX_REPORT_BYTES = 4 * 1024 * 1024;
const VITEST_WORKSPACES = Object.freeze({
  "core-behavior": "packages/design-system-core",
  "theme-behavior": "packages/design-system-authoring",
  "starter-behavior": "packages/starter-catalog-web",
  "asset-behavior": "packages/design-system-assets",
  "source-history": "packages/editor-core",
  "app-behavior": "apps/desen-app",
});

/** A bounded, secret-conscious failure in the T15 fresh-execution boundary. */
export class M10AT15ExecutionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT15ExecutionError";
    this.code = `M10A_T15_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT15ExecutionError(code, message);
}

function inert(value, seen = new Set(), depth = 0) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || types.isProxy(value) || depth > 64 || seen.has(value))
    fail("REPORT_INVALID", "Reports must contain bounded inert JSON values.");
  const array = Array.isArray(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype))
    fail("REPORT_INVALID", "Reports must contain plain records and arrays.");
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !descriptor?.enumerable || !("value" in descriptor))
      fail("REPORT_INVALID", "Report members must be inert own data.");
    inert(descriptor.value, seen, depth + 1);
  }
  seen.delete(value);
}

function record(value, keys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort())
  )
    fail("REPORT_INVALID", `${label} has an unexpected shape.`);
}

function equal(value, expected, label) {
  if (!isDeepStrictEqual(value, expected)) fail("REPORT_INVALID", `${label} drifted.`);
}

function freeze(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function assertions(value, expected) {
  record(value, expected, "Browser assertions");
  for (const name of expected) equal(value[name], true, `Browser assertion ${name}`);
}

function browserTests(value, expected) {
  if (!Array.isArray(value)) fail("REPORT_INVALID", "Browser cases are missing.");
  for (const item of value) record(item, ["title", "result"], "Browser case");
  equal(
    [...value].sort((a, b) => a.title.localeCompare(b.title)),
    [...expected].sort().map((title) => ({ title, result: "PASS" })),
    "Passed browser inventory",
  );
}

/** Validates actual post-execution browser receipts without accepting an invented PASS alone. */
export function parseM10AT15BrowserReceipt(kind, input) {
  inert(input);
  if (kind === "theme-browser") {
    record(input, ["profile", "result", "tests", "graphReceipts", "assertions"], "Theme browser");
    equal(input.profile, "desen.m10a-t03.browser-proof.v1", "Theme browser profile");
    equal(input.result, "PASS", "Theme browser result");
    equal(input.graphReceipts, ["theme-workbench"], "Theme graph identity");
    assertions(input.assertions, M10A_T15_THEME_ASSERTIONS);
    browserTests(input.tests, M10A_T15_THEME_BROWSER_TITLES);
  } else if (kind === "style-browser") {
    record(input, ["profile", "result", "tests", "assertions"], "Style browser");
    equal(input.profile, "desen.m10a-t12.browser-proof.v1", "Style browser profile");
    equal(input.result, "PASS", "Style browser result");
    assertions(input.assertions, M10A_T15_STYLE_ASSERTIONS);
    browserTests(input.tests, [M10A_T15_STYLE_BROWSER_TITLE]);
  } else if (kind === "master-browser") {
    record(input, ["profile", "result", "tests", "observations"], "Master browser");
    equal(input.profile, "desen.m10a-t15.browser-proof.v1", "Master browser profile");
    equal(input.result, "PASS", "Master browser result");
    browserTests(input.tests, [M10A_T15_MASTER_BROWSER_TITLE]);
    const observed = input.observations;
    const digests = [
      "allLinkedProjectSha256",
      "beforeMasterProjectSha256",
      "updatedProjectSha256",
      "reopenedProjectSha256",
    ];
    record(
      observed,
      [...digests, "instanceIds", "detachedRootId", "observedWorkspacePutCount"],
      "Master observations",
    );
    for (const key of digests)
      if (typeof observed[key] !== "string" || !/^[a-f0-9]{64}$/u.test(observed[key]))
        fail("REPORT_INVALID", "Master project fingerprints are missing.");
    equal(observed.updatedProjectSha256, observed.reopenedProjectSha256, "Complete project reopen");
    if (new Set(digests.slice(0, 3).map((key) => observed[key])).size !== 3)
      fail("REPORT_INVALID", "The distinct authored project stages were not observed.");
    if (
      !Array.isArray(observed.instanceIds) ||
      observed.instanceIds.length !== 2 ||
      new Set(observed.instanceIds).size !== 2 ||
      observed.instanceIds.some(
        (id) => typeof id !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u.test(id),
      ) ||
      typeof observed.detachedRootId !== "string" ||
      !/^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u.test(observed.detachedRootId) ||
      !Number.isSafeInteger(observed.observedWorkspacePutCount) ||
      observed.observedWorkspacePutCount < 6
    )
      fail("REPORT_INVALID", "Master instance/save observations are incomplete.");
  } else fail("REPORT_INVALID", "Unknown browser owner.");
  return freeze(structuredClone(input));
}

/** Requires the newly built workbench to retain its original isolated module boundary. */
export function parseM10AT15WorkbenchGraph(input) {
  inert(input);
  record(
    input,
    ["schemaVersion", "graph", "entry", "result", "assertions", "modules"],
    "Workbench graph",
  );
  equal(input.schemaVersion, 1, "Workbench graph version");
  equal(input.graph, "theme-workbench", "Workbench graph identity");
  equal(input.entry, "index.html", "Workbench entry");
  equal(input.result, "PASS", "Workbench build result");
  equal(
    input.assertions,
    {
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
    "Workbench graph boundary",
  );
  if (
    !Array.isArray(input.modules) ||
    input.modules.length === 0 ||
    input.modules.length > 2048 ||
    new Set(input.modules).size !== input.modules.length ||
    input.modules.some(
      (module) =>
        typeof module !== "string" ||
        module.length > 4096 ||
        path.isAbsolute(module) ||
        module.split("/").includes("..") ||
        /(?:^|\/)(?:apps\/desen-app|packages\/(?:editor-core|editor-web|publisher|runtime-core|runtime-react|runtime-web|starter-catalog-web))\//u.test(
          module,
        ),
    ) ||
    !input.modules.some((module) => module.startsWith("packages/design-system-authoring/"))
  )
    fail("REPORT_INVALID", "Workbench module observations violate isolation.");
  // Platform/bundler virtual module names are not portable release identities.
  return freeze({
    schemaVersion: 1,
    graph: "theme-workbench",
    assertions: structuredClone(input.assertions),
  });
}

/** Records executed, passed assertions and rejects skips, empty suites or lost T14 cases. */
export function parseM10AT15VitestReceipt(owner, input, workspaceRoot = ROOT) {
  inert(input);
  const packagePath = VITEST_WORKSPACES[owner];
  if (
    packagePath === undefined ||
    input?.success !== true ||
    input.numFailedTests !== 0 ||
    input.numPendingTests !== 0 ||
    input.numTodoTests !== 0 ||
    input.numFailedTestSuites !== 0 ||
    !Number.isSafeInteger(input.numTotalTests) ||
    input.numTotalTests < 1 ||
    input.numPassedTests !== input.numTotalTests ||
    !Array.isArray(input.testResults)
  )
    fail("REPORT_INVALID", `${owner} has missing, skipped or failed tests.`);
  const files = [];
  const observedNames = [];
  let assertionCount = 0;
  let successorAssertionCount = 0;
  for (const suite of input.testResults) {
    if (
      suite.status !== "passed" ||
      typeof suite.name !== "string" ||
      !Array.isArray(suite.assertionResults) ||
      suite.assertionResults.length === 0
    )
      fail("REPORT_INVALID", `${owner} has an unexecuted suite.`);
    const relative = path
      .relative(path.join(workspaceRoot, packagePath), suite.name)
      .split(path.sep)
      .join("/");
    if (
      !/^test\/[A-Za-z0-9._/-]+\.test\.tsx?$/u.test(relative) ||
      relative.split("/").includes("..")
    )
      fail("REPORT_INVALID", `${owner} contains a foreign test file.`);
    const successorTests = [...M10A_T17_SUCCESSOR_TESTS, ...M10A_T20_SUCCESSOR_TESTS].filter(
      ({ path: successorPath }) => successorPath === `${packagePath}/${relative}`,
    );
    const names = [];
    const observedSuccessors = new Set();
    for (const assertion of suite.assertionResults) {
      if (
        assertion.status !== "passed" ||
        typeof assertion.fullName !== "string" ||
        assertion.fullName.length === 0
      )
        fail("REPORT_INVALID", `${owner} contains an unpassed assertion.`);
      const successor = successorTests.find(({ title }) => assertion.fullName.includes(title));
      if (successor !== undefined) {
        if (observedSuccessors.has(successor.title))
          fail("REPORT_INVALID", `${owner} contains a duplicate successor assertion.`);
        observedSuccessors.add(successor.title);
        successorAssertionCount += 1;
      } else {
        names.push(assertion.fullName);
        observedNames.push(assertion.fullName);
        assertionCount += 1;
      }
    }
    if (names.length === 0) fail("REPORT_INVALID", `${owner} contains an empty historical suite.`);
    files.push({ path: `${packagePath}/${relative}`, tests: names.sort() });
  }
  if (
    assertionCount + successorAssertionCount !== input.numPassedTests ||
    new Set(files.map(({ path: name }) => name)).size !== files.length
  )
    fail("REPORT_INVALID", `${owner} test counts or identities drifted.`);
  const expectedFiles =
    owner === "app-behavior"
      ? M10A_T15_APP_TEST_FILES
      : owner === "core-behavior"
        ? M10A_T15_CORE_TEST_FILES
        : owner === "source-history"
          ? ["test/history.test.ts"]
          : null;
  if (expectedFiles !== null)
    equal(
      files.map(({ path: name }) => name).sort(),
      expectedFiles.map((name) => `${packagePath}/${name}`).sort(),
      `${owner} exact suites`,
    );
  if (
    owner === "app-behavior" &&
    M10A_T15_INHERITED_REUSE_TESTS.some(
      (title) => observedNames.filter((name) => name.includes(title)).length !== 1,
    )
  )
    fail("REPORT_INVALID", "A required T14 reuse case did not execute exactly once.");
  return freeze({
    owner,
    passedTests: assertionCount,
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  });
}

async function readJson(file) {
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_REPORT_BYTES)
      fail("REPORT_INVALID", "A fresh report is not a bounded regular file.");
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error instanceof M10AT15ExecutionError) throw error;
    fail("REPORT_INVALID", "A fresh report is missing, unreadable or invalid JSON.");
  }
}

async function runCommand(step, { cwd, env, signal }) {
  return new Promise((resolvePromise) => {
    let child;
    let timeout;
    let force;
    let output = Buffer.alloc(0);
    let failedToStart = false;
    let timedOut = false;
    const kill = () => {
      if (child?.pid === undefined) return;
      try {
        if (process.platform === "win32") child.kill("SIGTERM");
        else process.kill(-child.pid, "SIGTERM");
      } catch {
        /* The owned process group may have completed concurrently. */
      }
      force ??= setTimeout(() => {
        try {
          if (process.platform === "win32") child.kill("SIGKILL");
          else process.kill(-child.pid, "SIGKILL");
        } catch {
          /* Already reaped. */
        }
      }, 5_000);
      force.unref();
    };
    try {
      child = spawn(step.command, step.args, {
        cwd,
        env,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      resolvePromise({ code: null, signal: null, failedToStart: true });
      return;
    }
    const retain = (chunk) => {
      output = Buffer.concat([output, chunk]).subarray(-64 * 1024);
    };
    child.stdout.on("data", retain);
    child.stderr.on("data", retain);
    child.on("error", () => {
      failedToStart = true;
    });
    timeout = setTimeout(() => {
      timedOut = true;
      kill();
    }, 15 * 60_000);
    timeout.unref();
    signal.addEventListener("abort", kill, { once: true });
    if (signal.aborted) kill();
    child.on("close", (code, exitSignal) => {
      clearTimeout(timeout);
      clearTimeout(force);
      signal.removeEventListener("abort", kill);
      // Do not echo raw child output: local browser bundles contain ephemeral credentials.
      resolvePromise({ code, signal: exitSignal, failedToStart, timedOut, output });
    });
  });
}

/**
 * Runs every reviewed owner sequentially in fresh private report directories.
 * The injectable runner is a contract-test seam; production capture/verify never accepts it.
 */
export async function executeM10AT15Workloads(run = runCommand) {
  if (typeof run !== "function" || types.isProxy(run))
    fail("OPTIONS_INVALID", "Invalid test runner.");
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "desen-m10a-t15-proof-"));
  const abort = new AbortController();
  const onSignal = () => abort.abort();
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);
  const results = [];
  let succeeded = false;
  try {
    for (const workload of M10A_T15_WORKLOADS) {
      if (abort.signal.aborted) fail("EXECUTION_ABORTED", "T15 execution was interrupted.");
      const reportRoot = path.join(temporaryRoot, workload.id);
      await mkdir(reportRoot, { mode: 0o700 });
      const environment = { ...process.env };
      delete environment.DESEN_M10A_T03_PROOF_TEMP;
      delete environment.DESEN_M10A_T12_PROOF_TEMP;
      delete environment.DESEN_M10A_T15_PROOF_TEMP;
      const isVitest = Object.hasOwn(VITEST_WORKSPACES, workload.id);
      const reportFile = path.join(reportRoot, "vitest.json");
      const args = isVitest
        ? [...workload.args, "--reporter=json", `--outputFile=${reportFile}`]
        : [...workload.args];
      if (workload.id === "theme-browser") environment.DESEN_M10A_T03_PROOF_TEMP = reportRoot;
      if (workload.id === "style-browser") environment.DESEN_M10A_T12_PROOF_TEMP = reportRoot;
      if (workload.id === "master-browser") environment.DESEN_M10A_T15_PROOF_TEMP = reportRoot;
      const step = Object.freeze({ ...workload, args: Object.freeze(args) });
      await writeFile(
        path.join(temporaryRoot, "current-workload.json"),
        JSON.stringify({ id: workload.id }),
        { mode: 0o600 },
      );
      const result = await run(step, { cwd: ROOT, env: environment, signal: abort.signal });
      if (
        result?.code !== 0 ||
        result.signal !== null ||
        result.failedToStart === true ||
        result.timedOut === true ||
        abort.signal.aborted
      ) {
        if (Buffer.isBuffer(result?.output))
          await writeFile(path.join(reportRoot, "output.log"), result.output.subarray(-64 * 1024), {
            mode: 0o600,
            flag: "wx",
          });
        fail(
          "EXECUTION_FAILED",
          `Fresh workload ${workload.id} failed; private diagnostics: ${reportRoot}. No T15 evidence is authorized.`,
        );
      }
      let observation = null;
      if (isVitest)
        observation = parseM10AT15VitestReceipt(workload.id, await readJson(reportFile));
      if (["theme-browser", "style-browser", "master-browser"].includes(workload.id))
        observation = parseM10AT15BrowserReceipt(
          workload.id,
          await readJson(path.join(reportRoot, "browser-proof.json")),
        );
      if (workload.id === "theme-browser") {
        const graph = parseM10AT15WorkbenchGraph(
          await readJson(
            path.join(ROOT, "apps/design-system-workbench-proof/dist/workbench-graph-proof.json"),
          ),
        );
        observation = freeze({ browser: observation, graph });
      }
      results.push(freeze({ id: workload.id, result: "PASS", observation }));
    }
    succeeded = true;
    return freeze(results);
  } catch (error) {
    const failure =
      error instanceof M10AT15ExecutionError
        ? error
        : new M10AT15ExecutionError("EXECUTION_FAILED", "A fresh workload could not complete.");
    Object.defineProperty(failure, "diagnosticsDirectory", {
      value: temporaryRoot,
      enumerable: true,
    });
    throw failure;
  } finally {
    process.removeListener("SIGTERM", onSignal);
    process.removeListener("SIGINT", onSignal);
    if (succeeded) await rm(temporaryRoot, { recursive: true, force: true });
  }
}
