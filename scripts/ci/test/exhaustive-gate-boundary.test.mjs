import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  ExhaustiveGateBoundaryError,
  assertExhaustiveGateCleanInput,
  assertExhaustiveGateWorkspaceUnchanged,
  captureExhaustiveGateWorkspace,
  executeExhaustiveGateBoundary,
  readExhaustiveGateRepositoryInventory,
  readExhaustiveGateRevision,
} from "../exhaustive-gate-boundary.mjs";

const EXEC_FILE = promisify(execFileCallback);

async function runGit(workspaceRoot, args) {
  return await EXEC_FILE("git", args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
}

async function writeRelative(workspaceRoot, relativePath, contents, mode) {
  const absolutePath = path.join(workspaceRoot, ...relativePath.split("/"));
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
  if (mode !== undefined) await chmod(absolutePath, mode);
}

async function createRepository() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "desen-exhaustive-boundary-")));
  await runGit(root, ["init", "--quiet"]);
  await runGit(root, ["config", "user.name", "Boundary Test"]);
  await runGit(root, ["config", "user.email", "boundary@example.test"]);
  await writeRelative(
    root,
    "package.json",
    `${JSON.stringify({ name: "fixture", private: true, scripts: {} }, null, 2)}\n`,
  );
  await writeRelative(root, "pnpm-workspace.yaml", 'packages:\n  - "apps/*"\n  - "packages/*"\n');
  await writeRelative(
    root,
    "apps/example/package.json",
    `${JSON.stringify({ name: "@fixture/app", private: true }, null, 2)}\n`,
  );
  await writeRelative(
    root,
    "packages/example/package.json",
    `${JSON.stringify({ name: "@fixture/package", private: true }, null, 2)}\n`,
  );
  await writeRelative(root, "scripts/verify-alpha.mjs", "export {};\n");
  await writeRelative(root, "scripts/verify-boundary-fixtures.mjs", "export {};\n");
  await writeRelative(root, "tests/alpha.test.mjs", "export {};\n");
  await runGit(root, ["add", "--all"]);
  await runGit(root, ["commit", "--quiet", "-m", "fixture"]);
  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

function expectCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ExhaustiveGateBoundaryError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

function expectCleanInputFailure(expectedCode, expectedClean) {
  return (error) => {
    assert.ok(error instanceof ExhaustiveGateBoundaryError);
    assert.equal(error.code, expectedCode);
    assert.equal(error.details.receipt.status, "FAIL");
    assert.equal(error.details.receipt.failureCode, expectedCode);
    assert.equal(error.details.receipt.clean, expectedClean);
    assert.match(error.details.receipt.gitStatusSha256, /^[0-9a-f]{64}$/u);
    assert.equal(Object.isFrozen(error.details.receipt), true);
    return true;
  };
}

test("proves that a clean checkout is bound to the supplied revision", async () => {
  const fixture = await createRepository();
  try {
    const expectedRevision = (await runGit(fixture.root, ["rev-parse", "HEAD"])).stdout.trim();
    const receipt = await assertExhaustiveGateCleanInput(fixture.root, expectedRevision);

    assert.deepEqual(receipt, {
      schemaVersion: 1,
      profile: "desen.ci.exhaustive-gate-clean-input.v1",
      status: "PASS",
      failureCode: null,
      expectedRevision,
      revision: expectedRevision,
      revisionMatches: true,
      clean: true,
      gitStatusBytes: 0,
      gitStatusSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    });
    assert.equal(Object.isFrozen(receipt), true);
  } finally {
    await fixture.cleanup();
  }
});

test("rejects a staged clean-input change", async () => {
  const fixture = await createRepository();
  try {
    const expectedRevision = (await runGit(fixture.root, ["rev-parse", "HEAD"])).stdout.trim();
    await writeRelative(fixture.root, "scripts/verify-alpha.mjs", "export const staged = true;\n");
    await runGit(fixture.root, ["add", "--", "scripts/verify-alpha.mjs"]);

    await assert.rejects(
      assertExhaustiveGateCleanInput(fixture.root, expectedRevision),
      expectCleanInputFailure("EXHAUSTIVE_GATE_INPUT_DIRTY", false),
    );
  } finally {
    await fixture.cleanup();
  }
});

