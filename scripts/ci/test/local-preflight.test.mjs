import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  LOCAL_PREFLIGHT_PROFILE,
  LOCAL_PREFLIGHT_REVIEWED_SCRIPT_ALLOWLIST,
  LocalPreflightError,
  classifyLocalPreflightChangeSet,
  createLocalPreflightPlan,
  executeLocalPreflightPlan,
  inspectLocalPreflight,
  parseLocalPreflightArguments,
  parseLocalPreflightRawDiff,
  parseLocalPreflightStatus,
} from "../local-preflight.mjs";

const EXEC_FILE = promisify(execFileCallback);
const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../..");
const ZERO_OID = "0".repeat(40);
const BEFORE_OID = "1".repeat(40);
const AFTER_OID = "2".repeat(40);

function rawDiffRecord({
  status = "M",
  beforeMode = "100644",
  afterMode = "100644",
  beforeObjectId = BEFORE_OID,
  afterObjectId = ZERO_OID,
  paths = ["packages/example/src/index.ts"],
} = {}) {
  return Buffer.concat([
    Buffer.from(`:${beforeMode} ${afterMode} ${beforeObjectId} ${afterObjectId} ${status}\0`),
    ...paths.map((relativePath) => Buffer.from(`${relativePath}\0`)),
  ]);
}

function ordinaryStatus(relativePath = "packages/example/src/index.ts", xy = ".M") {
  return {
    kind: "ORDINARY",
    xy,
    submodule: "N...",
    headMode: "100644",
    indexMode: "100644",
    worktreeMode: "100644",
    headObjectId: BEFORE_OID,
    indexObjectId: BEFORE_OID,
    path: relativePath,
  };
}

function modifiedChange(overrides = {}) {
  return {
    status: "M",
    path: "packages/example/src/index.ts",
    sourcePath: null,
    beforeMode: "100644",
    afterMode: "100644",
    beforeObjectId: BEFORE_OID,
    afterObjectId: ZERO_OID,
    ...overrides,
  };
}

function expectFallback(reason) {
  return (error) => error?.name === "LocalPreflightFallback" && error.reason === reason;
}

async function git(workspaceRoot, args) {
  const { stdout } = await EXEC_FILE("git", args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout.trim();
}

async function createRepository({ scripts = true, manifest = true, scriptOverrides = {} } = {}) {
  const temporaryRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-preflight-")));
  const sourcePath = path.join(temporaryRoot, "packages/example/src/index.ts");
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, "export const value = 1;\n");
  if (manifest) {
    const scriptMap = scripts
      ? {
          build: "tsc -p tsconfig.build.json",
          typecheck: "tsc -p tsconfig.json --noEmit",
          lint: "eslint src test --max-warnings=0",
          test: "vitest run",
          ...scriptOverrides,
        }
      : {
          build: "tsc -p tsconfig.build.json",
          typecheck: "tsc -p tsconfig.json --noEmit",
          lint: "eslint src test --max-warnings=0",
        };
    await writeFile(
      path.join(temporaryRoot, "packages/example/package.json"),
      `${JSON.stringify({ name: "@desen/example", private: true, scripts: scriptMap }, null, 2)}\n`,
    );
  }
  await git(temporaryRoot, ["init", "-q"]);
  await git(temporaryRoot, ["config", "user.email", "preflight@example.invalid"]);
  await git(temporaryRoot, ["config", "user.name", "Preflight Test"]);
  await git(temporaryRoot, ["add", "."]);
  await git(temporaryRoot, ["commit", "-qm", "baseline"]);
  const baseline = await git(temporaryRoot, ["rev-parse", "HEAD"]);
  return { temporaryRoot, sourcePath, baseline };
}

async function removeRepository(temporaryRoot) {
  await rm(temporaryRoot, { recursive: true, force: true });
}

test("raw diff parsing accepts a worktree zero after-OID and preserves byte-safe identity", () => {
  const [change] = parseLocalPreflightRawDiff(rawDiffRecord(), 40);
  assert.deepEqual(change, modifiedChange());
  assert.equal(Object.isFrozen(change), true);
});

test("raw diff parsing handles rename arity but rejects malformed and invalid UTF-8 records", () => {
  assert.deepEqual(
    parseLocalPreflightRawDiff(
      rawDiffRecord({
        status: "R100",
        paths: ["packages/example/src/a.ts", "packages/example/src/b.ts"],
      }),
      40,
    )[0],
    {
      status: "R100",
      path: "packages/example/src/b.ts",
      sourcePath: "packages/example/src/a.ts",
      beforeMode: "100644",
      afterMode: "100644",
      beforeObjectId: BEFORE_OID,
      afterObjectId: ZERO_OID,
    },
  );
  assert.throws(
    () => parseLocalPreflightRawDiff(Buffer.from("not-nul-terminated"), 40),
    expectFallback("DIFF_MALFORMED"),
  );
  const invalidUtf8 = Buffer.concat([
    Buffer.from(`:100644 100644 ${BEFORE_OID} ${ZERO_OID} M\0`),
    Buffer.from([0xff, 0]),
  ]);
  assert.throws(
    () => parseLocalPreflightRawDiff(invalidUtf8, 40),
    expectFallback("DIFF_MALFORMED"),
  );
  const bomPath = Buffer.concat([
    Buffer.from(`:100644 100644 ${BEFORE_OID} ${ZERO_OID} M\0`),
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from("packages/example/src/index.ts\0"),
  ]);
  assert.throws(() => parseLocalPreflightRawDiff(bomPath, 40), expectFallback("DIFF_MALFORMED"));
});

