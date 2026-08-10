import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  AFFECTED_CHANGE_BOUNDARY_LIMITS,
  captureAffectedChangeBoundary,
  createAffectedChangeBoundaryTestSeams,
  validateAffectedChangeBoundaryReceipt,
} from "../affected-change-boundary.mjs";

const EXEC_FILE = promisify(execFileCallback);
const BASE = "a".repeat(40);
const HEAD = "b".repeat(40);
const EXECUTION = "c".repeat(40);
const MERGE_BASE = "d".repeat(40);
const BEFORE_OBJECT = "1".repeat(40);
const AFTER_OBJECT = "2".repeat(40);
const TRACKED_OBJECT = "3".repeat(40);
const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../..");

function result(stdout = "", status = 0, stderr = "") {
  return {
    status,
    stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout),
    stderr: Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr),
  };
}

function rawChange({
  beforeMode = "100644",
  afterMode = beforeMode,
  beforeObject = BEFORE_OBJECT,
  afterObject = AFTER_OBJECT,
  status = "M",
  path: relativePath = "packages/example/src/index.ts",
  trailingNul = true,
} = {}) {
  const bytes = Buffer.concat([
    Buffer.from(
      `:${beforeMode} ${afterMode} ${beforeObject} ${afterObject} ${status}\0${relativePath}`,
    ),
    trailingNul ? Buffer.from([0]) : Buffer.alloc(0),
  ]);
  return bytes;
}

function trackedTree(paths = ["packages/example/src/index.ts"]) {
  return Buffer.concat(
    paths.map((relativePath) => Buffer.from(`100644 blob ${TRACKED_OBJECT}\t${relativePath}\0`)),
  );
}

function happyGitSeam({
  diff = rawChange(),
  shallow = "false\n",
  currentHeads = [EXECUTION, EXECUTION],
  parents = [`${EXECUTION} ${BASE} ${HEAD}\n`, `${EXECUTION} ${BASE} ${HEAD}\n`],
  mergeBases = [`${MERGE_BASE}\n`, `${MERGE_BASE}\n`],
  statuses = [Buffer.alloc(0), Buffer.alloc(0)],
  trackedTrees = [trackedTree(), trackedTree()],
  commandOverride,
} = {}) {
  let headIndex = 0;
  let parentIndex = 0;
  let mergeBaseIndex = 0;
  let statusIndex = 0;
  let trackedTreeIndex = 0;
  const calls = [];
  const runGit = async (_workspaceRoot, args) => {
    calls.push(args);
    const overridden = await commandOverride?.(args);
    if (overridden !== undefined) return overridden;
    if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository") {
      return result(shallow);
    }
    if (args[0] === "cat-file") return result("commit\n");
    if (args[0] === "rev-parse" && args[1] === "--verify") {
      return result(`${currentHeads[Math.min(headIndex++, currentHeads.length - 1)]}\n`);
    }
    if (args[0] === "rev-list") {
      return result(parents[Math.min(parentIndex++, parents.length - 1)]);
    }
    if (args[0] === "merge-base" && args[1] === "--all") {
      return result(mergeBases[Math.min(mergeBaseIndex++, mergeBases.length - 1)]);
    }
    if (args[0] === "merge-base" && args[1] === "--is-ancestor") return result("");
    if (args[0] === "status") {
      return result(statuses[Math.min(statusIndex++, statuses.length - 1)]);
    }
    if (args[0] === "ls-tree") {
      return result(trackedTrees[Math.min(trackedTreeIndex++, trackedTrees.length - 1)]);
    }
    if (args[0] === "diff-tree") return result(diff);
    throw new Error(`Unexpected Git command: ${args.join(" ")}`);
  };
  return { calls, seams: createAffectedChangeBoundaryTestSeams(runGit) };
}

async function captureWithSeam(seams, overrides = {}) {
  return await captureAffectedChangeBoundary({
    workspaceRoot: WORKSPACE_ROOT,
    baseRevision: BASE,
    headRevision: HEAD,
    executionRevision: EXECUTION,
    sameRepository: true,
    testSeams: seams,
    ...overrides,
  });
}

