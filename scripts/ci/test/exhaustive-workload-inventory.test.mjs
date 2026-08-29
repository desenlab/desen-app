import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  EXPECTED_CI_CONTRACT_SCRIPT_SHA256,
  EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
  ExhaustiveWorkloadInventoryError,
  calculateExhaustiveWorkloadInventorySha256,
  createExhaustiveWorkloadInventory,
  validateExhaustiveWorkloadInventory,
  validateRepositoryWorkloadInputs,
} from "../exhaustive-workload-inventory.mjs";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..");
const COMPATIBILITY_PROJECTION_SHA256 =
  "5dbd8f1365a731846ece0e64888b69eb9607540c09dfb4444e990b8ff030d502";

function cloneInventory() {
  return structuredClone(createExhaustiveWorkloadInventory());
}

function resign(candidate) {
  candidate.inventorySha256 = calculateExhaustiveWorkloadInventorySha256(candidate);
  return candidate;
}

function assertDeepFrozen(value, visited = new Set()) {
  if (!value || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const key of Reflect.ownKeys(value)) assertDeepFrozen(value[key], visited);
}

async function currentRepositoryInputs() {
  const packageJson = JSON.parse(await readFile(resolve(WORKSPACE_ROOT, "package.json"), "utf8"));
  const workspaceManifestText = await readFile(
    resolve(WORKSPACE_ROOT, "pnpm-workspace.yaml"),
    "utf8",
  );
  const configurationPattern = /^(?:vite\.config|vitest\.config|vitest\.workspace)\.[^/]+$/u;
  const testConfigurationFiles = (await readdir(WORKSPACE_ROOT))
    .filter((file) => configurationPattern.test(file))
    .map((file) => file);
  const workspacePackages = [];
  for (const workspaceDirectory of ["apps", "packages"]) {
    const entries = await readdir(resolve(WORKSPACE_ROOT, workspaceDirectory), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const packageDirectory = resolve(WORKSPACE_ROOT, workspaceDirectory, entry.name);
      const packageFiles = await readdir(packageDirectory);
      testConfigurationFiles.push(
        ...packageFiles
          .filter((file) => configurationPattern.test(file))
          .map((file) => workspaceDirectory + "/" + entry.name + "/" + file),
      );
      try {
        workspacePackages.push(
          JSON.parse(await readFile(resolve(packageDirectory, "package.json"), "utf8")),
        );
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  }
  const verifierFiles = (await readdir(resolve(WORKSPACE_ROOT, "scripts")))
    .filter((file) => file.startsWith("verify-") && file.endsWith(".mjs"))
    .filter((file) => file !== "verify-boundary-fixtures.mjs")
    .map((file) => "scripts/" + file);
  const rootTestFiles = (await readdir(resolve(WORKSPACE_ROOT, "tests")))
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => "tests/" + file);
  return {
    packageJson,
    verifierFiles,
    rootTestFiles,
    workspacePackages,
    testConfigurationFiles,
    workspaceManifestText,
  };
}

test("the neutral inventory preserves the exact 198-workload successor projection", () => {
  const inventory = createExhaustiveWorkloadInventory();
  const projection = inventory.nodes.map(({ id, command, args }) => ({ id, command, args }));
  const projectionSha256 = createHash("sha256").update(JSON.stringify(projection)).digest("hex");

  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.profile, "desen.ci.exhaustive-workload-inventory.v1");
  assert.equal(inventory.workloadCount, 198);
  assert.equal(inventory.proofUnitCount, 94);
  assert.equal(inventory.inventorySha256, EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256);
  assert.equal(
    EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
    "d3b479cc998d6c84d53b9b0d64e6121033d94bbf9b502fcb9e7adc2487b3d908",
  );
  assert.equal(projectionSha256, COMPATIBILITY_PROJECTION_SHA256);
  assert.deepEqual(
    inventory.nodes.slice(0, 8).map(({ id }) => id),
    [
      "orchestrator-contracts",
      "format",
      "lint",
      "structural-validator-artifacts",
      "workspace-graph",
      "package-tests",
      "editor-core-public-package-contract",
      "editor-web-public-package-contract",
    ],
  );
  assert.equal(
    inventory.nodes.slice(8, 102).every(({ id }) => id.startsWith("verify-")),
    true,
  );
  assert.equal(
    inventory.nodes.slice(102, 196).every(({ id }) => id.startsWith("test-")),
    true,
  );
  assert.deepEqual(
    inventory.nodes.slice(-2).map(({ id }) => id),
    ["dependency-boundaries", "boundary-fixtures"],
  );
  assert.deepEqual(inventory.proofUnits.at(-1), {
    id: "desen-app-node-linked-diagnostics",
    verifierNodeId: "verify-desen-app-node-linked-diagnostics",
    rootTestNodeId: "test-desen-app-node-linked-diagnostics",
  });
  assert.equal(validateExhaustiveWorkloadInventory(inventory), inventory);
});