test("porcelain-v2 parsing is strict for ordinary, rename, untracked, and invalid records", () => {
  const ordinary = Buffer.from(
    `1 .M N... 100644 100644 100644 ${BEFORE_OID} ${BEFORE_OID} packages/example/src/index.ts\0`,
  );
  assert.deepEqual(parseLocalPreflightStatus(ordinary), [ordinaryStatus()]);
  const renamed = Buffer.from(
    `2 R. N... 100644 100644 100644 ${BEFORE_OID} ${AFTER_OID} R100 packages/example/src/b.ts\0packages/example/src/a.ts\0`,
  );
  assert.deepEqual(parseLocalPreflightStatus(renamed), [
    {
      kind: "RENAMED_OR_COPIED",
      path: "packages/example/src/b.ts",
      sourcePath: "packages/example/src/a.ts",
    },
  ]);
  assert.deepEqual(parseLocalPreflightStatus(Buffer.from("? scratch.txt\0")), [
    { kind: "UNTRACKED", path: "scratch.txt" },
  ]);
  assert.throws(
    () => parseLocalPreflightStatus(Buffer.from([0x3f, 0x20, 0xff, 0])),
    expectFallback("STATUS_MALFORMED"),
  );
  for (const malformed of [
    `1 .M N... 100600 100644 100644 ${BEFORE_OID} ${BEFORE_OID} packages/example/src/index.ts\0`,
    `1 .M N... 100644 100644 100644 abc ${BEFORE_OID} packages/example/src/index.ts\0`,
    `1 .M N... 100644 100644 100644 ${"1".repeat(64)} ${BEFORE_OID} packages/example/src/index.ts\0`,
  ]) {
    assert.throws(
      () => parseLocalPreflightStatus(Buffer.from(malformed)),
      expectFallback("STATUS_MALFORMED"),
    );
  }
});

test("focused eligibility admits only tracked same-mode regular source modifications", () => {
  assert.deepEqual(classifyLocalPreflightChangeSet([modifiedChange()], [ordinaryStatus()]), {
    mode: "FOCUSED",
    reason: "TRACKED_SOURCE_ONLY",
  });
  for (const status of ["A", "D", "M100", "R100", "C100", "T", "U", "X", "B"]) {
    assert.deepEqual(
      classifyLocalPreflightChangeSet([modifiedChange({ status })], []),
      { mode: "EXHAUSTIVE", reason: "UNSUPPORTED_CHANGE" },
      status,
    );
  }
  for (const change of [
    modifiedChange({ afterMode: "100755" }),
    modifiedChange({ beforeMode: "120000", afterMode: "120000" }),
    modifiedChange({ beforeMode: "160000", afterMode: "160000" }),
  ]) {
    assert.deepEqual(classifyLocalPreflightChangeSet([change], []), {
      mode: "EXHAUSTIVE",
      reason: "UNSUPPORTED_CHANGE",
    });
  }
  assert.deepEqual(
    classifyLocalPreflightChangeSet(
      [modifiedChange({ path: "scripts/ci/local-preflight.mjs" })],
      [],
    ),
    { mode: "EXHAUSTIVE", reason: "NON_SOURCE_CHANGE" },
  );
  assert.deepEqual(
    classifyLocalPreflightChangeSet(
      [modifiedChange()],
      [{ kind: "UNTRACKED", path: "packages/example/src/new.ts" }],
    ),
    { mode: "EXHAUSTIVE", reason: "UNTRACKED_WORKTREE" },
  );
});

test("focused eligibility rejects nested configuration while retaining ordinary source JSON", () => {
  for (const relativePath of [
    "packages/example/src/package.json",
    "packages/example/src/tsconfig.app.json",
    "packages/example/src/jsconfig.test.json",
    "packages/example/src/vite.config.ts",
    "packages/example/test/playwright.config.mjs",
    "packages/example/dev/turbo.json",
    "packages/example/src/pnpm-lock.yaml",
    "packages/example/src/example.code-workspace",
    "packages/example/src/.gitignore",
    "packages/example/src/.eslintrc.cjs",
    "packages/example/src/.env.local",
  ]) {
    assert.deepEqual(
      classifyLocalPreflightChangeSet(
        [modifiedChange({ path: relativePath })],
        [ordinaryStatus(relativePath)],
      ),
      { mode: "EXHAUSTIVE", reason: "SOURCE_CONFIGURATION_CHANGE" },
      relativePath,
    );
  }
  const dataPath = "packages/example/src/schema.json";
  assert.deepEqual(
    classifyLocalPreflightChangeSet(
      [modifiedChange({ path: dataPath })],
      [ordinaryStatus(dataPath)],
    ),
    { mode: "FOCUSED", reason: "TRACKED_SOURCE_ONLY" },
  );
});