function assertExhaustive(receipt, reason) {
  assert.equal(receipt.selection, "EXHAUSTIVE");
  assert.equal(receipt.reason, reason);
  assert.equal(receipt.changeCount, 0);
  assert.equal(receipt.changeSetSha256, null);
  assert.deepEqual(receipt.changes, []);
  assert.equal(receipt.baseRevision, null);
  assert.equal(receipt.headRevision, null);
  assert.equal(receipt.executionRevision, null);
  assert.equal(receipt.mergeBaseRevision, null);
  assert.equal(receipt.trackedPathCount, 0);
  assert.equal(receipt.trackedPathSetSha256, null);
  assert.deepEqual(receipt.trackedPaths, []);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.changes), true);
}

function assertDeepFrozen(value, visited = new Set()) {
  if (value === null || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const key of Reflect.ownKeys(value)) assertDeepFrozen(value[key], visited);
}

async function git(workspaceRoot, args) {
  return await EXEC_FILE("git", args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
}

test("authenticates a real two-parent merge and returns one inert regular modification", async (context) => {
  const workspaceRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "desen-affected-change-boundary-")),
  );
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  await git(workspaceRoot, ["init", "--quiet", "--initial-branch=main"]);
  await git(workspaceRoot, ["config", "user.name", "Affected Boundary Test"]);
  await git(workspaceRoot, ["config", "user.email", "affected-boundary@example.test"]);
  await mkdir(path.join(workspaceRoot, "packages/example/src"), { recursive: true });
  const trackedPath = path.join(workspaceRoot, "packages/example/src/index.ts");
  await writeFile(trackedPath, "export const value = 1;\n");
  await git(workspaceRoot, ["add", "--all"]);
  await git(workspaceRoot, ["commit", "--quiet", "-m", "base"]);
  const baseRevision = (await git(workspaceRoot, ["rev-parse", "HEAD"])).stdout.trim();
  await git(workspaceRoot, ["switch", "--quiet", "-c", "feature"]);
  await writeFile(trackedPath, "export const value = 2;\n");
  await git(workspaceRoot, ["add", "--all"]);
  await git(workspaceRoot, ["commit", "--quiet", "-m", "head"]);
  const headRevision = (await git(workspaceRoot, ["rev-parse", "HEAD"])).stdout.trim();
  await git(workspaceRoot, ["switch", "--quiet", "main"]);
  await git(workspaceRoot, ["merge", "--quiet", "--no-ff", "feature", "-m", "merge"]);
  const executionRevision = (await git(workspaceRoot, ["rev-parse", "HEAD"])).stdout.trim();

  const receipt = await captureAffectedChangeBoundary({
    workspaceRoot,
    baseRevision,
    headRevision,
    executionRevision,
    sameRepository: true,
  });

  assert.equal(receipt.selection, "AFFECTED");
  assert.equal(receipt.authority, "SHADOW");
  assert.equal(receipt.reason, "ELIGIBLE_REGULAR_MODIFICATIONS");
  assert.equal(receipt.baseRevision, baseRevision);
  assert.equal(receipt.headRevision, headRevision);
  assert.equal(receipt.executionRevision, executionRevision);
  assert.equal(receipt.mergeBaseRevision, baseRevision);
  assert.equal(receipt.changeCount, 1);
  assert.equal(receipt.trackedPathCount, 1);
  assert.deepEqual(receipt.trackedPaths, ["packages/example/src/index.ts"]);
  assert.match(receipt.trackedPathSetSha256, /^[0-9a-f]{64}$/u);
  assert.equal(receipt.changes[0].path, "packages/example/src/index.ts");
  assert.equal(receipt.changes[0].status, "M");
  assert.equal(receipt.changes[0].mode, "100644");
  assert.match(receipt.changeSetSha256, /^[0-9a-f]{64}$/u);
  assertDeepFrozen(receipt);
});

