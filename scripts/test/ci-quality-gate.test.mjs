import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  CancellationError,
  PROOF_ENTRIES,
  QualityGateError,
  assertSafeStep,
  assertTrackedWorkspaceUnchanged,
  createQualityGateSteps,
  executeQualityGate,
  forwardSignal,
  runStepSequence,
  snapshotTrackedWorkspace,
  validateProofInventory,
  validateQualityGatePlan,
} from "../run-ci-quality-gate.mjs";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../..");

async function currentInventory() {
  const packageJson = JSON.parse(await readFile(resolve(WORKSPACE_ROOT, "package.json"), "utf8"));
  const workspaceManifestText = await readFile(
    resolve(WORKSPACE_ROOT, "pnpm-workspace.yaml"),
    "utf8",
  );
  const workspacePackages = [];
  const configurationPattern = /^(?:vite\.config|vitest\.config|vitest\.workspace)\.[^/]+$/u;
  const testConfigurationFiles = (await readdir(WORKSPACE_ROOT))
    .filter((file) => configurationPattern.test(file))
    .map((file) => file);
  for (const workspaceDirectory of ["apps", "packages"]) {
    const entries = await readdir(resolve(WORKSPACE_ROOT, workspaceDirectory), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const packageFiles = await readdir(resolve(WORKSPACE_ROOT, workspaceDirectory, entry.name));
      testConfigurationFiles.push(
        ...packageFiles
          .filter((file) => configurationPattern.test(file))
          .map((file) => `${workspaceDirectory}/${entry.name}/${file}`),
      );
      const manifestPath = resolve(WORKSPACE_ROOT, workspaceDirectory, entry.name, "package.json");
      try {
        workspacePackages.push(JSON.parse(await readFile(manifestPath, "utf8")));
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
    }
  }
  const verifierFiles = (await readdir(resolve(WORKSPACE_ROOT, "scripts")))
    .filter((file) => file.startsWith("verify-") && file.endsWith(".mjs"))
    .filter((file) => file !== "verify-boundary-fixtures.mjs")
    .map((file) => `scripts/${file}`);
  const rootTestFiles = (await readdir(resolve(WORKSPACE_ROOT, "tests")))
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => `tests/${file}`);
  return {
    packageJson,
    verifierFiles,
    rootTestFiles,
    workspacePackages,
    testConfigurationFiles,
    workspaceManifestText,
  };
}

function clone(value) {
  return structuredClone(value);
}

async function runProcess(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    shell: false,
    stdio: "ignore",
  });
  const [code, signal] = await once(child, "close");
  assert.equal(signal, null);
  assert.equal(code, 0);
}

test("the current repository exactly matches the frozen proof inventory", async () => {
  const result = validateProofInventory(await currentInventory());
  assert.deepEqual(result, {
    proofCount: 44,
    verifierCount: 44,
    rootTestCount: 44,
    legacyPrerequisiteCount: 265,
    legacyPrerequisiteSha256: "83ee009421857b0ae7820dbfc0414cb92890a860d8f78cfb3237d5da925e0692",
    legacyLeafInvocationCount: 1271,
    legacyLeafInvocationSha256: "e93f7220484fa7f541938961c59a5cce856ab87765187a87bd28bb851c261785",
    distinctLeafWorkloadCount: 148,
    distinctLeafWorkloadSha256: "720dcea32eb6ec1d80716e1786ff33b4f8598123d17f967822c620249a6297a4",
    testConfigurationFileCount: 0,
    workspaceTestScriptCount: 12,
    workspaceTestScriptSha256: "3ea2af6964a52fc0808675304559bf221e9ffe96953e09cd9fa2c5d3e74b5732",
    workspaceManifestSha256: "c9729b90c41f345a60acacc3a4d38826183777f57798b4f076aa4b876a3d99ba",
    workspacePackageGlobs: ["apps/*", "packages/*"],
  });
});

test("inventory validation rejects a missing verifier file", async () => {
  const inventory = await currentInventory();
  inventory.verifierFiles.pop();
  assert.throws(() => validateProofInventory(inventory), QualityGateError);
});

test("inventory validation rejects an unexpected root proof test", async () => {
  const inventory = await currentInventory();
  inventory.rootTestFiles.push("tests/unreviewed.test.mjs");
  assert.throws(() => validateProofInventory(inventory), QualityGateError);
});