test("raw and status record budgets fail closed before classification", () => {
  const rawOverBudget = Buffer.concat(
    Array.from({ length: 2_049 }, (_, index) =>
      rawDiffRecord({ paths: [`packages/example/src/file-${index}.ts`] }),
    ),
  );
  assert.throws(
    () => parseLocalPreflightRawDiff(rawOverBudget, 40),
    expectFallback("DIFF_OVER_BUDGET"),
  );
  const statusOverBudget = Buffer.concat(
    Array.from({ length: 4_097 }, (_, index) => Buffer.from(`? scratch-${index}.txt\0`)),
  );
  assert.throws(
    () => parseLocalPreflightStatus(statusOverBudget),
    expectFallback("STATUS_OVER_BUDGET"),
  );
});

test("the focused plan is deterministic, non-authoritative, and uses exact sequential commands", () => {
  const plan = createLocalPreflightPlan({
    mode: "FOCUSED",
    reason: "TRACKED_SOURCE_ONLY",
    baseRevision: BEFORE_OID,
    headRevision: AFTER_OID,
    mergeBaseRevision: "3".repeat(40),
    changedPaths: ["packages/z/src/z.ts", "packages/a/test/a.test.ts"],
    workspaceFilters: ["...@desen/z", "...@desen/a"],
  });
  assert.equal(plan.profile, LOCAL_PREFLIGHT_PROFILE);
  assert.equal(plan.authority, "NONE");
  assert.equal(plan.authoritative, false);
  assert.deepEqual(plan.changedPaths, ["packages/a/test/a.test.ts", "packages/z/src/z.ts"]);
  assert.deepEqual(plan.workspaceFilters, ["...@desen/a", "...@desen/z"]);
  assert.deepEqual(
    plan.commands.map(({ id }) => id),
    [
      "format",
      "workspace-build-typecheck",
      "workspace-lint-test",
      "boundaries",
      "proof-reader-checkpoints",
    ],
  );
  assert.deepEqual(plan.commands[1], {
    id: "workspace-build-typecheck",
    command: "pnpm",
    args: [
      "exec",
      "turbo",
      "run",
      "build",
      "typecheck",
      "--filter=...@desen/a",
      "--filter=...@desen/z",
      "--force",
      "--ui=stream",
    ],
    environment: { TURBO_FORCE: "true" },
  });
  assert.deepEqual(plan.commands[2].args.slice(-3), ["--only", "--force", "--ui=stream"]);
  assert.deepEqual(plan.commands[3].environment, {
    NODE_OPTIONS: "--max-old-space-size=4096",
  });
  assert.equal(
    JSON.stringify(plan),
    JSON.stringify(
      createLocalPreflightPlan({
        mode: "FOCUSED",
        reason: "TRACKED_SOURCE_ONLY",
        baseRevision: BEFORE_OID,
        headRevision: AFTER_OID,
        mergeBaseRevision: "3".repeat(40),
        changedPaths: ["packages/z/src/z.ts", "packages/a/test/a.test.ts"],
        workspaceFilters: ["...@desen/z", "...@desen/a"],
      }),
    ),
  );
});

test("exhaustive and clean plans retain explicit no-authority semantics", () => {
  const exhaustive = createLocalPreflightPlan({
    mode: "EXHAUSTIVE",
    reason: "NON_SOURCE_CHANGE",
    baseRevision: BEFORE_OID,
    headRevision: AFTER_OID,
    mergeBaseRevision: BEFORE_OID,
  });
  assert.deepEqual(exhaustive.commands, [
    {
      id: "exhaustive-check",
      command: "pnpm",
      args: ["check"],
      environment: { NODE_OPTIONS: "--max-old-space-size=4096" },
    },
  ]);
  const clean = createLocalPreflightPlan({
    mode: "NO_CHANGES",
    reason: "CLEAN",
    baseRevision: BEFORE_OID,
    headRevision: BEFORE_OID,
    mergeBaseRevision: BEFORE_OID,
  });
  assert.deepEqual(clean.commands, []);
  assert.equal(clean.authority, "NONE");
  assert.equal(clean.authoritative, false);
});

test("argument parsing rejects ambiguous or unknown CLI input", () => {
  assert.deepEqual(parseLocalPreflightArguments(["--base", "main", "--dry-run"]), {
    base: "main",
    dryRun: true,
    help: false,
  });
  assert.throws(
    () => parseLocalPreflightArguments(["--base"]),
    (error) => error instanceof LocalPreflightError && error.code === "ARGUMENT_INVALID",
  );
  assert.throws(
    () => parseLocalPreflightArguments(["--base", "main", "--base", "other"]),
    (error) => error instanceof LocalPreflightError && error.code === "ARGUMENT_INVALID",
  );
  assert.throws(
    () => parseLocalPreflightArguments(["--unknown"]),
    (error) => error instanceof LocalPreflightError && error.code === "ARGUMENT_INVALID",
  );
});

test("the reviewed script allowlist exactly matches current workspace command values", async () => {
  const manifestPaths = (
    await git(WORKSPACE_ROOT, ["ls-files", "apps/*/package.json", "packages/*/package.json"])
  )
    .split("\n")
    .filter(Boolean)
    .sort();
  const manifests = await Promise.all(
    manifestPaths.map(async (manifestPath) =>
      JSON.parse(await readFile(path.join(WORKSPACE_ROOT, manifestPath), "utf8")),
    ),
  );
  const actual = Object.fromEntries(
    Object.keys(LOCAL_PREFLIGHT_REVIEWED_SCRIPT_ALLOWLIST).map((scriptName) => [
      scriptName,
      [
        ...new Set(
          manifests
            .map((manifest) => manifest.scripts?.[scriptName])
            .filter((command) => typeof command === "string"),
        ),
      ].sort(),
    ]),
  );
  assert.deepEqual(actual, LOCAL_PREFLIGHT_REVIEWED_SCRIPT_ALLOWLIST);
});