test("repository manifests and discovered proof files retain the reviewed parity receipt", async () => {
  const inputs = await currentRepositoryInputs();
  const receipt = validateRepositoryWorkloadInputs(inputs);

  assert.deepEqual(receipt, {
    proofCount: 94,
    verifierCount: 94,
    rootTestCount: 94,
    ciContractScriptCount: 5,
    ciContractScriptSha256: EXPECTED_CI_CONTRACT_SCRIPT_SHA256,
    legacyPrerequisiteCount: 721,
    legacyPrerequisiteSha256: "8f76601e8d7439b8aa43b0f2e92e1aa4be572d6883824e97f32441519389927f",
    legacyLeafInvocationCount: 4513,
    legacyLeafInvocationSha256: "1e8b4a2d5c990d879dcb8cd8cb85e1b791ac8376a2872c740e2b42757fc4c579",
    distinctLeafWorkloadCount: 314,
    distinctLeafWorkloadSha256: "d144bf2b6f4850042ab93ddf903be9fee4fde5af0b44082bcaf6b7cbe4f7a72d",
    testConfigurationFileCount: 0,
    workspaceTestScriptCount: 16,
    workspaceTestScriptSha256: "4d7c4232cc0e31519f2f58e9ebeb355405e493594406aee99ed2a78ce0c796ab",
    workspaceManifestSha256: "6c693fc7e2b55dfc4b2e84a9e267aef0b6aeecb3160a04cdba67ce570f860be9",
    workspacePackageGlobs: ["apps/*", "packages/*"],
  });
  assertDeepFrozen(receipt);
});

test("repository input drift fails closed before it can authorize a workload", async () => {
  const missingVerifier = await currentRepositoryInputs();
  missingVerifier.verifierFiles.pop();
  assert.throws(
    () => validateRepositoryWorkloadInputs(missingVerifier),
    ExhaustiveWorkloadInventoryError,
  );

  const hiddenConfiguration = await currentRepositoryInputs();
  hiddenConfiguration.testConfigurationFiles.push("packages/runtime-core/vitest.config.ts");
  assert.throws(
    () => validateRepositoryWorkloadInputs(hiddenConfiguration),
    ExhaustiveWorkloadInventoryError,
  );

  const changedWorkspace = await currentRepositoryInputs();
  changedWorkspace.workspaceManifestText = changedWorkspace.workspaceManifestText.replace(
    '  - "packages/*"\n',
    "",
  );
  assert.throws(
    () => validateRepositoryWorkloadInputs(changedWorkspace),
    ExhaustiveWorkloadInventoryError,
  );

  const changedRootCommand = await currentRepositoryInputs();
  changedRootCommand.packageJson.scripts.check =
    changedRootCommand.packageJson.scripts.check.replace("pnpm format:check", "pnpm format");
  assert.throws(
    () => validateRepositoryWorkloadInputs(changedRootCommand),
    ExhaustiveWorkloadInventoryError,
  );

  const changedCiContract = await currentRepositoryInputs();
  changedCiContract.packageJson.scripts["test:required-affected-quality-gate"] =
    "node --test scripts/ci/test/affected-selector-promotion-evidence.test.mjs";
  assert.throws(
    () => validateRepositoryWorkloadInputs(changedCiContract),
    (error) =>
      error instanceof ExhaustiveWorkloadInventoryError &&
      /CI contract package script/u.test(error.message),
  );

  const changedPackageTest = await currentRepositoryInputs();
  const publisher = changedPackageTest.workspacePackages.find(
    ({ name }) => name === "@desen/publisher",
  );
  publisher.scripts.test = "vitest run --passWithNoTests";
  assert.throws(
    () => validateRepositoryWorkloadInputs(changedPackageTest),
    ExhaustiveWorkloadInventoryError,
  );
});