test("uses only frozen argument vectors and produces a deterministic canonical change set", async () => {
  const firstChange = rawChange({ path: "packages/zeta/src/z.ts" });
  const secondChange = rawChange({
    path: "packages/alpha/src/a.ts",
    beforeObject: "3".repeat(40),
    afterObject: "4".repeat(40),
    beforeMode: "100755",
  });
  const first = happyGitSeam({ diff: Buffer.concat([firstChange, secondChange]) });
  const receipt = await captureWithSeam(first.seams);
  const second = happyGitSeam({ diff: Buffer.concat([secondChange, firstChange]) });
  const reorderedReceipt = await captureWithSeam(second.seams);

  assert.equal(receipt.selection, "AFFECTED");
  assert.equal(receipt.changeCount, 2);
  assert.deepEqual(
    receipt.changes.map(({ path: relativePath }) => relativePath),
    ["packages/alpha/src/a.ts", "packages/zeta/src/z.ts"],
  );
  assert.equal(receipt.changeSetSha256, reorderedReceipt.changeSetSha256);
  assert.equal(
    first.calls.every((args) => Object.isFrozen(args)),
    true,
  );
  assert.equal(
    first.calls.some((args) => args[0] === "diff-tree"),
    true,
  );
  assert.equal(
    first.calls.some((args) => args.includes("--no-renames")),
    true,
  );
});

test("only exact boundary-minted receipt objects carry change authority", async () => {
  const { seams } = happyGitSeam();
  const receipt = await captureWithSeam(seams);

  assert.equal(validateAffectedChangeBoundaryReceipt(receipt), receipt);
  assert.throws(
    () => validateAffectedChangeBoundaryReceipt(structuredClone(receipt)),
    /not minted by the boundary authority/u,
  );
  assert.throws(
    () => validateAffectedChangeBoundaryReceipt({ ...receipt }),
    /not minted by the boundary authority/u,
  );
  assert.throws(() => {
    receipt.reason = "CALLER_MUTATION";
  }, TypeError);
  assert.equal(receipt.reason, "ELIGIBLE_REGULAR_MODIFICATIONS");
});

test("same-repository trust is mandatory and no Git observation occurs for a fork", async () => {
  let calls = 0;
  const seams = createAffectedChangeBoundaryTestSeams(async () => {
    calls += 1;
    return result();
  });
  const receipt = await captureAffectedChangeBoundary({
    workspaceRoot: WORKSPACE_ROOT,
    baseRevision: BASE,
    headRevision: HEAD,
    executionRevision: EXECUTION,
    sameRepository: false,
    testSeams: seams,
  });
  assertExhaustive(receipt, "UNTRUSTED_REPOSITORY");
  assert.equal(calls, 0);
});

test("invalid, accessor-backed, proxy, and unauthenticated seam inputs fail closed", async () => {
  assertExhaustive(await captureAffectedChangeBoundary(undefined), "INPUT_INVALID");
  assertExhaustive(
    await captureAffectedChangeBoundary({
      get baseRevision() {
        return BASE;
      },
    }),
    "INPUT_INVALID",
  );
  assertExhaustive(
    await captureAffectedChangeBoundary(
      new Proxy(
        {},
        {
          get() {
            throw new Error("must not execute");
          },
        },
      ),
    ),
    "INPUT_INVALID",
  );
  assertExhaustive(
    await captureAffectedChangeBoundary({
      workspaceRoot: WORKSPACE_ROOT,
      baseRevision: BASE,
      headRevision: HEAD,
      executionRevision: EXECUTION,
      sameRepository: true,
      testSeams: Object.freeze({ runGit: async () => result() }),
    }),
    "INPUT_INVALID",
  );
});