test("real inspection focuses an unchanged reviewed manifest and fingerprints changed bytes", async () => {
  const repository = await createRepository();
  try {
    await writeFile(repository.sourcePath, "export const value = 2;\n");
    const inspection = await inspectLocalPreflight({
      workspaceRoot: repository.temporaryRoot,
      base: repository.baseline,
    });
    assert.equal(inspection.plan.mode, "FOCUSED");
    assert.equal(inspection.plan.baseRevision, repository.baseline);
    assert.equal(inspection.plan.mergeBaseRevision, repository.baseline);
    assert.deepEqual(inspection.plan.workspaceFilters, ["...@desen/example"]);
    assert.deepEqual(inspection.plan.changedPaths, ["packages/example/src/index.ts"]);
    assert.equal(inspection.fingerprint.trackedReceipts.length, 1);
    assert.equal(inspection.fingerprint.trackedReceipts[0].nlink, 1);
    assert.match(inspection.fingerprint.trackedReceipts[0].sha256, /^[0-9a-f]{64}$/u);
  } finally {
    await removeRepository(repository.temporaryRoot);
  }
});

test("inspection honors file modes even when repository config disables core.fileMode", async () => {
  const repository = await createRepository();
  try {
    await git(repository.temporaryRoot, ["config", "core.fileMode", "false"]);
    await chmod(repository.sourcePath, 0o755);
    const inspection = await inspectLocalPreflight({
      workspaceRoot: repository.temporaryRoot,
      base: repository.baseline,
    });
    assert.equal(inspection.plan.mode, "EXHAUSTIVE");
    assert.equal(inspection.plan.reason, "UNSUPPORTED_WORKTREE_STATUS");
  } finally {
    await removeRepository(repository.temporaryRoot);
  }
});

test("untracked, missing-script, and changed-manifest workspaces fall back exhaustively", async () => {
  const untracked = await createRepository();
  const missingScript = await createRepository({ scripts: false });
  const changedManifest = await createRepository();
  try {
    await writeFile(path.join(untracked.temporaryRoot, "scratch.txt"), "scratch\n");
    assert.equal(
      (
        await inspectLocalPreflight({
          workspaceRoot: untracked.temporaryRoot,
          base: untracked.baseline,
        })
      ).plan.reason,
      "UNTRACKED_WORKTREE",
    );

    await writeFile(missingScript.sourcePath, "export const value = 2;\n");
    assert.equal(
      (
        await inspectLocalPreflight({
          workspaceRoot: missingScript.temporaryRoot,
          base: missingScript.baseline,
        })
      ).plan.reason,
      "WORKSPACE_MANIFEST_INVALID",
    );

    await writeFile(changedManifest.sourcePath, "export const value = 2;\n");
    const manifestPath = path.join(changedManifest.temporaryRoot, "packages/example/package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.description = "changed";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const changedManifestInspection = await inspectLocalPreflight({
      workspaceRoot: changedManifest.temporaryRoot,
      base: changedManifest.baseline,
    });
    assert.equal(changedManifestInspection.plan.mode, "EXHAUSTIVE");
    assert.equal(changedManifestInspection.plan.reason, "NON_SOURCE_CHANGE");
  } finally {
    await Promise.all(
      [untracked, missingScript, changedManifest].map(({ temporaryRoot }) =>
        removeRepository(temporaryRoot),
      ),
    );
  }
});

test("ignored untracked eligible sources force exhaustive planning and runtime drift", async () => {
  for (const timing of ["planning", "execution"]) {
    const repository = await createRepository();
    try {
      await writeFile(repository.sourcePath, "export const value = 2;\n");
      const excludePath = path.join(repository.temporaryRoot, ".git/info/exclude");
      const hiddenPath = path.join(repository.temporaryRoot, "packages/example/src/hidden.ts");
      if (timing === "planning") {
        const hiddenRelativePaths = [
          ".editorconfig",
          ".npmrc",
          ".pnpmfile.cjs",
          ".prettierignore",
          ".prettierrc.json",
          "packages/example/.npmrc",
          "packages/example/local-note.txt",
          "packages/example/src/hidden.ts",
          "packages/example/vite.config.ts",
          "scripts/hidden-root.mjs",
          "vitest.workspace.ts",
        ];
        await writeFile(excludePath, `${hiddenRelativePaths.join("\n")}\n`);
        for (const relativePath of hiddenRelativePaths) {
          const absolutePath = path.join(repository.temporaryRoot, relativePath);
          await mkdir(path.dirname(absolutePath), { recursive: true });
          await writeFile(absolutePath, `ignored ${relativePath}\n`);
        }
        const inspection = await inspectLocalPreflight({
          workspaceRoot: repository.temporaryRoot,
          base: repository.baseline,
        });
        assert.equal(inspection.plan.mode, "EXHAUSTIVE");
        assert.equal(inspection.plan.reason, "HIDDEN_UNTRACKED_SOURCE");
        assert.deepEqual(
          inspection.fingerprint.hiddenEligibleUntrackedReceipts.map(
            ({ path: relativePath }) => relativePath,
          ),
          hiddenRelativePaths,
        );
      } else {
        const inspection = await inspectLocalPreflight({
          workspaceRoot: repository.temporaryRoot,
          base: repository.baseline,
        });
        assert.equal(inspection.plan.mode, "FOCUSED");
        await assert.rejects(
          executeLocalPreflightPlan({
            plan: inspection.plan,
            workspaceRoot: inspection.workspaceRoot,
            initialFingerprint: inspection.fingerprint,
            runCommand: async () => {
              await writeFile(excludePath, "packages/example/src/hidden.ts\n");
              await writeFile(hiddenPath, "export const hidden = true;\n");
            },
          }),
          (error) => error instanceof LocalPreflightError && error.code === "WORKSPACE_INPUT_DRIFT",
        );
      }
    } finally {
      await removeRepository(repository.temporaryRoot);
    }
  }
});

