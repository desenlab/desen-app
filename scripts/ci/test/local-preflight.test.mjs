import test from "node:test";
import assert from "node:assert/strict";

import {
  LOCAL_PREFLIGHT_PROFILE,
  classifyLocalChangeSet,
  createLocalPreflightPlan,
} from "../local-preflight.mjs";

test("focused local preflight admits only modified package/application source files", () => {
  const result = classifyLocalChangeSet({
    changes: [
      { status: "M", path: "packages/editor-core/src/history.ts" },
      { status: "M", path: "apps/desen-app/src/application.tsx" },
    ],
  });
  assert.deepEqual(result, { mode: "FOCUSED", reason: "PACKAGE_SOURCE_ONLY" });
});

test("local preflight falls back for metadata, policy, deleted, and untracked changes", () => {
  for (const changes of [
    [{ status: "M", path: "packages/editor-core/package.json" }],
    [{ status: "M", path: "scripts/ci/run-required-affected-quality-gate.mjs" }],
    [{ status: "D", path: "packages/editor-core/src/history.ts" }],
  ]) {
    assert.deepEqual(classifyLocalChangeSet({ changes }), {
      mode: "FULL",
      reason: "UNSAFE_OR_NON_SOURCE_CHANGE",
    });
  }
  assert.deepEqual(
    classifyLocalChangeSet({
      changes: [{ status: "M", path: "packages/editor-core/src/history.ts" }],
      worktreeStatus: [{ status: "??", path: "packages/editor-core/src/new.ts" }],
    }),
    { mode: "FULL", reason: "UNTRACKED_WORKTREE" },
  );
});

test("focused plan keeps the hosted authority untouched and forces fresh Turbo tasks", () => {
  const plan = createLocalPreflightPlan({
    baseRevision: "origin/main",
    changes: [{ status: "M", path: "packages/editor-core/src/history.ts" }],
  });
  assert.equal(plan.profile, LOCAL_PREFLIGHT_PROFILE);
  assert.equal(plan.mode, "FOCUSED");
  assert.equal(plan.authoritative, undefined);
  assert.deepEqual(plan.commands[0], { command: "pnpm", args: ["format:check"] });
  assert.deepEqual(plan.commands[1].env, { TURBO_FORCE: "true" });
  assert.deepEqual(plan.commands[2], { command: "pnpm", args: ["boundaries"] });
  assert.deepEqual(plan.commands[1].args.slice(0, 7), [
    "exec",
    "turbo",
    "run",
    "lint",
    "typecheck",
    "build",
    "test",
  ]);
  assert.equal(plan.commands[1].args[7], "--filter=...[origin/main]");
  assert.equal(plan.commands[1].args[8], "--force");
});

test("fallback plan preserves the complete local compatibility audit", () => {
  const plan = createLocalPreflightPlan({
    baseRevision: "origin/main",
    changes: [{ status: "M", path: "scripts/ci/local-preflight.mjs" }],
  });
  assert.equal(plan.mode, "FULL");
  assert.deepEqual(plan.commands, [{ command: "pnpm", args: ["check"] }]);
});

test("clean worktree produces a no-op plan", () => {
  const plan = createLocalPreflightPlan({ baseRevision: "origin/main", changes: [] });
  assert.equal(plan.mode, "NO_CHANGES");
  assert.deepEqual(plan.commands, []);
});
