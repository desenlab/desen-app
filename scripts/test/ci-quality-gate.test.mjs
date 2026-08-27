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
  executeDefaultQualityGate,
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

test("the current repository exactly matches the reviewed live proof inventory", async () => {
  const result = validateProofInventory(await currentInventory());
  assert.deepEqual(result, {
    proofCount: 83,
    verifierCount: 83,
    rootTestCount: 83,
    ciContractScriptCount: 5,
    ciContractScriptSha256: "92bcdb9435a1cb6492c20e5ad82013ac7d65479a15a5f5b5321b8e59351f6014",
    legacyPrerequisiteCount: 611,
    legacyPrerequisiteSha256: "3edb7d750b1c9bee5b081e46e887c9e9e90ec1bf989aff5745fd0e4dbab492f1",
    legacyLeafInvocationCount: 4381,
    legacyLeafInvocationSha256: "a8db91b1306dcffdb52eedcb47dcf7d8fa1f60457d0b36ee5af44a0dfa743dec",
    distinctLeafWorkloadCount: 281,
    distinctLeafWorkloadSha256: "cf36b706947b4fcb4fa60759dc118c3b07faabea84a36ee1c69e10996441294e",
    testConfigurationFileCount: 0,
    workspaceTestScriptCount: 16,
    workspaceTestScriptSha256: "4d7c4232cc0e31519f2f58e9ebeb355405e493594406aee99ed2a78ce0c796ab",
    workspaceManifestSha256: "6c693fc7e2b55dfc4b2e84a9e267aef0b6aeecb3160a04cdba67ce570f860be9",
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

test("inventory validation pins promoted CI entry points and their focused contracts", async () => {
  const expectedScripts = {
    "ci:required": "node scripts/ci/run-required-affected-quality-gate.mjs",
    "test:ci-quality-gate": "node --test scripts/test/ci-quality-gate.test.mjs",
    "verify:affected-selector-promotion-evidence":
      "node scripts/ci/verify-affected-selector-promotion-evidence.mjs",
    "test:affected-selector-promotion-evidence":
      "node --test scripts/ci/test/affected-selector-promotion-evidence.test.mjs",
    "test:required-affected-quality-gate":
      "node --test scripts/ci/test/required-affected-quality-gate.test.mjs",
  };
  const inventory = await currentInventory();
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(expectedScripts).map((name) => [name, inventory.packageJson.scripts[name]]),
    ),
    expectedScripts,
  );

  for (const name of Object.keys(expectedScripts)) {
    const drifted = await currentInventory();
    drifted.packageJson = clone(drifted.packageJson);
    drifted.packageJson.scripts[name] += " --unreviewed";
    assert.throws(
      () => validateProofInventory(drifted),
      (error) =>
        error instanceof QualityGateError && /CI contract package script/u.test(error.message),
    );
  }
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

test("direct focused-package prerequisites require their exact reviewed proof and command", async () => {
  const selectorInventory = await currentInventory();
  selectorInventory.packageJson = clone(selectorInventory.packageJson);
  selectorInventory.packageJson.scripts["verify:runtime-react-reconciliation-diagnostics"] =
    selectorInventory.packageJson.scripts[
      "verify:runtime-react-reconciliation-diagnostics"
    ].replace(
      "pnpm --filter @desen/runtime-react exec vitest run",
      "pnpm --filter @desen/runtime-react... exec vitest run",
    );
  assert.throws(
    () => validateProofInventory(selectorInventory),
    (error) =>
      error instanceof QualityGateError &&
      /unreviewed direct focused-package test command/u.test(error.message),
  );

  const proofInventory = await currentInventory();
  proofInventory.packageJson = clone(proofInventory.packageJson);
  const directCommand = proofInventory.packageJson.scripts[
    "verify:runtime-react-reconciliation-diagnostics"
  ]
    .split(" && ")
    .at(-2);
  proofInventory.packageJson.scripts["verify:runtime-react-interactions"] = `${directCommand} && ${
    proofInventory.packageJson.scripts["verify:runtime-react-interactions"]
  }`;
  assert.throws(
    () => validateProofInventory(proofInventory),
    (error) =>
      error instanceof QualityGateError &&
      /unreviewed direct focused-package test command/u.test(error.message),
  );

  const scriptInventory = await currentInventory();
  scriptInventory.workspacePackages = clone(scriptInventory.workspacePackages);
  const runtimeReactManifest = scriptInventory.workspacePackages.find(
    ({ name }) => name === "@desen/runtime-react",
  );
  runtimeReactManifest.scripts["test:reconciliation-diagnostics"] =
    "vitest run test/reconciliation.test.ts";
  assert.throws(
    () => validateProofInventory(scriptInventory),
    (error) =>
      error instanceof QualityGateError &&
      /unreviewed direct focused-package test command/u.test(error.message),
  );
});

test("direct proof-verifier prerequisites require their exact reviewed proof and command", async () => {
  const commandInventory = await currentInventory();
  commandInventory.packageJson = clone(commandInventory.packageJson);
  commandInventory.packageJson.scripts["verify:desen-app-catalog-panel-layer-tree"] =
    commandInventory.packageJson.scripts["verify:desen-app-catalog-panel-layer-tree"].replace(
      "node scripts/verify-desen-app-shell-navigation.mjs",
      "node scripts/verify-protocol-snapshot.mjs",
    );
  assert.throws(
    () => validateProofInventory(commandInventory),
    (error) =>
      error instanceof QualityGateError && /unclassified legacy prerequisite/u.test(error.message),
  );

  const proofInventory = await currentInventory();
  proofInventory.packageJson = clone(proofInventory.packageJson);
  proofInventory.packageJson.scripts["verify:desen-app-shell-navigation"] =
    `node scripts/verify-reference-catalog-web-capability-artifact.mjs && ${
      proofInventory.packageJson.scripts["verify:desen-app-shell-navigation"]
    }`;
  assert.throws(
    () => validateProofInventory(proofInventory),
    (error) =>
      error instanceof QualityGateError && /unclassified legacy prerequisite/u.test(error.message),
  );
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
  assert.equal(steps.length, 176);
  assert.equal(steps.filter(({ id }) => id.startsWith("test-")).length, 83);
  assert.deepEqual(
    steps.find(({ id }) => id === "editor-core-public-package-contract"),
    {
      id: "editor-core-public-package-contract",
      label: "Editor core public-package contract",
      command: "pnpm",
      args: ["--filter", "@desen/editor-core", "test:public-package"],
    },
  );
  assert.equal(
    steps.findIndex(({ id }) => id === "editor-core-public-package-contract"),
    steps.findIndex(({ id }) => id === "package-tests") + 1,
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "editor-web-public-package-contract"),
    {
      id: "editor-web-public-package-contract",
      label: "Editor Web public-package contract",
      command: "pnpm",
      args: ["--filter", "@desen/editor-web", "test:public-package"],
    },
  );
  assert.equal(
    steps.findIndex(({ id }) => id === "editor-web-public-package-contract"),
    steps.findIndex(({ id }) => id === "editor-core-public-package-contract") + 1,
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-editor-core-continuous-validation"),
    {
      id: "verify-editor-core-continuous-validation",
      label: "Proof verifier: editor-core-continuous-validation",
      command: "node",
      args: ["scripts/verify-editor-core-continuous-validation.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-editor-core-terminal-integration"),
    {
      id: "verify-editor-core-terminal-integration",
      label: "Proof verifier: editor-core-terminal-integration",
      command: "node",
      args: ["scripts/verify-editor-core-terminal-integration.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-catalog-panel-layer-tree"),
    {
      id: "verify-desen-app-catalog-panel-layer-tree",
      label: "Proof verifier: desen-app-catalog-panel-layer-tree",
      command: "node",
      args: ["scripts/verify-desen-app-catalog-panel-layer-tree.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-catalog-panel-layer-tree"),
    {
      id: "test-desen-app-catalog-panel-layer-tree",
      label: "Root proof and mutation test: desen-app-catalog-panel-layer-tree",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-catalog-panel-layer-tree.test.mjs"],
    },
  );
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
    stepCount: 176,
    planSha256: "5ef9b46e949c9be14698a57fb5c8a520b04129269b7ca031c720ddaedb464d42",
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

test("the default quality gate always executes its own validated plan", async () => {
  const executedStepIds = [];
  const receipt = await executeDefaultQualityGate({
    readInventoryFunction: currentInventory,
    snapshotFunction: async () => ({ digest: "same", trackedFileCount: 1 }),
    steps: [{ id: "caller-injected", label: "Caller injected" }],
    runStep: async ({ id }) => {
      executedStepIds.push(id);
    },
  });

  assert.equal(receipt.status, "PASS");
  assert.deepEqual(
    executedStepIds,
    createQualityGateSteps().map(({ id }) => id),
  );
  assert.equal(executedStepIds.includes("caller-injected"), false);
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