test("ignored nested scripts fail closed while generated and local runtime outputs stay excluded", async () => {
  const hiddenScript = await createRepository({
    scriptOverrides: { build: "node scripts/hidden.mjs" },
  });
  const generatedOutput = await createRepository();
  try {
    await writeFile(hiddenScript.sourcePath, 'export { nested } from "./dist/transitive.js";\n');
    await writeFile(
      path.join(hiddenScript.temporaryRoot, ".git/info/exclude"),
      "packages/example/scripts/hidden.mjs\npackages/example/src/dist/transitive.ts\n",
    );
    const hiddenScriptPath = path.join(
      hiddenScript.temporaryRoot,
      "packages/example/scripts/hidden.mjs",
    );
    await mkdir(path.dirname(hiddenScriptPath), { recursive: true });
    await writeFile(hiddenScriptPath, "export default true;\n");
    const transitivePath = path.join(
      hiddenScript.temporaryRoot,
      "packages/example/src/dist/transitive.ts",
    );
    await mkdir(path.dirname(transitivePath), { recursive: true });
    await writeFile(transitivePath, "export const nested = true;\n");
    const hiddenInspection = await inspectLocalPreflight({
      workspaceRoot: hiddenScript.temporaryRoot,
      base: hiddenScript.baseline,
    });
    assert.equal(hiddenInspection.plan.mode, "EXHAUSTIVE");
    assert.equal(hiddenInspection.plan.reason, "HIDDEN_UNTRACKED_SOURCE");
    assert.deepEqual(
      hiddenInspection.fingerprint.hiddenEligibleUntrackedReceipts.map(
        ({ path: relativePath }) => relativePath,
      ),
      ["packages/example/scripts/hidden.mjs", "packages/example/src/dist/transitive.ts"],
    );

    await writeFile(generatedOutput.sourcePath, "export const value = 2;\n");
    await writeFile(
      path.join(generatedOutput.temporaryRoot, ".git/info/exclude"),
      ".desen/\npackages/example/dist/\n",
    );
    const generatedOutputPath = path.join(
      generatedOutput.temporaryRoot,
      "packages/example/dist/output.js",
    );
    await mkdir(path.dirname(generatedOutputPath), { recursive: true });
    await writeFile(generatedOutputPath, "generated\n");
    const localRuntimePath = path.join(
      generatedOutput.temporaryRoot,
      ".desen/profile/runtime.sqlite3",
    );
    await mkdir(path.dirname(localRuntimePath), { recursive: true });
    await writeFile(localRuntimePath, "runtime state\n");
    const generatedOutputInspection = await inspectLocalPreflight({
      workspaceRoot: generatedOutput.temporaryRoot,
      base: generatedOutput.baseline,
    });
    assert.equal(generatedOutputInspection.plan.mode, "FOCUSED");
    assert.deepEqual(generatedOutputInspection.fingerprint.hiddenEligibleUntrackedReceipts, []);
  } finally {
    await Promise.all(
      [hiddenScript, generatedOutput].map(({ temporaryRoot }) => removeRepository(temporaryRoot)),
    );
  }
});

test("the reviewed script allowlist rejects unknown and glob-obfuscated commands", async () => {
  for (const scriptOverrides of [{ build: "custom-build" }, { test: "node ./d?st/hidden.mjs" }]) {
    const repository = await createRepository({ scriptOverrides });
    try {
      await writeFile(repository.sourcePath, "export const value = 2;\n");
      const inspection = await inspectLocalPreflight({
        workspaceRoot: repository.temporaryRoot,
        base: repository.baseline,
      });
      assert.equal(inspection.plan.mode, "EXHAUSTIVE");
      assert.equal(inspection.plan.reason, "WORKSPACE_SCRIPT_UNSAFE");
    } finally {
      await removeRepository(repository.temporaryRoot);
    }
  }
});