test("direct proof-verifier prerequisites require their exact reviewed proof and command", async () => {
  const commandInputs = await currentRepositoryInputs();
  commandInputs.packageJson = structuredClone(commandInputs.packageJson);
  commandInputs.packageJson.scripts["verify:desen-app-catalog-panel-layer-tree"] =
    commandInputs.packageJson.scripts["verify:desen-app-catalog-panel-layer-tree"].replace(
      "node scripts/verify-desen-app-shell-navigation.mjs",
      "node scripts/verify-protocol-snapshot.mjs",
    );
  assert.throws(
    () => validateRepositoryWorkloadInputs(commandInputs),
    (error) => /unclassified prerequisite/u.test(error.message),
  );

  const proofInputs = await currentRepositoryInputs();
  proofInputs.packageJson = structuredClone(proofInputs.packageJson);
  proofInputs.packageJson.scripts["verify:desen-app-shell-navigation"] =
    `node scripts/verify-reference-catalog-web-capability-artifact.mjs && ${
      proofInputs.packageJson.scripts["verify:desen-app-shell-navigation"]
    }`;
  assert.throws(
    () => validateRepositoryWorkloadInputs(proofInputs),
    (error) => /unclassified prerequisite/u.test(error.message),
  );

  const adapterInputs = await currentRepositoryInputs();
  adapterInputs.packageJson = structuredClone(adapterInputs.packageJson);
  adapterInputs.packageJson.scripts["verify:desen-app-real-adapter-canvas"] =
    adapterInputs.packageJson.scripts["verify:desen-app-real-adapter-canvas"].replace(
      "node scripts/verify-reference-host-web-source-audit.mjs",
      "node scripts/verify-reference-catalog-web-capability-artifact.mjs",
    );
  assert.throws(
    () => validateRepositoryWorkloadInputs(adapterInputs),
    (error) => /unclassified prerequisite/u.test(error.message),
  );

  const persistenceInputs = await currentRepositoryInputs();
  persistenceInputs.packageJson = structuredClone(persistenceInputs.packageJson);
  persistenceInputs.packageJson.scripts["verify:desen-app-source-persistence"] =
    persistenceInputs.packageJson.scripts["verify:desen-app-source-persistence"].replace(
      "node scripts/verify-desen-app-fixtures-scenarios-fidelity.mjs",
      "node scripts/verify-desen-app-design-run-modes.mjs",
    );
  assert.throws(
    () => validateRepositoryWorkloadInputs(persistenceInputs),
    (error) => /unclassified prerequisite/u.test(error.message),
  );
});