test("rejects an unstaged clean-input change", async () => {
  const fixture = await createRepository();
  try {
    const expectedRevision = (await runGit(fixture.root, ["rev-parse", "HEAD"])).stdout.trim();
    await writeRelative(
      fixture.root,
      "scripts/verify-alpha.mjs",
      "export const unstaged = true;\n",
    );

    await assert.rejects(
      assertExhaustiveGateCleanInput(fixture.root, expectedRevision),
      expectCleanInputFailure("EXHAUSTIVE_GATE_INPUT_DIRTY", false),
    );
  } finally {
    await fixture.cleanup();
  }
});

test("rejects an untracked clean-input change", async () => {
  const fixture = await createRepository();
  try {
    const expectedRevision = (await runGit(fixture.root, ["rev-parse", "HEAD"])).stdout.trim();
    await writeRelative(fixture.root, "untracked-proof.txt", "not reviewed\n");

    await assert.rejects(
      assertExhaustiveGateCleanInput(fixture.root, expectedRevision),
      expectCleanInputFailure("EXHAUSTIVE_GATE_INPUT_DIRTY", false),
    );
  } finally {
    await fixture.cleanup();
  }
});

test("rejects a clean checkout bound to a different revision", async () => {
  const fixture = await createRepository();
  try {
    await assert.rejects(assertExhaustiveGateCleanInput(fixture.root, "0".repeat(40)), (error) => {
      expectCleanInputFailure("EXHAUSTIVE_GATE_REVISION_MISMATCH", true)(error);
      assert.equal(error.details.receipt.revisionMatches, false);
      assert.equal(error.details.receipt.gitStatusBytes, 0);
      return true;
    });
  } finally {
    await fixture.cleanup();
  }
});

test("authenticates a real revision and repository inventory inside an unchanged boundary", async () => {
  const fixture = await createRepository();
  try {
    const inventory = await readExhaustiveGateRepositoryInventory(fixture.root);
    const expectedRevision = (await runGit(fixture.root, ["rev-parse", "HEAD"])).stdout.trim();
    assert.equal(
      await readExhaustiveGateRevision(fixture.root, expectedRevision),
      expectedRevision,
    );
    assert.deepEqual(inventory.verifierFiles, ["scripts/verify-alpha.mjs"]);
    assert.deepEqual(inventory.rootTestFiles, ["tests/alpha.test.mjs"]);
    assert.deepEqual(
      inventory.workspacePackages.map(({ name }) => name),
      ["@fixture/app", "@fixture/package"],
    );
    assert.equal(Object.isFrozen(inventory), true);

    let executed = 0;
    const receipt = await executeExhaustiveGateBoundary({
      workspaceRoot: fixture.root,
      expectedRevision,
      authenticateInventory(discovered) {
        assert.equal(discovered.packageJson.name, "fixture");
        return Object.freeze({ profile: "fixture.inventory.v1", status: "PASS" });
      },
      async execute(context) {
        executed += 1;
        assert.equal(context.revision, expectedRevision);
        assert.equal(context.inventory.status, "PASS");
        return Object.freeze({ status: "PASS", workloads: 1 });
      },
    });

    assert.equal(executed, 1);
    assert.equal(receipt.status, "PASS");
    assert.equal(receipt.revision, expectedRevision);
    assert.equal(receipt.execution.status, "PASS");
    assert.equal(receipt.workspaceBefore.digest, receipt.workspaceAfter.digest);
    assert.equal(receipt.workspaceBefore.indexSha256, receipt.workspaceAfter.indexSha256);
    assert.equal(receipt.workspaceBefore.worktreeSha256, receipt.workspaceAfter.worktreeSha256);
    assert.equal(receipt.trackedFileCount, 7);
    assert.ok(Object.isFrozen(receipt));
  } finally {
    await fixture.cleanup();
  }
});