test("same-workspace source edits deduplicate one immutable package filter", async () => {
  const repository = await createRepository();
  try {
    const secondSource = path.join(repository.temporaryRoot, "packages/example/test/index.test.ts");
    await mkdir(path.dirname(secondSource), { recursive: true });
    await writeFile(secondSource, "export const expected = 1;\n");
    await git(repository.temporaryRoot, ["add", "."]);
    await git(repository.temporaryRoot, ["commit", "-qm", "add test source"]);
    const base = await git(repository.temporaryRoot, ["rev-parse", "HEAD"]);
    await writeFile(repository.sourcePath, "export const value = 2;\n");
    await writeFile(secondSource, "export const expected = 2;\n");
    const inspection = await inspectLocalPreflight({
      workspaceRoot: repository.temporaryRoot,
      base,
    });
    assert.equal(inspection.plan.mode, "FOCUSED");
    assert.deepEqual(inspection.plan.workspaceFilters, ["...@desen/example"]);
  } finally {
    await removeRepository(repository.temporaryRoot);
  }
});

test("tracked hard links, hidden index entries, and sparse checkout cannot enter focused mode", async () => {
  for (const scenario of ["hardlink", "assume-unchanged", "skip-worktree", "sparse-checkout"]) {
    const repository = await createRepository();
    try {
      if (scenario === "hardlink") {
        await link(
          repository.sourcePath,
          path.join(repository.temporaryRoot, ".git/source-hardlink"),
        );
        await writeFile(repository.sourcePath, "export const value = 2;\n");
      } else if (scenario === "assume-unchanged") {
        await git(repository.temporaryRoot, [
          "update-index",
          "--assume-unchanged",
          "packages/example/src/index.ts",
        ]);
        await writeFile(repository.sourcePath, "export const value = 2;\n");
      } else if (scenario === "skip-worktree") {
        await git(repository.temporaryRoot, [
          "update-index",
          "--skip-worktree",
          "packages/example/src/index.ts",
        ]);
        await writeFile(repository.sourcePath, "export const value = 2;\n");
      } else {
        await git(repository.temporaryRoot, ["config", "core.sparseCheckout", "true"]);
        await writeFile(repository.sourcePath, "export const value = 2;\n");
      }
      const inspection = await inspectLocalPreflight({
        workspaceRoot: repository.temporaryRoot,
        base: repository.baseline,
      });
      assert.equal(inspection.plan.mode, "EXHAUSTIVE", scenario);
      assert.ok(
        ["TRACKED_INPUT_UNSAFE", "INDEX_VISIBILITY_UNSAFE", "SPARSE_CHECKOUT"].includes(
          inspection.plan.reason,
        ),
        `${scenario}: ${inspection.plan.reason}`,
      );
    } finally {
      await removeRepository(repository.temporaryRoot);
    }
  }
});

test("index visibility changes during execution cannot conceal a manifest rewrite", async () => {
  const repository = await createRepository();
  try {
    await writeFile(repository.sourcePath, "export const value = 2;\n");
    const inspection = await inspectLocalPreflight({
      workspaceRoot: repository.temporaryRoot,
      base: repository.baseline,
    });
    assert.equal(inspection.plan.mode, "FOCUSED");
    const manifestRelativePath = "packages/example/package.json";
    const manifestPath = path.join(repository.temporaryRoot, manifestRelativePath);
    await assert.rejects(
      executeLocalPreflightPlan({
        plan: inspection.plan,
        workspaceRoot: inspection.workspaceRoot,
        initialFingerprint: inspection.fingerprint,
        runCommand: async () => {
          await git(repository.temporaryRoot, [
            "update-index",
            "--assume-unchanged",
            manifestRelativePath,
          ]);
          const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
          manifest.scripts.test = "false";
          await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        },
      }),
      (error) => error instanceof LocalPreflightError && error.code === "WORKSPACE_INPUT_DRIFT",
    );
  } finally {
    await removeRepository(repository.temporaryRoot);
  }
});

test("oversized untracked regular input is refused instead of metadata-only fingerprinting", async () => {
  const repository = await createRepository();
  try {
    await writeFile(
      path.join(repository.temporaryRoot, "oversized.bin"),
      Buffer.alloc(32 * 1024 * 1024 + 1),
    );
    await assert.rejects(
      inspectLocalPreflight({
        workspaceRoot: repository.temporaryRoot,
        base: repository.baseline,
      }),
      expectFallback("UNTRACKED_INPUT_UNSAFE"),
    );
  } finally {
    await removeRepository(repository.temporaryRoot);
  }
});

test("a unique merge base permits diverged history without leaking a mutable ref into the plan", async () => {
  const repository = await createRepository();
  try {
    await git(repository.temporaryRoot, ["checkout", "-qb", "feature"]);
    await writeFile(repository.sourcePath, "export const value = 2;\n");
    await git(repository.temporaryRoot, ["add", "."]);
    await git(repository.temporaryRoot, ["commit", "-qm", "feature source"]);
    await git(repository.temporaryRoot, ["checkout", "-qb", "base-side", repository.baseline]);
    await writeFile(path.join(repository.temporaryRoot, "README.md"), "base side\n");
    await git(repository.temporaryRoot, ["add", "."]);
    await git(repository.temporaryRoot, ["commit", "-qm", "base side"]);
    const resolvedBase = await git(repository.temporaryRoot, ["rev-parse", "HEAD"]);
    await git(repository.temporaryRoot, ["checkout", "-q", "feature"]);
    const inspection = await inspectLocalPreflight({
      workspaceRoot: repository.temporaryRoot,
      base: "base-side",
    });
    assert.equal(inspection.plan.mode, "FOCUSED");
    assert.equal(inspection.plan.baseRevision, resolvedBase);
    assert.equal(inspection.plan.mergeBaseRevision, repository.baseline);
    assert.doesNotMatch(JSON.stringify(inspection.plan), /base-side/u);
  } finally {
    await removeRepository(repository.temporaryRoot);
  }
});