test("dependencies, execution classes, and shared-state ownership are explicit", () => {
  const inventory = createExhaustiveWorkloadInventory();
  const nodeById = new Map(inventory.nodes.map((workload) => [workload.id, workload]));
  const workspaceGraph = nodeById.get("workspace-graph");
  const packageTests = nodeById.get("package-tests");
  const publicPackageContract = nodeById.get("editor-core-public-package-contract");
  const webPublicPackageContract = nodeById.get("editor-web-public-package-contract");
  const boundaries = nodeById.get("dependency-boundaries");

  assert.deepEqual(workspaceGraph.dependencies, ["structural-validator-artifacts"]);
  assert.equal(workspaceGraph.executionClass, "SERIAL_BUILD_WRITER");
  assert.deepEqual(workspaceGraph.sharedState, {
    trackedWorkspace: "READ_ONLY_GUARDED",
    buildOutputs: "SHARED_WRITE_SERIALIZED",
    temporaryPaths: "TOOL_SCOPED",
    ports: "NONE",
  });
  assert.equal(packageTests.sharedState.buildOutputs, "SHARED_READ_AFTER_PREFIX");
  assert.deepEqual(publicPackageContract, {
    id: "editor-core-public-package-contract",
    label: "Editor core public-package contract",
    command: "pnpm",
    args: ["--filter", "@desen/editor-core", "test:public-package"],
    dependencies: ["package-tests"],
    executionClass: "SERIAL_BUILD_WRITER",
    sharedState: {
      trackedWorkspace: "READ_ONLY_GUARDED",
      buildOutputs: "SHARED_WRITE_SERIALIZED",
      temporaryPaths: "TOOL_SCOPED",
      ports: "NONE",
    },
  });
  assert.deepEqual(webPublicPackageContract, {
    id: "editor-web-public-package-contract",
    label: "Editor Web public-package contract",
    command: "pnpm",
    args: ["--filter", "@desen/editor-web", "test:public-package"],
    dependencies: ["editor-core-public-package-contract"],
    executionClass: "SERIAL_BUILD_WRITER",
    sharedState: {
      trackedWorkspace: "READ_ONLY_GUARDED",
      buildOutputs: "SHARED_WRITE_SERIALIZED",
      temporaryPaths: "TOOL_SCOPED",
      ports: "NONE",
    },
  });
  assert.equal(boundaries.dependencies.length, 94);

  for (const unit of inventory.proofUnits) {
    const verifier = nodeById.get(unit.verifierNodeId);
    const rootTest = nodeById.get(unit.rootTestNodeId);
    assert.equal(verifier.executionClass, "CONCURRENT_PROOF");
    assert.equal(rootTest.executionClass, "CONCURRENT_PROOF");
    assert.deepEqual(verifier.dependencies, [
      unit.id === "editor-core-persistence"
        ? "editor-web-public-package-contract"
        : unit.id === "editor-core-source-document" ||
            unit.id === "editor-core-stable-id-insert" ||
            unit.id === "editor-core-structural-edits" ||
            unit.id === "editor-core-content-edits" ||
            unit.id === "editor-core-state-binding-edits" ||
            unit.id === "editor-core-event-action-edits" ||
            unit.id === "editor-core-authoring-round-trip" ||
            unit.id === "editor-core-continuous-validation" ||
            unit.id === "editor-core-terminal-integration"
          ? "editor-core-public-package-contract"
          : "package-tests",
    ]);
    assert.deepEqual(rootTest.dependencies, [verifier.id]);
    assert.equal(verifier.sharedState.buildOutputs, "SHARED_READ_AFTER_PREFIX");
    assert.equal(rootTest.sharedState.temporaryPaths, "PROCESS_ISOLATED");
    assert.equal(verifier.sharedState.ports, "NONE");
  }
});

test("the canonical result is deterministic and deeply frozen", () => {
  const first = createExhaustiveWorkloadInventory();
  const second = createExhaustiveWorkloadInventory();

  assert.equal(first, second);
  assert.equal(
    calculateExhaustiveWorkloadInventorySha256(first),
    EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
  );
  assertDeepFrozen(first);
  assert.throws(() => {
    first.nodes[0].args.push("unsafe");
  }, TypeError);
});