test("inventory validation rejects duplicate proof ownership", async () => {
  const inventory = await currentInventory();
  const duplicateEntries = [...PROOF_ENTRIES, PROOF_ENTRIES[0]];
  assert.throws(
    () => validateProofInventory({ ...inventory, proofEntries: duplicateEntries }),
    QualityGateError,
  );
});

test("inventory validation rejects a reordered legacy proof pipeline", async () => {
  const inventory = await currentInventory();
  inventory.packageJson = clone(inventory.packageJson);
  const commands = inventory.packageJson.scripts.check.split(" && ");
  [commands[1], commands[2]] = [commands[2], commands[1]];
  inventory.packageJson.scripts.check = commands.join(" && ");
  assert.throws(() => validateProofInventory(inventory), QualityGateError);
});

test("inventory validation rejects verifier and test wiring drift", async () => {
  const verifierInventory = await currentInventory();
  verifierInventory.packageJson = clone(verifierInventory.packageJson);
  verifierInventory.packageJson.scripts["verify:protocol-snapshot"] =
    "node scripts/verify-protocol-types.mjs";
  assert.throws(() => validateProofInventory(verifierInventory), QualityGateError);

  const testInventory = await currentInventory();
  testInventory.packageJson = clone(testInventory.packageJson);
  testInventory.packageJson.scripts["test:protocol-snapshot"] =
    "node --test tests/protocol-types.test.mjs";
  assert.throws(() => validateProofInventory(testInventory), QualityGateError);
});

test("inventory validation rejects added, removed, or unclassified legacy prerequisites", async () => {
  const classifiedAddedInventory = await currentInventory();
  classifiedAddedInventory.packageJson = clone(classifiedAddedInventory.packageJson);
  classifiedAddedInventory.packageJson.scripts["verify:sc-01-dtcg-compatibility"] =
    "pnpm --filter @desen/reference-catalog-web... build && node scripts/verify-sc-01-dtcg.mjs";
  assert.throws(
    () => validateProofInventory(classifiedAddedInventory),
    (error) =>
      error instanceof QualityGateError &&
      /reviewed legacy prerequisite inventory drifted/u.test(error.message),
  );

  const commandEventRebuildInventory = await currentInventory();
  commandEventRebuildInventory.packageJson = clone(commandEventRebuildInventory.packageJson);
  commandEventRebuildInventory.packageJson.scripts["verify:runtime-core-command-event-actions"] =
    "pnpm --filter @desen/runtime-core... build && node scripts/verify-runtime-core-command-event-actions.mjs";
  assert.throws(
    () => validateProofInventory(commandEventRebuildInventory),
    (error) =>
      error instanceof QualityGateError &&
      /reviewed legacy prerequisite inventory drifted/u.test(error.message),
  );

  const reactiveRebuildInventory = await currentInventory();
  reactiveRebuildInventory.packageJson = clone(reactiveRebuildInventory.packageJson);
  reactiveRebuildInventory.packageJson.scripts["verify:runtime-core-reactive-reevaluation"] =
    "pnpm --filter @desen/runtime-core... build && node scripts/verify-runtime-core-reactive-reevaluation.mjs";
  assert.throws(
    () => validateProofInventory(reactiveRebuildInventory),
    (error) =>
      error instanceof QualityGateError &&
      /reviewed legacy prerequisite inventory drifted/u.test(error.message),
  );

  const addedInventory = await currentInventory();
  addedInventory.packageJson = clone(addedInventory.packageJson);
  addedInventory.packageJson.scripts["verify:protocol-types"] =
    "pnpm audit:future-proof && node scripts/verify-protocol-types.mjs";
  assert.throws(() => validateProofInventory(addedInventory), QualityGateError);

  const removedInventory = await currentInventory();
  removedInventory.packageJson = clone(removedInventory.packageJson);
  removedInventory.packageJson.scripts["test:protocol-diagnostics"] =
    "node --test tests/protocol-diagnostics.test.mjs";
  assert.throws(() => validateProofInventory(removedInventory), QualityGateError);
});