test("base uncertainty falls back to the exact full compatibility command", async () => {
  const repository = await createRepository();
  try {
    await writeFile(repository.sourcePath, "export const value = 2;\n");
    const inspection = await inspectLocalPreflight({
      workspaceRoot: repository.temporaryRoot,
      base: "refs/heads/does-not-exist",
    });
    assert.equal(inspection.plan.mode, "EXHAUSTIVE");
    assert.equal(inspection.plan.reason, "BASE_UNAVAILABLE");
    assert.equal(inspection.plan.baseRevision, null);
    assert.equal(inspection.plan.mergeBaseRevision, null);
    assert.deepEqual(inspection.plan.commands[0], {
      id: "exhaustive-check",
      command: "pnpm",
      args: ["check"],
      environment: { NODE_OPTIONS: "--max-old-space-size=4096" },
    });
  } finally {
    await removeRepository(repository.temporaryRoot);
  }
});

test("execution aborts when changed bytes or same-byte file identity drift", async () => {
  for (const replacement of ["changed-bytes", "same-bytes-new-inode"]) {
    const repository = await createRepository();
    try {
      await writeFile(repository.sourcePath, "export const value = 2;\n");
      const inspection = await inspectLocalPreflight({
        workspaceRoot: repository.temporaryRoot,
        base: repository.baseline,
      });
      await assert.rejects(
        executeLocalPreflightPlan({
          plan: inspection.plan,
          workspaceRoot: inspection.workspaceRoot,
          initialFingerprint: inspection.fingerprint,
          runCommand: async () => {
            if (replacement === "changed-bytes") {
              await writeFile(repository.sourcePath, "export const value = 3;\n");
            } else {
              const bytes = await readFile(repository.sourcePath);
              const replacementPath = `${repository.sourcePath}.replacement`;
              await writeFile(replacementPath, bytes);
              await rename(replacementPath, repository.sourcePath);
            }
          },
        }),
        (error) => error instanceof LocalPreflightError && error.code === "WORKSPACE_INPUT_DRIFT",
      );
    } finally {
      await removeRepository(repository.temporaryRoot);
    }
  }
});

test("execution is fail-fast and never starts a later command", async () => {
  const plan = createLocalPreflightPlan({
    mode: "FOCUSED",
    reason: "TRACKED_SOURCE_ONLY",
    baseRevision: BEFORE_OID,
    headRevision: AFTER_OID,
    mergeBaseRevision: BEFORE_OID,
    changedPaths: ["packages/example/src/index.ts"],
    workspaceFilters: ["...@desen/example"],
  });
  const calls = [];
  const fingerprint = { digest: "stable", trackedReceipts: [] };
  await assert.rejects(
    executeLocalPreflightPlan({
      plan,
      workspaceRoot: "/unused",
      initialFingerprint: fingerprint,
      captureFingerprint: async () => fingerprint,
      runCommand: async (step) => {
        calls.push(step.id);
        throw new LocalPreflightError("COMMAND_FAILED", "expected");
      },
    }),
    (error) => error instanceof LocalPreflightError && error.code === "COMMAND_FAILED",
  );
  assert.deepEqual(calls, ["format"]);
});

test("a failing command still receives a closing drift fence and preserves both failures", async () => {
  const plan = createLocalPreflightPlan({
    mode: "EXHAUSTIVE",
    reason: "NON_SOURCE_CHANGE",
    baseRevision: BEFORE_OID,
    headRevision: AFTER_OID,
    mergeBaseRevision: BEFORE_OID,
  });
  const stable = { digest: "stable", trackedReceipts: [] };
  const drifted = { digest: "drifted", trackedReceipts: [] };
  let captures = 0;
  await assert.rejects(
    executeLocalPreflightPlan({
      plan,
      workspaceRoot: "/unused",
      initialFingerprint: stable,
      captureFingerprint: async () => {
        captures += 1;
        return captures === 1 ? stable : drifted;
      },
      runCommand: async () => {
        throw new LocalPreflightError("COMMAND_FAILED", "primary failure");
      },
    }),
    (error) =>
      error instanceof LocalPreflightError &&
      error.code === "WORKSPACE_INPUT_DRIFT" &&
      error.details.commandFailureCode === "COMMAND_FAILED",
  );
  assert.equal(captures, 2);
});

