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
const T05_PREDECESSOR_PROJECTION_SHA256 =
  "38e2ef1bcdacbf2ef48d44217dbbd0dc85d4bad849b1372f3491ec384db233e7";

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

test("the neutral inventory preserves the exact 244-workload T05 successor projection", () => {
  const inventory = createExhaustiveWorkloadInventory();
  const projection = inventory.nodes.map(({ id, command, args }) => ({ id, command, args }));
  const projectionSha256 = createHash("sha256").update(JSON.stringify(projection)).digest("hex");

  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.profile, "desen.ci.exhaustive-workload-inventory.v1");
  assert.equal(inventory.workloadCount, 244);
  assert.equal(inventory.proofUnitCount, 115);
  assert.equal(inventory.inventorySha256, EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256);
  assert.equal(
    EXPECTED_EXHAUSTIVE_WORKLOAD_INVENTORY_SHA256,
    "f2e861cce08dca611a307762564519b7b519e302cbacf2dac9281daf73d6def1",
  );
  assert.equal(
    projectionSha256,
    "3e8b238ed081b5e2d94a3fa03302a39dea69a1c5a1f124a8121af7c210bdab9e",
  );
  assert.deepEqual(
    inventory.nodes.slice(0, 12).map(({ id }) => id),
    [
      "orchestrator-contracts",
      "format",
      "lint",
      "structural-validator-artifacts",
      "workspace-graph",
      "package-tests",
      "editor-core-public-package-contract",
      "editor-web-public-package-contract",
      "design-system-core-public-package-contract",
      "design-system-authoring-public-package-contract",
      "design-system-release-public-package-contract",
      "starter-catalog-web-public-package-contract",
    ],
  );
  assert.equal(
    inventory.nodes.slice(12, 127).every(({ id }) => id.startsWith("verify-")),
    true,
  );
  assert.equal(
    inventory.nodes.slice(127, 242).every(({ id }) => id.startsWith("test-")),
    true,
  );
  assert.deepEqual(
    inventory.nodes.slice(-2).map(({ id }) => id),
    ["dependency-boundaries", "boundary-fixtures"],
  );
  const exactTailProofIds = [
    "desen-app-failure-fixture",
    "desen-app-success-host-operation",
    "historical-archive-redaction",
    "desen-app-published-host-update",
    "desen-app-invalid-publication",
    "desen-app-last-known-good-recovery",
    "desen-app-repeatable-demo",
    "runtime-core-baseline",
    "m10-gate",
    "m10a-t01",
    "m10a-t02",
    "m10a-t03",
    "m10a-t04",
    "m10a-t05",
  ];
  assert.deepEqual(
    inventory.proofUnits.slice(-exactTailProofIds.length).map(({ id }) => id),
    exactTailProofIds,
  );
  for (const id of exactTailProofIds) {
    assert.deepEqual(
      inventory.proofUnits.find((unit) => unit.id === id),
      { id, verifierNodeId: `verify-${id}`, rootTestNodeId: `test-${id}` },
    );
  }
  const t05Predecessor = projection.filter(
    ({ id }) => id !== "starter-catalog-web-public-package-contract" && !id.endsWith("m10a-t05"),
  );
  assert.equal(t05Predecessor.length, 241);
  assert.equal(
    createHash("sha256").update(JSON.stringify(t05Predecessor)).digest("hex"),
    T05_PREDECESSOR_PROJECTION_SHA256,
  );
  const t04Predecessor = t05Predecessor.filter(
    ({ id }) => id !== "design-system-release-public-package-contract" && !id.endsWith("m10a-t04"),
  );
  assert.equal(t04Predecessor.length, 238);
  assert.equal(
    createHash("sha256").update(JSON.stringify(t04Predecessor)).digest("hex"),
    "257667fcdec26d3654d1434c392bfaf7aec7e8f2a684311912c02255fd1d3176",
  );
  const t03Predecessor = t04Predecessor.filter(
    ({ id }) =>
      id !== "design-system-authoring-public-package-contract" && !id.endsWith("m10a-t03"),
  );
  assert.equal(t03Predecessor.length, 235);
  assert.equal(
    createHash("sha256").update(JSON.stringify(t03Predecessor)).digest("hex"),
    "158033c4f6cdc36907c2c31555d26f4cd54d2103b93eddd56815cfc18e0faa85",
  );
  const t02Predecessor = t03Predecessor.filter(
    ({ id }) => id !== "design-system-core-public-package-contract" && !id.endsWith("m10a-t02"),
  );
  assert.equal(t02Predecessor.length, 232);
  assert.equal(
    createHash("sha256").update(JSON.stringify(t02Predecessor)).digest("hex"),
    "d6dc66b2c5c3845638f8be1d03fde5bfd688cec26315b223812c244c42eae772",
  );
  const m10aPredecessor = t02Predecessor.filter(({ id }) => !id.endsWith("m10a-t01"));
  assert.equal(m10aPredecessor.length, 230);
  assert.equal(
    createHash("sha256").update(JSON.stringify(m10aPredecessor)).digest("hex"),
    "f8a63dd74709c8492135785402caaed0592e6deb36b3ad0ef1ed0f592889cf7c",
  );
  const g10Predecessor = m10aPredecessor.filter(({ id }) => !id.endsWith("m10-gate"));
  assert.equal(g10Predecessor.length, 228);
  assert.equal(
    createHash("sha256").update(JSON.stringify(g10Predecessor)).digest("hex"),
    "dbc220edb2dbfd9eeb986330b96f37fbf5bc0c8c08b59633b3def3f2f0fd79d4",
  );
  const t08Predecessor = g10Predecessor.filter(({ id }) => !id.endsWith("runtime-core-baseline"));
  assert.equal(t08Predecessor.length, 226);
  assert.equal(
    createHash("sha256").update(JSON.stringify(t08Predecessor)).digest("hex"),
    "de6ff72947e06238e78e709176f3d1259fbe28238195e25dd9a0ed03355889c3",
  );
  const t07Predecessor = t08Predecessor.filter(
    ({ id }) => !id.endsWith("desen-app-repeatable-demo"),
  );
  assert.equal(t07Predecessor.length, 224);
  assert.equal(
    createHash("sha256").update(JSON.stringify(t07Predecessor)).digest("hex"),
    "5fd70071c5fcab5f4e1a86434adfa63d89fdb8eda82264b046cdc9ba7214ab61",
  );
  const t06Predecessor = t07Predecessor.filter(
    ({ id }) => !id.endsWith("desen-app-last-known-good-recovery"),
  );
  assert.equal(t06Predecessor.length, 222);
  assert.equal(
    createHash("sha256").update(JSON.stringify(t06Predecessor)).digest("hex"),
    "06071d7640b114e656d501e6794ff3ac7f607dfca5580cb69a9cbd44bc8c716e",
  );
  const predecessor = t06Predecessor.filter(
    ({ id }) => !id.endsWith("desen-app-invalid-publication"),
  );
  assert.equal(predecessor.length, 220);
  assert.equal(
    createHash("sha256").update(JSON.stringify(predecessor)).digest("hex"),
    "f88698910808b705712c06d7c35c94b9f679df5f13e9f20d7af2d01c295dfad1",
  );
  assert.equal(validateExhaustiveWorkloadInventory(inventory), inventory);
});