test("inventory validation pins the recursively expanded legacy leaf workloads", async () => {
  const distinctInventory = await currentInventory();
  distinctInventory.packageJson = clone(distinctInventory.packageJson);
  distinctInventory.packageJson.scripts["format:check"] = "prettier docs --check";
  assert.throws(
    () => validateProofInventory(distinctInventory),
    (error) =>
      error instanceof QualityGateError &&
      /distinct legacy leaf workload inventory drifted/u.test(error.message),
  );

  const orderedInventory = await currentInventory();
  orderedInventory.packageJson = clone(orderedInventory.packageJson);
  orderedInventory.packageJson.scripts.lint = orderedInventory.packageJson.scripts.lint
    .split(" && ")
    .reverse()
    .join(" && ");
  assert.throws(
    () => validateProofInventory(orderedInventory),
    (error) =>
      error instanceof QualityGateError &&
      /ordered legacy leaf invocation inventory drifted/u.test(error.message),
  );
});

test("every focused prerequisite remains a subset of the full package test", async () => {
  const inventory = await currentInventory();
  inventory.workspacePackages = clone(inventory.workspacePackages);
  const protocolManifest = inventory.workspacePackages.find(
    ({ name }) => name === "@desen/protocol",
  );
  protocolManifest.scripts.test = "vitest run test/canonicalization.test.ts";
  assert.throws(() => validateProofInventory(inventory), QualityGateError);
});

test("inventory validation rejects hidden test configuration and manifest overrides", async () => {
  const configInventory = await currentInventory();
  configInventory.testConfigurationFiles.push("packages/runtime-core/vitest.config.ts");
  assert.throws(() => validateProofInventory(configInventory), QualityGateError);

  const rootFieldInventory = await currentInventory();
  rootFieldInventory.packageJson = clone(rootFieldInventory.packageJson);
  rootFieldInventory.packageJson.vitest = { test: { exclude: ["tests/**"] } };
  assert.throws(() => validateProofInventory(rootFieldInventory), QualityGateError);

  const packageFieldInventory = await currentInventory();
  packageFieldInventory.workspacePackages = clone(packageFieldInventory.workspacePackages);
  const runtimeCoreManifest = packageFieldInventory.workspacePackages.find(
    ({ name }) => name === "@desen/runtime-core",
  );
  runtimeCoreManifest.vitest = { test: { exclude: ["test/predicate-evaluation.test.ts"] } };
  assert.throws(() => validateProofInventory(packageFieldInventory), QualityGateError);
});

test("inventory validation pins every workspace package test command", async () => {
  const inventory = await currentInventory();
  inventory.workspacePackages = clone(inventory.workspacePackages);
  const publisherManifest = inventory.workspacePackages.find(
    ({ name }) => name === "@desen/publisher",
  );
  publisherManifest.scripts.test = "echo skipped";
  assert.throws(() => validateProofInventory(inventory), QualityGateError);

  const shellInventory = await currentInventory();
  shellInventory.workspacePackages = clone(shellInventory.workspacePackages);
  const shellPublisherManifest = shellInventory.workspacePackages.find(
    ({ name }) => name === "@desen/publisher",
  );
  shellPublisherManifest.scripts.test = "vitest run || true";
  assert.throws(
    () => validateProofInventory(shellInventory),
    (error) => error instanceof QualityGateError && /unsafe shell syntax/u.test(error.message),
  );
});

test("inventory validation pins the exact pnpm workspace manifest and package globs", async () => {
  const excludedPackage = await currentInventory();
  excludedPackage.workspaceManifestText = excludedPackage.workspaceManifestText.replace(
    '  - "packages/*"\n',
    "",
  );
  assert.throws(() => validateProofInventory(excludedPackage), QualityGateError);

  const addedRoot = await currentInventory();
  addedRoot.workspaceManifestText = addedRoot.workspaceManifestText.replace(
    '  - "packages/*"\n',
    '  - "packages/*"\n  - "."\n',
  );
  assert.throws(() => validateProofInventory(addedRoot), QualityGateError);
});

test("the execution plan contains no generator, writer, shell, or changed-file shortcut", () => {
  const steps = createQualityGateSteps();
  assert.equal(steps.length, 96);
  assert.equal(steps.filter(({ id }) => id.startsWith("test-")).length, 44);
  for (const step of steps) {
    assert.doesNotThrow(() => assertSafeStep(step));
  }

  for (const args of [
    ["generate:proof"],
    ["scripts/evidence-writer.mjs"],
    ["scripts/write-proof.mjs"],
    ["write:evidence"],
    ["--affected"],
    ["tests/*.test.mjs"],
    ["safe", "&&", "unsafe"],
  ]) {
    assert.throws(() => assertSafeStep({ id: "unsafe", command: "node", args }), QualityGateError);
  }
});