test("omission, duplication, reordering, and safe-looking substitution fail closed", () => {
  const omitted = cloneInventory();
  omitted.nodes.pop();
  omitted.workloadCount -= 1;
  resign(omitted);
  assert.throws(
    () => validateExhaustiveWorkloadInventory(omitted),
    ExhaustiveWorkloadInventoryError,
  );

  const duplicated = cloneInventory();
  duplicated.nodes[1] = structuredClone(duplicated.nodes[0]);
  assert.throws(
    () => validateExhaustiveWorkloadInventory(duplicated),
    (error) =>
      error instanceof ExhaustiveWorkloadInventoryError && /duplicates/u.test(error.message),
  );

  const reordered = cloneInventory();
  [reordered.nodes[8], reordered.nodes[9]] = [reordered.nodes[9], reordered.nodes[8]];
  resign(reordered);
  assert.throws(
    () => validateExhaustiveWorkloadInventory(reordered),
    (error) =>
      error instanceof ExhaustiveWorkloadInventoryError &&
      /omitted, reordered, or substituted/u.test(error.message),
  );

  const substituted = cloneInventory();
  substituted.nodes.at(-1).args = ["scripts/verify-another-boundary.mjs"];
  resign(substituted);
  assert.throws(
    () => validateExhaustiveWorkloadInventory(substituted),
    (error) =>
      error instanceof ExhaustiveWorkloadInventoryError &&
      /omitted, reordered, or substituted/u.test(error.message),
  );
});

test("cycles, unknown classes, and unsafe shell command vectors fail before hashing", () => {
  const cyclic = cloneInventory();
  cyclic.nodes[0].dependencies = ["boundary-fixtures"];
  assert.throws(
    () => calculateExhaustiveWorkloadInventorySha256(cyclic),
    (error) => error instanceof ExhaustiveWorkloadInventoryError && /cycle/u.test(error.message),
  );

  const unknownExecutionClass = cloneInventory();
  unknownExecutionClass.nodes[0].executionClass = "UNREVIEWED";
  assert.throws(
    () => validateExhaustiveWorkloadInventory(unknownExecutionClass),
    (error) =>
      error instanceof ExhaustiveWorkloadInventoryError &&
      /unknown classification/u.test(error.message),
  );

  const unknownSharedState = cloneInventory();
  unknownSharedState.nodes[0].sharedState.ports = "LOCALHOST";
  assert.throws(
    () => validateExhaustiveWorkloadInventory(unknownSharedState),
    (error) =>
      error instanceof ExhaustiveWorkloadInventoryError &&
      /unknown classification/u.test(error.message),
  );

  for (const args of [["safe", "&&", "unsafe"], ["evidence-writer.mjs"], ["--affected"]]) {
    const unsafe = cloneInventory();
    unsafe.nodes[0].args = args;
    assert.throws(
      () => validateExhaustiveWorkloadInventory(unsafe),
      ExhaustiveWorkloadInventoryError,
    );
  }
});

test("proof-unit drift and hostile JavaScript containers cannot expand authority", () => {
  const omittedUnit = cloneInventory();
  omittedUnit.proofUnits.pop();
  omittedUnit.proofUnitCount -= 1;
  resign(omittedUnit);
  assert.throws(
    () => validateExhaustiveWorkloadInventory(omittedUnit),
    ExhaustiveWorkloadInventoryError,
  );

  const substitutedUnit = cloneInventory();
  substitutedUnit.proofUnits[0].id = "substituted-unit";
  resign(substitutedUnit);
  assert.throws(
    () => validateExhaustiveWorkloadInventory(substitutedUnit),
    ExhaustiveWorkloadInventoryError,
  );

  let getterCalls = 0;
  const accessorNode = cloneInventory();
  Object.defineProperty(accessorNode.nodes[0], "id", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "orchestrator-contracts";
    },
  });
  assert.throws(
    () => validateExhaustiveWorkloadInventory(accessorNode),
    ExhaustiveWorkloadInventoryError,
  );
  assert.equal(getterCalls, 0);

  let proxyReads = 0;
  const proxied = new Proxy(cloneInventory(), {
    get(target, property, receiver) {
      proxyReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  assert.throws(
    () => validateExhaustiveWorkloadInventory(proxied),
    ExhaustiveWorkloadInventoryError,
  );
  assert.equal(proxyReads, 0);

  const sparse = cloneInventory();
  delete sparse.nodes[0];
  assert.throws(
    () => validateExhaustiveWorkloadInventory(sparse),
    ExhaustiveWorkloadInventoryError,
  );
});