test("shallow, unavailable, mismatched, and ambiguously based revisions fail closed", async () => {
  const cases = [
    {
      reason: "REPOSITORY_SHALLOW",
      options: { shallow: "true\n" },
    },
    {
      reason: "REVISION_UNAVAILABLE",
      options: {
        commandOverride: (args) => (args[0] === "cat-file" ? result("blob\n") : undefined),
      },
    },
    {
      reason: "EXECUTION_REVISION_MISMATCH",
      options: { currentHeads: ["e".repeat(40)] },
    },
    {
      reason: "EXECUTION_PARENT_MISMATCH",
      options: { parents: [`${EXECUTION} ${BASE}\n`] },
    },
    {
      reason: "EXECUTION_PARENT_MISMATCH",
      options: { parents: [`${EXECUTION} ${HEAD} ${BASE}\n`] },
    },
    {
      reason: "MERGE_BASE_AMBIGUOUS",
      options: { mergeBases: [`${MERGE_BASE}\n${"e".repeat(40)}\n`] },
    },
    {
      reason: "ANCESTRY_UNTRUSTED",
      options: {
        commandOverride: (args) =>
          args[0] === "merge-base" && args[1] === "--is-ancestor" ? result("", 1) : undefined,
      },
    },
  ];
  for (const { reason, options } of cases) {
    const { seams } = happyGitSeam(options);
    assertExhaustive(await captureWithSeam(seams), reason);
  }
});

test("dirty opening, dirty closing, moved HEAD, parent drift, and merge-base drift expose no paths", async () => {
  const cases = [
    {
      reason: "WORKSPACE_DIRTY",
      options: { statuses: [Buffer.from("1 .M N... dirty\0")] },
    },
    {
      reason: "WORKSPACE_DIRTY",
      options: { statuses: [Buffer.alloc(0), Buffer.from("? untracked\0")] },
    },
    {
      reason: "INPUT_CHANGED_DURING_CAPTURE",
      options: { currentHeads: [EXECUTION, "e".repeat(40)] },
    },
    {
      reason: "INPUT_CHANGED_DURING_CAPTURE",
      options: {
        parents: [`${EXECUTION} ${BASE} ${HEAD}\n`, `${EXECUTION} ${BASE} ${"e".repeat(40)}\n`],
      },
    },
    {
      reason: "INPUT_CHANGED_DURING_CAPTURE",
      options: { mergeBases: [`${MERGE_BASE}\n`, `${"e".repeat(40)}\n`] },
    },
  ];
  for (const { reason, options } of cases) {
    const { seams } = happyGitSeam(options);
    assertExhaustive(await captureWithSeam(seams), reason);
  }
});

test("every unsupported change kind and unsafe file mode expands to exhaustive", async () => {
  const unsupportedKinds = ["A", "D", "R100", "C100", "T", "U", "X", "B", "M100"];
  for (const status of unsupportedKinds) {
    const { seams } = happyGitSeam({ diff: rawChange({ status }) });
    assertExhaustive(await captureWithSeam(seams), "UNSUPPORTED_CHANGE_KIND");
  }

  for (const [beforeMode, afterMode] of [
    ["100644", "100755"],
    ["120000", "120000"],
    ["160000", "160000"],
    ["040000", "040000"],
  ]) {
    const { seams } = happyGitSeam({ diff: rawChange({ beforeMode, afterMode }) });
    assertExhaustive(await captureWithSeam(seams), "UNSUPPORTED_FILE_MODE");
  }
});

test("malformed, invalid-UTF8, traversal, backslash, control, and non-normal paths fail closed", async () => {
  const invalidUtf8 = Buffer.concat([
    Buffer.from(`:100644 100644 ${BEFORE_OBJECT} ${AFTER_OBJECT} M\0`),
    Buffer.from([0xc3, 0x28, 0]),
  ]);
  const cases = [
    { reason: "DIFF_MALFORMED", diff: rawChange({ trailingNul: false }) },
    { reason: "DIFF_MALFORMED", diff: Buffer.from("not-a-header\0path\0") },
    { reason: "PATH_UNSAFE", diff: invalidUtf8 },
    { reason: "PATH_UNSAFE", diff: rawChange({ path: "../outside.ts" }) },
    { reason: "PATH_UNSAFE", diff: rawChange({ path: "/absolute.ts" }) },
    { reason: "PATH_UNSAFE", diff: rawChange({ path: "packages\\unsafe.ts" }) },
    { reason: "PATH_UNSAFE", diff: rawChange({ path: "packages/a/../unsafe.ts" }) },
    { reason: "PATH_UNSAFE", diff: rawChange({ path: "packages/new\nline.ts" }) },
    { reason: "PATH_UNSAFE", diff: rawChange({ path: "packages/e\u0301.ts" }) },
  ];
  for (const { reason, diff } of cases) {
    const { seams } = happyGitSeam({ diff });
    assertExhaustive(await captureWithSeam(seams), reason);
  }
});