test("repository manifests and discovered proof files retain the reviewed parity receipt", async () => {
  const inputs = await currentRepositoryInputs();
  const receipt = validateRepositoryWorkloadInputs(inputs);

  assert.deepEqual(receipt, {
    proofCount: 115,
    verifierCount: 115,
    rootTestCount: 115,
    ciContractScriptCount: 5,
    ciContractScriptSha256: EXPECTED_CI_CONTRACT_SCRIPT_SHA256,
    legacyPrerequisiteCount: 779,
    legacyPrerequisiteSha256: "a4ce74ffe3d0cc75003ac6715f32da71e6114d5dd1fb507d913726dfd604a50d",
    legacyLeafInvocationCount: 4642,
    legacyLeafInvocationSha256: "348be3b945b9c0a755a11eb4fd6e87ab39fcdfd75fda1cce4f78a01556911049",
    distinctLeafWorkloadCount: 368,
    distinctLeafWorkloadSha256: "4a816717536a8d7daa8d2b34cc739e461f9622866002c92d16668c2b2a454bd6",
    testConfigurationFileCount: 3,
    workspaceTestScriptCount: 20,
    workspaceTestScriptSha256: "61c8e0b12ae0ad5b1cb85ad0a1832337b239305b7bf0005b6503bc3d844d5c88",
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

  const changedBrowserE2eBuild = await currentRepositoryInputs();
  changedBrowserE2eBuild.workspacePackages = structuredClone(
    changedBrowserE2eBuild.workspacePackages,
  );
  const browserE2ePackage = changedBrowserE2eBuild.workspacePackages.find(
    ({ name }) => name === "@desen/app-browser-e2e",
  );
  browserE2ePackage.scripts.build = "vite build --emptyOutDir=false";
  assert.throws(
    () => validateRepositoryWorkloadInputs(changedBrowserE2eBuild),
    (error) =>
      error instanceof ExhaustiveWorkloadInventoryError &&
      /Browser E2E workspace package script drifted/u.test(error.message),
  );

  const rootOwnedDirectProof = await currentRepositoryInputs();
  rootOwnedDirectProof.packageJson = structuredClone(rootOwnedDirectProof.packageJson);
  rootOwnedDirectProof.packageJson.scripts["verify:desen-app-empty-project-browser-e2e"] =
    "node scripts/verify-desen-app-empty-project-browser-e2e.mjs";
  assert.throws(
    () => validateRepositoryWorkloadInputs(rootOwnedDirectProof),
    (error) =>
      error instanceof ExhaustiveWorkloadInventoryError &&
      /must remain a direct CI proof pair/u.test(error.message),
  );

  const changedEditorWebPublicPackage = await currentRepositoryInputs();
  const editorWeb = changedEditorWebPublicPackage.workspacePackages.find(
    ({ name }) => name === "@desen/editor-web",
  );
  editorWeb.scripts["test:public-package"] = "node --test test/public-package.mjs";
  assert.throws(
    () => validateRepositoryWorkloadInputs(changedEditorWebPublicPackage),
    (error) =>
      error instanceof ExhaustiveWorkloadInventoryError &&
      /unreviewed public-package contract test/u.test(error.message),
  );

  const substitutedPublicPackage = await currentRepositoryInputs();
  substitutedPublicPackage.packageJson.scripts["verify:desen-app-publish-activation"] =
    substitutedPublicPackage.packageJson.scripts["verify:desen-app-publish-activation"].replace(
      "pnpm --filter @desen/editor-web test:public-package",
      "pnpm --filter @desen/editor-core test:public-package",
    );
  assert.throws(
    () => validateRepositoryWorkloadInputs(substitutedPublicPackage),
    (error) =>
      error instanceof ExhaustiveWorkloadInventoryError &&
      /unreviewed public-package contract test/u.test(error.message),
  );

  const substitutedAuthoringPublicPackage = await currentRepositoryInputs();
  substitutedAuthoringPublicPackage.packageJson.scripts["verify:m10a-t03"] =
    substitutedAuthoringPublicPackage.packageJson.scripts["verify:m10a-t03"].replace(
      "pnpm --filter @desen/design-system-authoring test:public-package",
      "pnpm --filter @desen/design-system-core test:public-package",
    );
  assert.throws(
    () => validateRepositoryWorkloadInputs(substitutedAuthoringPublicPackage),
    (error) =>
      error instanceof ExhaustiveWorkloadInventoryError &&
      /unreviewed public-package contract test/u.test(error.message),
  );

  const substitutedWorkbench = await currentRepositoryInputs();
  substitutedWorkbench.packageJson.scripts["verify:m10a-t03"] =
    substitutedWorkbench.packageJson.scripts["verify:m10a-t03"].replace(
      "pnpm --filter @desen/design-system-workbench-proof test:e2e",
      "pnpm --filter @desen/starter-catalog-web-proof test:e2e",
    );
  assert.throws(
    () => validateRepositoryWorkloadInputs(substitutedWorkbench),
    (error) =>
      error instanceof ExhaustiveWorkloadInventoryError &&
      /unreviewed browser-proof package test/u.test(error.message),
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
  const designSystemPublicPackageContract = nodeById.get(
    "design-system-core-public-package-contract",
  );
  const designSystemAuthoringPublicPackageContract = nodeById.get(
    "design-system-authoring-public-package-contract",
  );
  const designSystemReleasePublicPackageContract = nodeById.get(
    "design-system-release-public-package-contract",
  );
  const starterCatalogWebPublicPackageContract = nodeById.get(
    "starter-catalog-web-public-package-contract",
  );
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
  assert.deepEqual(designSystemPublicPackageContract, {
    id: "design-system-core-public-package-contract",
    label: "Design System Core public-package contract",
    command: "pnpm",
    args: ["--filter", "@desen/design-system-core", "test:public-package"],
    dependencies: ["editor-core-public-package-contract"],
    executionClass: "SERIAL_BUILD_WRITER",
    sharedState: {
      trackedWorkspace: "READ_ONLY_GUARDED",
      buildOutputs: "SHARED_WRITE_SERIALIZED",
      temporaryPaths: "TOOL_SCOPED",
      ports: "NONE",
    },
  });
  assert.deepEqual(designSystemAuthoringPublicPackageContract, {
    id: "design-system-authoring-public-package-contract",
    label: "Design System Authoring public-package contract",
    command: "pnpm",
    args: ["--filter", "@desen/design-system-authoring", "test:public-package"],
    dependencies: ["design-system-core-public-package-contract"],
    executionClass: "SERIAL_BUILD_WRITER",
    sharedState: {
      trackedWorkspace: "READ_ONLY_GUARDED",
      buildOutputs: "SHARED_WRITE_SERIALIZED",
      temporaryPaths: "TOOL_SCOPED",
      ports: "NONE",
    },
  });
  assert.deepEqual(designSystemReleasePublicPackageContract, {
    id: "design-system-release-public-package-contract",
    label: "Design System Release public-package contract",
    command: "pnpm",
    args: ["--filter", "@desen/design-system-release", "test:public-package"],
    dependencies: ["design-system-authoring-public-package-contract"],
    executionClass: "SERIAL_BUILD_WRITER",
    sharedState: {
      trackedWorkspace: "READ_ONLY_GUARDED",
      buildOutputs: "SHARED_WRITE_SERIALIZED",
      temporaryPaths: "TOOL_SCOPED",
      ports: "NONE",
    },
  });
  assert.deepEqual(starterCatalogWebPublicPackageContract, {
    id: "starter-catalog-web-public-package-contract",
    label: "Starter Catalog Web public-package contract",
    command: "pnpm",
    args: ["--filter", "@desen/starter-catalog-web", "test:public-package"],
    dependencies: ["design-system-release-public-package-contract"],
    executionClass: "SERIAL_BUILD_WRITER",
    sharedState: {
      trackedWorkspace: "READ_ONLY_GUARDED",
      buildOutputs: "SHARED_WRITE_SERIALIZED",
      temporaryPaths: "TOOL_SCOPED",
      ports: "NONE",
    },
  });
  assert.equal(boundaries.dependencies.length, 115);

  for (const unit of inventory.proofUnits) {
    const verifier = nodeById.get(unit.verifierNodeId);
    const rootTest = nodeById.get(unit.rootTestNodeId);
    assert.equal(verifier.executionClass, "CONCURRENT_PROOF");
    assert.equal(rootTest.executionClass, "CONCURRENT_PROOF");
    assert.deepEqual(verifier.dependencies, [
      unit.id === "m10a-t05"
        ? "starter-catalog-web-public-package-contract"
        : unit.id === "m10a-t04"
          ? "design-system-release-public-package-contract"
          : unit.id === "m10a-t03"
            ? "design-system-authoring-public-package-contract"
            : unit.id === "m10a-t02"
              ? "design-system-core-public-package-contract"
              : unit.id === "editor-core-persistence"
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
    assert.equal(
      verifier.sharedState.buildOutputs,
      [
        "desen-app-published-host-update",
        "desen-app-invalid-publication",
        "desen-app-last-known-good-recovery",
        "desen-app-repeatable-demo",
        "runtime-core-baseline",
        "m10a-t05",
      ].includes(unit.id)
        ? "NONE"
        : "SHARED_READ_AFTER_PREFIX",
    );
    assert.equal(
      rootTest.sharedState.temporaryPaths,
      unit.id === "desen-app-published-host-update" ? "NONE" : "PROCESS_ISOLATED",
    );
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
  [reordered.nodes[7], reordered.nodes[8]] = [reordered.nodes[8], reordered.nodes[7]];
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