test("cancellation during an opening or closing fingerprint starts no later work and cannot pass", async () => {
  for (const timing of ["opening", "closing"]) {
    const processObject = new EventEmitter();
    const plan = createLocalPreflightPlan({
      mode: "EXHAUSTIVE",
      reason: "NON_SOURCE_CHANGE",
      baseRevision: BEFORE_OID,
      headRevision: AFTER_OID,
      mergeBaseRevision: BEFORE_OID,
    });
    const stable = { digest: "stable", trackedReceipts: [] };
    let captures = 0;
    let commandCalls = 0;
    await assert.rejects(
      executeLocalPreflightPlan({
        plan,
        workspaceRoot: "/unused",
        initialFingerprint: stable,
        processObject,
        forwardSignal: () => true,
        captureFingerprint: async () => {
          captures += 1;
          if (
            (timing === "opening" && captures === 1) ||
            (timing === "closing" && captures === 2)
          ) {
            processObject.emit("SIGINT");
          }
          return stable;
        },
        runCommand: async () => {
          commandCalls += 1;
        },
      }),
      (error) =>
        error instanceof LocalPreflightError &&
        error.code === "CANCELLED" &&
        error.details.exitCode === 130,
    );
    assert.equal(commandCalls, timing === "opening" ? 0 : 1);
  }
});

test("SIGINT and SIGTERM promptly interrupt a hanging opening or closing fingerprint", async () => {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    for (const timing of ["opening", "closing"]) {
      const processObject = new EventEmitter();
      const plan = createLocalPreflightPlan({
        mode: "EXHAUSTIVE",
        reason: "NON_SOURCE_CHANGE",
        baseRevision: BEFORE_OID,
        headRevision: AFTER_OID,
        mergeBaseRevision: BEFORE_OID,
      });
      const stable = { digest: "stable", trackedReceipts: [] };
      let captures = 0;
      let commandCalls = 0;
      let timeout;
      const execution = executeLocalPreflightPlan({
        plan,
        workspaceRoot: "/unused",
        initialFingerprint: stable,
        processObject,
        forwardSignal: () => true,
        captureFingerprint: () => {
          captures += 1;
          if (
            (timing === "opening" && captures === 1) ||
            (timing === "closing" && captures === 2)
          ) {
            queueMicrotask(() => processObject.emit(signal));
            return new Promise(() => undefined);
          }
          return Promise.resolve(stable);
        },
        runCommand: async () => {
          commandCalls += 1;
        },
      });
      try {
        await assert.rejects(
          Promise.race([
            execution,
            new Promise((_, reject) => {
              timeout = setTimeout(
                () => reject(new Error("hanging fingerprint cancellation timed out")),
                1_000,
              );
            }),
          ]),
          (error) =>
            error instanceof LocalPreflightError &&
            error.code === "CANCELLED" &&
            error.details.exitCode === (signal === "SIGINT" ? 130 : 143),
          `${signal} during ${timing}`,
        );
      } finally {
        clearTimeout(timeout);
      }
      assert.equal(commandCalls, timing === "opening" ? 0 : 1);
      assert.equal(processObject.listenerCount("SIGINT"), 0);
      assert.equal(processObject.listenerCount("SIGTERM"), 0);
    }
  }
});

test("a child close caused by the received signal surfaces cancellation after closing drift check", async () => {
  const processObject = new EventEmitter();
  const plan = createLocalPreflightPlan({
    mode: "EXHAUSTIVE",
    reason: "NON_SOURCE_CHANGE",
    baseRevision: BEFORE_OID,
    headRevision: AFTER_OID,
    mergeBaseRevision: BEFORE_OID,
  });
  const stable = { digest: "stable", trackedReceipts: [] };
  let captures = 0;
  await assert.rejects(
    executeLocalPreflightPlan({
      plan,
      workspaceRoot: "/unused",
      initialFingerprint: stable,
      processObject,
      forwardSignal: () => true,
      captureFingerprint: async () => {
        captures += 1;
        return stable;
      },
      runCommand: async () => {
        processObject.emit("SIGTERM");
        throw new LocalPreflightError("COMMAND_FAILED", "child closed by SIGTERM");
      },
    }),
    (error) =>
      error instanceof LocalPreflightError &&
      error.code === "CANCELLED" &&
      error.details.exitCode === 143,
  );
  assert.equal(captures, 2);
});

test("SIGTERM reaches the active process group, a second signal escalates, and execution stops", async () => {
  const processObject = new EventEmitter();
  const forwarded = [];
  const plan = createLocalPreflightPlan({
    mode: "EXHAUSTIVE",
    reason: "NON_SOURCE_CHANGE",
    baseRevision: BEFORE_OID,
    headRevision: AFTER_OID,
    mergeBaseRevision: BEFORE_OID,
  });
  const fingerprint = { digest: "stable", trackedReceipts: [] };
  await assert.rejects(
    executeLocalPreflightPlan({
      plan,
      workspaceRoot: "/unused",
      initialFingerprint: fingerprint,
      captureFingerprint: async () => fingerprint,
      processObject,
      forwardSignal: (signal, child) => {
        forwarded.push([signal, child]);
        return true;
      },
      runCommand: async (_step, _workspaceRoot, signalState) => {
        signalState.activeChild = { pid: 123, killed: false };
        processObject.emit("SIGTERM");
        processObject.emit("SIGTERM");
      },
    }),
    (error) =>
      error instanceof LocalPreflightError &&
      error.code === "CANCELLED" &&
      error.details.exitCode === 143,
  );
  assert.deepEqual(
    forwarded.map(([signal]) => signal),
    ["SIGTERM", "SIGKILL"],
  );
  assert.equal(processObject.listenerCount("SIGINT"), 0);
  assert.equal(processObject.listenerCount("SIGTERM"), 0);
});