test("the exact single-pass plan rejects command removal and duplicate root coverage", () => {
  const steps = createQualityGateSteps();
  assert.deepEqual(validateQualityGatePlan(steps), {
    stepCount: 96,
    planSha256: "7b8f93c11c49de2e0c195ac85b794ac54750363d146b7531807f2f22ff810f2e",
  });

  const missingTypecheck = clone(steps);
  const workspaceGraph = missingTypecheck.find(({ id }) => id === "workspace-graph");
  workspaceGraph.args = workspaceGraph.args.filter((argument) => argument !== "typecheck");
  assert.throws(() => validateQualityGatePlan(missingTypecheck), QualityGateError);

  const duplicatedRootTest = clone(steps);
  const rootTestSteps = duplicatedRootTest.filter(({ id }) => id.startsWith("test-"));
  rootTestSteps[1].args = [...rootTestSteps[0].args];
  assert.throws(() => validateQualityGatePlan(duplicatedRootTest), QualityGateError);
});

test("step execution is sequential, fail-fast, and preserves rejection", async () => {
  const calls = [];
  const steps = [
    { id: "first", label: "First" },
    { id: "failure", label: "Failure" },
    { id: "never", label: "Never" },
  ];
  const injectedFailure = new Error("injected failure");
  const timings = [];

  await assert.rejects(
    runStepSequence(
      steps,
      async ({ id }) => {
        calls.push(id);
        if (id === "failure") {
          throw injectedFailure;
        }
      },
      (timing) => timings.push(timing),
    ),
    (error) => error === injectedFailure,
  );
  assert.deepEqual(calls, ["first", "failure"]);
  assert.deepEqual(
    timings.map(({ id, status }) => ({ id, status })),
    [
      { id: "first", status: "PASS" },
      { id: "failure", status: "FAIL" },
    ],
  );
});

test("a cancellation between steps remains a failure and starts no later step", async () => {
  const calls = [];
  let receivedSignal;
  const timings = [];

  await assert.rejects(
    runStepSequence(
      [
        { id: "first", label: "First" },
        { id: "never", label: "Never" },
      ],
      async ({ id }) => {
        calls.push(id);
        receivedSignal = "SIGTERM";
      },
      (timing) => timings.push(timing),
      () => {
        if (receivedSignal) {
          throw new CancellationError(receivedSignal);
        }
      },
    ),
    CancellationError,
  );

  assert.deepEqual(calls, ["first"]);
  assert.deepEqual(
    timings.map(({ id, status }) => ({ id, status })),
    [{ id: "first", status: "FAIL" }],
  );
});

test("the quality gate rejects tracked-byte drift even after a primary failure", async () => {
  let snapshotCount = 0;
  const injectedFailure = new Error("primary failure");

  await assert.rejects(
    executeQualityGate({
      readInventoryFunction: currentInventory,
      snapshotFunction: async () => ({
        digest: snapshotCount++ === 0 ? "before" : "after",
        trackedFileCount: 1,
      }),
      steps: [{ id: "failure", label: "Failure" }],
      runStep: async () => {
        throw injectedFailure;
      },
    }),
    (error) => {
      assert.equal(error, injectedFailure);
      assert.equal(
        error.details.trackedWorkspaceError,
        "A quality-gate step changed tracked workspace bytes or modes.",
      );
      assert.equal(error.receipt.status, "FAIL");
      return true;
    },
  );
});

test("cancellation during the closing snapshot cannot return a passing receipt", async () => {
  let snapshotCount = 0;
  let receivedSignal;

  await assert.rejects(
    executeQualityGate({
      readInventoryFunction: currentInventory,
      snapshotFunction: async () => {
        snapshotCount += 1;
        if (snapshotCount === 2) {
          receivedSignal = "SIGTERM";
        }
        return { digest: "same", trackedFileCount: 1 };
      },
      steps: [],
      runStep: async () => {
        assert.fail("No command step should run.");
      },
      assertCanContinue: () => {
        if (receivedSignal) {
          throw new CancellationError(receivedSignal);
        }
      },
    }),
    (error) => {
      assert.ok(error instanceof CancellationError);
      assert.equal(error.receipt.status, "FAIL");
      assert.equal(error.receipt.timings[0].id, "frozen-inventory");
      return true;
    },
  );
});

