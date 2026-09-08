import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  M10_GATE_ARTIFACT_PATH as ARTIFACT,
  M10_GATE_BROWSER_COMMAND as BROWSER_COMMAND,
  M10_GATE_BROWSER_CONFIGS as BROWSER_CONFIGS,
  M10_GATE_PARENT_PINS as PARENTS,
  M10_GATE_ROOT_TEST_NAMES as NAMES,
  M10GateProofError,
  buildM10GateEvidence as build,
  verifyM10GateEvidence as verify,
  writeM10GateEvidence as write,
} from "../scripts/lib/m10-gate-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

function code(expected) {
  return (error) => {
    assert.ok(error instanceof M10GateProofError);
    assert.equal(error.code, `M10_GATE_${expected}`);
    return true;
  };
}

async function bytes(relativePath) {
  return readFile(path.join(ROOT, relativePath));
}

test(NAMES[0], async () => {
  const built = await build();
  assert.equal(built.artifact.gate, "G10");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.parents, PARENTS);
  assert.equal(built.artifact.claim.gateStatus, "DONE");
  assert.equal(built.artifact.claim.managedSurfaceChangesWithoutHostSourceChange, true);
  assert.equal(built.artifact.claim.visibleNoCodeAuthoringAndPublication, true);
  assert.equal(built.artifact.claim.lastKnownGoodPreservedAcrossRestart, true);
});

test(NAMES[1], async () => {
  const { artifact } = await build();
  assert.equal(artifact.authority.wiring.proofCommand, "pnpm proof");
  assert.equal(artifact.authority.wiring.exhaustiveCommand, "pnpm check");
  assert.equal(artifact.authority.wiring.browserCommand, "pnpm test:e2e");
  assert.equal(artifact.authority.wiring.packageBrowserCommand, BROWSER_COMMAND);
  assert.deepEqual(artifact.authority.wiring.browserConfigurations, BROWSER_CONFIGS);
  assert.equal(artifact.authority.wiring.browserConfigurationCount, 9);
});

test(NAMES[2], async () => {
  const { artifact } = await build();
  assert.equal(artifact.authority.hostAudit.noHandwrittenHostManagedTree, true);
  assert.equal(artifact.authority.hostAudit.publicRegistryAndRuntimeOnly, true);
  assert.equal(artifact.authority.hostAudit.dynamicEdges, 0);
  assert.equal(artifact.authority.hostAudit.unresolvedEdges, 0);
  assert.equal(artifact.authority.runtimeCore.freshComparison, true);
  assert.equal(artifact.authority.runtimeCore.tree, "3fa3613a3be63c749f40b6a0b55af5b40c675773");
});

test(NAMES[3], async () => {
  for (const parent of PARENTS) {
    const original = await bytes(parent.path);
    const changed = Buffer.from(original);
    changed[Math.floor(changed.length / 2)] ^= 1;
    await assert.rejects(
      build({ fileOverrides: new Map([[parent.path, changed]]) }),
      code("PARENT_DRIFT"),
    );
  }
});

test(NAMES[4], async () => {
  const root = JSON.parse(await bytes("package.json"));
  const mutations = [
    (value) => (value.scripts.proof = "true"),
    (value) => (value.scripts["test:e2e"] = "true"),
    (value) => (value.scripts.proof = "pnpm proof"),
    (value) => (value.scripts.test = value.scripts.test.replace(" && pnpm test:m10-gate", "")),
    (value) => (value.scripts.check = `${value.scripts.check} && pnpm verify:m10-gate`),
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(root);
    mutate(changed);
    await assert.rejects(
      build({ fileOverrides: new Map([["package.json", Buffer.from(JSON.stringify(changed))]]) }),
      code("WIRING_DRIFT"),
    );
  }
});

test(NAMES[5], async () => {
  const browserPath = "apps/desen-app-browser-e2e/package.json";
  const browser = JSON.parse(await bytes(browserPath));
  const last = " && playwright test --config repeatable-demo-playwright.config.ts";
  const mutations = [
    BROWSER_COMMAND.replace(last, ""),
    `${BROWSER_COMMAND}${last}`,
    BROWSER_COMMAND.replace(
      "playwright test --config failure-playwright.config.ts && playwright test --config success-host-playwright.config.ts",
      "playwright test --config success-host-playwright.config.ts && playwright test --config failure-playwright.config.ts",
    ),
  ];
  for (const command of mutations) {
    const changed = structuredClone(browser);
    changed.scripts["test:e2e"] = command;
    await assert.rejects(
      build({ fileOverrides: new Map([[browserPath, Buffer.from(JSON.stringify(changed))]]) }),
      code("WIRING_DRIFT"),
    );
  }
});

test(NAMES[6], async () => {
  const workflowPath = ".github/workflows/ci.yml";
  const workflow = await bytes(workflowPath);
  const changed = Buffer.from(
    workflow
      .toString("utf8")
      .replace(
        "run: pnpm --filter @desen/app-browser-e2e test:e2e",
        "run: pnpm --filter @desen/app-browser-e2e exec playwright test repeatable-demo.pw.ts",
      ),
  );
  await assert.rejects(
    build({ fileOverrides: new Map([[workflowPath, changed]]) }),
    code("WIRING_DRIFT"),
  );
});

test(NAMES[7], async () => {
  const first = await build();
  const second = await build();
  assert.deepEqual(second.artifact, first.artifact);
  assert.equal(second.artifactBytes.equals(first.artifactBytes), true);
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.parents), true);
  assert.equal(JSON.parse(first.artifactBytes).tests.rootTestNames.length, NAMES.length);
});

test(NAMES[8], async () => {
  for (const options of [null, [], new Proxy({}, {}), { unknown: true }])
    await assert.rejects(build(options), code("OPTIONS_INVALID"));
  await assert.rejects(
    build({ fileOverrides: new Map([["README.md", Buffer.from("changed")]]) }),
    code("OPTIONS_INVALID"),
  );
  await assert.rejects(
    build({ fileOverrides: new Map([["package.json", "not bytes"]]) }),
    code("OPTIONS_INVALID"),
  );
  await assert.rejects(write({ artifactPath: "relative.json" }), code("OPTIONS_INVALID"));
});

test(NAMES[9], async () => {
  const result = await verify();
  const artifact = await bytes(ARTIFACT);
  assert.equal(result.status, "PASS");
  assert.equal(result.gate, "G10");
  assert.equal(result.artifactBytes, artifact.byteLength);
  assert.equal(result.parentArtifacts, 9);
  assert.equal(result.browserConfigurations, 9);
  assert.equal(result.browserExecutedByVerifier, false);
});