test("detects tracked byte drift and the execution wrapper returns no passing receipt", async () => {
  const fixture = await createRepository();
  try {
    const before = await captureExhaustiveGateWorkspace(fixture.root);
    await writeRelative(fixture.root, "scripts/verify-alpha.mjs", "export const drift = true;\n");
    const after = await captureExhaustiveGateWorkspace(fixture.root);
    assert.notEqual(before.worktreeSha256, after.worktreeSha256);
    assert.throws(
      () => assertExhaustiveGateWorkspaceUnchanged(before, after),
      expectCode("EXHAUSTIVE_GATE_WORKSPACE_CHANGED"),
    );

    await writeRelative(fixture.root, "scripts/verify-alpha.mjs", "export {};\n");
    const primary = new Error("injected workload failure");
    await assert.rejects(
      executeExhaustiveGateBoundary({
        workspaceRoot: fixture.root,
        authenticateInventory: async () => Object.freeze({ status: "PASS" }),
        execute: async () => {
          await writeRelative(fixture.root, "tests/alpha.test.mjs", "export const changed = 1;\n");
          throw primary;
        },
      }),
      (error) => {
        assert.equal(error, primary);
        assert.equal(error.exhaustiveGateReceipt.status, "FAIL");
        assert.equal(error.exhaustiveGateWorkspaceError.code, "EXHAUSTIVE_GATE_WORKSPACE_CHANGED");
        return true;
      },
    );
  } finally {
    await fixture.cleanup();
  }
});

test(
  "detects a tracked executable-mode change",
  { skip: process.platform === "win32" },
  async () => {
    const fixture = await createRepository();
    try {
      const trackedPath = path.join(fixture.root, "scripts/verify-alpha.mjs");
      const before = await captureExhaustiveGateWorkspace(fixture.root);
      await chmod(trackedPath, 0o755);
      const after = await captureExhaustiveGateWorkspace(fixture.root);

      assert.equal(before.indexSha256, after.indexSha256);
      assert.notEqual(before.worktreeSha256, after.worktreeSha256);
      assert.throws(
        () => assertExhaustiveGateWorkspaceUnchanged(before, after),
        expectCode("EXHAUSTIVE_GATE_WORKSPACE_CHANGED"),
      );
    } finally {
      await fixture.cleanup();
    }
  },
);

test("detects index-only object-id drift while worktree bytes remain unchanged", async () => {
  const fixture = await createRepository();
  try {
    const relativePath = "scripts/verify-alpha.mjs";
    const original = await readFile(path.join(fixture.root, relativePath));
    const before = await captureExhaustiveGateWorkspace(fixture.root);
    await writeRelative(fixture.root, relativePath, "export const staged = true;\n");
    await runGit(fixture.root, ["add", "--", relativePath]);
    await writeRelative(fixture.root, relativePath, original);
    const after = await captureExhaustiveGateWorkspace(fixture.root);

    assert.notEqual(before.indexSha256, after.indexSha256);
    assert.equal(before.worktreeSha256, after.worktreeSha256);
    assert.throws(
      () => assertExhaustiveGateWorkspaceUnchanged(before, after),
      expectCode("EXHAUSTIVE_GATE_WORKSPACE_CHANGED"),
    );
  } finally {
    await fixture.cleanup();
  }
});

test("rejects a hosted revision mismatch before authenticating inventory or executing", async () => {
  const fixture = await createRepository();
  try {
    let authenticationCount = 0;
    let executionCount = 0;
    await assert.rejects(
      executeExhaustiveGateBoundary({
        workspaceRoot: fixture.root,
        expectedRevision: "0".repeat(40),
        authenticateInventory: async () => {
          authenticationCount += 1;
          return Object.freeze({ status: "PASS" });
        },
        execute: async () => {
          executionCount += 1;
        },
      }),
      expectCode("EXHAUSTIVE_GATE_REVISION_MISMATCH"),
    );
    assert.equal(authenticationCount, 0);
    assert.equal(executionCount, 0);
  } finally {
    await fixture.cleanup();
  }
});