test("tracked workspace parity compares both bytes and file count", () => {
  assert.doesNotThrow(() =>
    assertTrackedWorkspaceUnchanged(
      { digest: "same", trackedFileCount: 4 },
      { digest: "same", trackedFileCount: 4 },
    ),
  );
  assert.throws(
    () =>
      assertTrackedWorkspaceUnchanged(
        { digest: "same", trackedFileCount: 4 },
        { digest: "different", trackedFileCount: 4 },
      ),
    QualityGateError,
  );
  assert.throws(
    () =>
      assertTrackedWorkspaceUnchanged(
        { digest: "same", trackedFileCount: 4 },
        { digest: "same", trackedFileCount: 3 },
      ),
    QualityGateError,
  );
});

test("the tracked snapshot detects index-only object-id drift", async () => {
  const repositoryPath = await mkdtemp(join(tmpdir(), "desen-ci-index-"));
  try {
    await runProcess("git", ["init", "--quiet"], repositoryPath);
    const trackedPath = join(repositoryPath, "proof.txt");
    await writeFile(trackedPath, "tracked bytes\n", "utf8");
    await runProcess("git", ["add", "proof.txt"], repositoryPath);
    const before = await snapshotTrackedWorkspace(repositoryPath);

    await writeFile(trackedPath, "different staged bytes\n", "utf8");
    await runProcess("git", ["add", "proof.txt"], repositoryPath);
    await writeFile(trackedPath, "tracked bytes\n", "utf8");
    const after = await snapshotTrackedWorkspace(repositoryPath);

    assert.equal(before.trackedFileCount, 1);
    assert.equal(after.trackedFileCount, 1);
    assert.notEqual(before.digest, after.digest);
    assert.throws(() => assertTrackedWorkspaceUnchanged(before, after), QualityGateError);
  } finally {
    await rm(repositoryPath, { recursive: true, force: true });
  }
});

test("termination signals are forwarded to the active child", () => {
  const receivedSignals = [];
  const activeChild = {
    killed: false,
    kill(signal) {
      receivedSignals.push(signal);
      return true;
    },
  };

  assert.equal(forwardSignal("SIGTERM", activeChild), true);
  assert.deepEqual(receivedSignals, ["SIGTERM"]);
  assert.equal(forwardSignal("SIGINT", undefined), false);
  assert.equal(forwardSignal("SIGINT", { killed: true }), false);
});

test(
  "termination reaches a spawned child process group",
  { skip: process.platform === "win32" },
  async () => {
    const grandchildCode = "setInterval(() => {}, 1000)";
    const parentCode = [
      'const { spawn } = require("node:child_process");',
      `const child = spawn(process.execPath, ["-e", ${JSON.stringify(grandchildCode)}], { stdio: "ignore" });`,
      'process.stdout.write(String(child.pid) + "\\n");',
      "setInterval(() => {}, 1000);",
    ].join("");
    const parent = spawn(process.execPath, ["-e", parentCode], {
      detached: true,
      stdio: ["ignore", "pipe", "ignore"],
    });

    try {
      const [pidOutput] = await Promise.race([
        once(parent.stdout, "data"),
        delay(2_000).then(() => {
          throw new Error("Timed out waiting for the spawned grandchild.");
        }),
      ]);
      assert.ok(Number.parseInt(pidOutput.toString("utf8"), 10) > 0);

      const closed = once(parent, "close");
      assert.equal(forwardSignal("SIGTERM", parent), true);
      await closed;

      for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
          process.kill(-parent.pid, 0);
        } catch (error) {
          if (error?.code === "ESRCH") {
            return;
          }
          throw error;
        }
        await delay(20);
      }
      assert.fail("The child process group survived SIGTERM.");
    } finally {
      try {
        process.kill(-parent.pid, "SIGKILL");
      } catch (error) {
        if (error?.code !== "ESRCH") {
          process.stderr.write(`Process-group cleanup warning: ${String(error)}\n`);
        }
      }
    }
  },
);