test("duplicate and compatibility-normalized path collisions fail closed", async () => {
  const duplicate = Buffer.concat([rawChange(), rawChange()]);
  const { seams: duplicateSeams } = happyGitSeam({ diff: duplicate });
  assertExhaustive(await captureWithSeam(duplicateSeams), "PATH_COLLISION");

  const compatibilityCollision = Buffer.concat([
    rawChange({ path: "packages/A.ts" }),
    rawChange({
      path: "packages/Ａ.ts",
      beforeObject: "3".repeat(40),
      afterObject: "4".repeat(40),
    }),
  ]);
  const { seams: normalizedSeams } = happyGitSeam({ diff: compatibilityCollision });
  assertExhaustive(await captureWithSeam(normalizedSeams), "PATH_COLLISION");
});

test("the complete tracked tree rejects special, unsafe, malformed, and drifting entries", async () => {
  const specialTree = Buffer.from(`120000 blob ${TRACKED_OBJECT}\tlinked.ts\0`);
  const unsafeTree = trackedTree(["../outside.ts"]);
  const malformedTree = Buffer.from(`100644 blob ${TRACKED_OBJECT} missing-tab\0`);
  const cases = [
    { reason: "TRACKED_TREE_UNSUPPORTED", trackedTrees: [specialTree] },
    { reason: "PATH_UNSAFE", trackedTrees: [unsafeTree] },
    { reason: "TRACKED_TREE_INVALID", trackedTrees: [malformedTree] },
    {
      reason: "INPUT_CHANGED_DURING_CAPTURE",
      trackedTrees: [trackedTree(), trackedTree(["different.ts"])],
    },
  ];
  for (const { reason, trackedTrees } of cases) {
    const { seams } = happyGitSeam({ trackedTrees });
    assertExhaustive(await captureWithSeam(seams), reason);
  }
});

test("empty and over-budget diffs plus Git errors return bounded exhaustive receipts", async () => {
  const empty = happyGitSeam({ diff: Buffer.alloc(0) });
  assertExhaustive(await captureWithSeam(empty.seams), "EMPTY_CHANGE_SET");

  const overBudget = happyGitSeam({
    diff: Buffer.alloc(AFFECTED_CHANGE_BOUNDARY_LIMITS.maximumDiffBytes + 1, 1),
  });
  assertExhaustive(await captureWithSeam(overBudget.seams), "GIT_RESULT_INVALID");

  const failure = happyGitSeam({
    commandOverride: (args) => {
      if (args[0] === "diff-tree") throw new Error("hostile Git failure details");
      return undefined;
    },
  });
  const failureReceipt = await captureWithSeam(failure.seams);
  assertExhaustive(failureReceipt, "GIT_FAILURE");
  assert.equal(JSON.stringify(failureReceipt).includes("hostile"), false);
});

test("regular executable modifications are eligible but equal or zero object ids are not", async () => {
  const executable = happyGitSeam({
    diff: rawChange({ beforeMode: "100755", path: "scripts/reviewed.mjs" }),
  });
  const executableReceipt = await captureWithSeam(executable.seams);
  assert.equal(executableReceipt.selection, "AFFECTED");
  assert.equal(executableReceipt.changes[0].mode, "100755");

  for (const diff of [
    rawChange({ afterObject: BEFORE_OBJECT }),
    rawChange({ beforeObject: "0".repeat(40) }),
    rawChange({ afterObject: "0".repeat(40) }),
  ]) {
    const { seams } = happyGitSeam({ diff });
    assertExhaustive(await captureWithSeam(seams), "UNSUPPORTED_FILE_MODE");
  }
});
