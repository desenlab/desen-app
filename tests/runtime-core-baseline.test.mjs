import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  RUNTIME_CORE_BASELINE_ARTIFACT_PATH as ARTIFACT,
  RUNTIME_CORE_BASELINE_CAPTURE as CAPTURE,
  RUNTIME_CORE_BASELINE_PATH as CORE,
  RuntimeCoreBaselineProofError,
  captureRuntimeCoreBaseline as capture,
  captureRuntimeCoreGitEnvironment as gitEnvironment,
  parseRuntimeCoreBaselineBytes as parse,
  serializeRuntimeCoreBaseline as serialize,
  verifyRuntimeCoreBaseline as verify,
  verifyRuntimeCoreBaselineEvidence as verifyEvidence,
  writeRuntimeCoreBaseline as write,
  writeRuntimeCoreBaselineEvidence as writeEvidence,
} from "../scripts/lib/runtime-core-baseline-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const READER = pathToFileURL(path.join(ROOT, "scripts/lib/runtime-core-baseline-proof.mjs")).href;
const SOURCE = `${CORE}/src/index.ts`;
const SOURCE_BYTES = "export const value = 1;\n";
const NAMES = Object.freeze([
  "runtime core baseline captures the committed whole tree",
  "runtime core baseline permits unrelated and generated changes",
  "runtime core baseline verifies a shallow current HEAD without its capture commit",
  "runtime core baseline rejects content addition deletion and mode drift",
  "runtime core baseline rejects index-only staged drift",
  "runtime core baseline rejects hidden index flags",
  "runtime core baseline rejects ignored untracked source and tests",
  "runtime core baseline strictly parses artifacts and evidence options",
  "runtime core baseline fails closed on missing Git objects repositories and timeout",
  "runtime core baseline isolates ambient Git configuration",
  "runtime core baseline detects HEAD index and worktree races",
  "runtime core baseline writes canonical immutable artifacts safely",
]);
const execFileAsync = promisify(execFile);
const temporaries = [];

function code(expected) {
  return (error) => {
    assert.ok(error instanceof RuntimeCoreBaselineProofError);
    assert.equal(error.code, `RUNTIME_CORE_BASELINE_${expected}`);
    return true;
  };
}

async function temporary() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-t09-git-")));
  temporaries.push(root);
  return root;
}

async function file(root, relative, bytes) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return target;
}

async function git(root, args) {
  const result = await execFileAsync(
    "git",
    ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args],
    {
      cwd: root,
      env: {
        ...gitEnvironment(),
        GIT_AUTHOR_NAME: "DESEN baseline fixture",
        GIT_AUTHOR_EMAIL: "baseline-fixture@example.invalid",
        GIT_COMMITTER_NAME: "DESEN baseline fixture",
        GIT_COMMITTER_EMAIL: "baseline-fixture@example.invalid",
        GIT_AUTHOR_DATE: "2026-09-08T00:00:00Z",
        GIT_COMMITTER_DATE: "2026-09-08T00:00:00Z",
      },
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    },
  );
  return result.stdout.trimEnd();
}

async function fixture() {
  const workspaceRoot = await temporary();
  await git(workspaceRoot, ["init", "--initial-branch=main", "--object-format=sha1"]);
  await git(workspaceRoot, ["config", "core.filemode", "true"]);
  await file(workspaceRoot, SOURCE, SOURCE_BYTES);
  await file(workspaceRoot, `${CORE}/test/runtime.test.ts`, "export const test = true;\n");
  await file(workspaceRoot, `${CORE}/README.md`, "# Runtime Core fixture\n");
  await file(workspaceRoot, `${CORE}/package.json`, '{"name":"runtime-core-fixture"}\n');
  await file(workspaceRoot, "README.md", "Unrelated workspace content.\n");
  await file(
    workspaceRoot,
    ".gitignore",
    [
      `${CORE}/dist/`,
      `${CORE}/node_modules/`,
      `${CORE}/src/ignored.ts`,
      `${CORE}/test/ignored.test.ts`,
      "",
    ].join("\n"),
  );
  await git(workspaceRoot, ["add", "--all"]);
  await git(workspaceRoot, ["commit", "-m", "Capture isolated Runtime Core fixture"]);
  const baseline = await capture({ workspaceRoot });
  return { workspaceRoot, baseline };
}

async function child(program, environment = {}) {
  const result = await execFileAsync(process.execPath, ["--input-type=module", "-e", program], {
    cwd: ROOT,
    // The exact CI preload/permission environment remains inherited in the test child.
    env: { ...process.env, ...environment },
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(result.stdout.trim());
}

function childVerification(fixtureValue) {
  return `
    import { verifyRuntimeCoreBaseline } from ${JSON.stringify(READER)};
    try {
      const result = await verifyRuntimeCoreBaseline(${JSON.stringify(fixtureValue)});
      process.stdout.write(JSON.stringify({ clean: result.clean, tree: result.tree }));
    } catch (error) {
      process.stdout.write(JSON.stringify({ code: error.code, message: error.message }));
    }
  `;
}

after(async () => {
  for (const root of temporaries) await rm(root, { recursive: true, force: true });
});

test(NAMES[0], async () => {
  const current = await verify({ workspaceRoot: ROOT, baseline: CAPTURE });
  assert.equal(current.clean, true);
  assert.equal(current.tree, "3fa3613a3be63c749f40b6a0b55af5b40c675773");
  assert.equal(current.currentCommit, await git(ROOT, ["rev-parse", "HEAD"]));
  assert.equal(current.path, CORE);
  assert.ok(current.trackedFiles > 20);
  assert.ok(Object.isFrozen(current));
  assert.deepEqual(parse(await readFile(path.join(ROOT, ARTIFACT))), CAPTURE);

  const local = await fixture();
  assert.equal(local.baseline.captureCommit, await git(local.workspaceRoot, ["rev-parse", "HEAD"]));
  assert.equal(local.baseline.tree, await git(local.workspaceRoot, ["rev-parse", `HEAD:${CORE}`]));
  assert.ok(Object.isFrozen(local.baseline));
  const result = await verify(local);
  assert.deepEqual(result, {
    currentCommit: local.baseline.captureCommit,
    tree: local.baseline.tree,
    objectFormat: "sha1",
    path: CORE,
    trackedFiles: 4,
    clean: true,
  });
  assert.equal(Object.hasOwn(result, "status"), false);
  assert.deepEqual(parse(serialize(local.baseline)), local.baseline);
});

test(NAMES[1], async () => {
  const local = await fixture();
  await file(local.workspaceRoot, "README.md", "Unrelated committed change.\n");
  await git(local.workspaceRoot, ["add", "README.md"]);
  await git(local.workspaceRoot, ["commit", "-m", "Unrelated change after capture"]);
  await file(local.workspaceRoot, "README.md", "Unrelated staged change.\n");
  await git(local.workspaceRoot, ["add", "README.md"]);
  await file(local.workspaceRoot, "README.md", "Unrelated unstaged change.\n");
  await file(local.workspaceRoot, "other-package/untracked.ts", "export const outside = true;\n");
  await file(local.workspaceRoot, `${CORE}/dist/index.js`, "generated output\n");
  await file(
    local.workspaceRoot,
    `${CORE}/node_modules/example/index.js`,
    "installed dependency\n",
  );
  await file(local.workspaceRoot, ".git/info/exclude", `${CORE}/.turbo/\n${CORE}/coverage/\n`);
  await file(local.workspaceRoot, `${CORE}/.turbo/cache.log`, "task cache\n");
  await file(local.workspaceRoot, `${CORE}/coverage/coverage.json`, "{}\n");
  const observed = await verify(local);
  assert.equal(observed.clean, true);
  assert.notEqual(observed.currentCommit, local.baseline.captureCommit);
  assert.equal(observed.tree, local.baseline.tree);
});

test(NAMES[2], async () => {
  const local = await fixture();
  await file(local.workspaceRoot, "README.md", "Later unrelated commit.\n");
  await git(local.workspaceRoot, ["add", "README.md"]);
  await git(local.workspaceRoot, ["commit", "-m", "Shallow clone tip"]);
  const destination = path.join(await temporary(), "shallow");
  await git(local.workspaceRoot, [
    "-c",
    "protocol.file.allow=always",
    "clone",
    "--depth=1",
    "--no-local",
    pathToFileURL(local.workspaceRoot).href,
    destination,
  ]);
  assert.equal(await git(destination, ["rev-parse", "--is-shallow-repository"]), "true");
  await assert.rejects(
    git(destination, ["cat-file", "-e", `${local.baseline.captureCommit}^{commit}`]),
  );
  const observed = await verify({ workspaceRoot: destination, baseline: local.baseline });
  assert.equal(observed.clean, true);
  assert.equal(observed.tree, local.baseline.tree);
  assert.notEqual(observed.currentCommit, local.baseline.captureCommit);
  assert.equal(await git(destination, ["rev-parse", "--is-shallow-repository"]), "true");
});

test(NAMES[3], async () => {
  const mutations = [
    ["WORKTREE_DIRTY", async (root) => file(root, SOURCE, "export const value = 22;\n")],
    [
      "WORKTREE_DIRTY",
      async (root) => {
        const target = path.join(root, SOURCE);
        const before = await stat(target);
        await writeFile(target, "export const value = 2;\n");
        await utimes(target, before.atime, before.mtime);
        assert.equal((await stat(target)).size, before.size);
      },
    ],
    ["UNTRACKED_SOURCE", async (root) => file(root, `${CORE}/src/added.ts`, "new source\n")],
    ["WORKTREE_DIRTY", async (root) => rm(path.join(root, SOURCE))],
    [
      "WORKTREE_DIRTY",
      async (root) => {
        await git(root, ["config", "core.filemode", "false"]);
        await chmod(path.join(root, SOURCE), 0o755);
      },
    ],
    [
      "WORKTREE_DIRTY",
      async (root) => {
        const external = await file(root, "external.ts", SOURCE_BYTES);
        await rm(path.join(root, SOURCE));
        await symlink(external, path.join(root, SOURCE));
      },
    ],
  ];
  for (const [expected, mutate] of mutations) {
    const local = await fixture();
    await mutate(local.workspaceRoot);
    await assert.rejects(verify(local), code(expected));
    await assert.rejects(capture({ workspaceRoot: local.workspaceRoot }), code(expected));
  }
  for (const mutate of [
    async (root) => file(root, SOURCE, "export const value = 22;\n"),
    async (root) => file(root, `${CORE}/README.md`, "Changed package documentation.\n"),
    async (root) => file(root, `${CORE}/test/runtime.test.ts`, "Changed Core test.\n"),
    async (root) => file(root, `${CORE}/package.json`, '{"name":"changed"}\n'),
    async (root) => file(root, `${CORE}/src/added.ts`, "Committed addition.\n"),
    async (root) => rm(path.join(root, SOURCE)),
    async (root) => chmod(path.join(root, SOURCE), 0o755),
  ]) {
    const local = await fixture();
    await mutate(local.workspaceRoot);
    await git(local.workspaceRoot, ["add", "--all"]);
    await git(local.workspaceRoot, ["commit", "-m", "Changed Core tree"]);
    await assert.rejects(verify(local), code("TREE_CHANGED"));
  }
});

test(NAMES[4], async () => {
  const local = await fixture();
  await file(local.workspaceRoot, SOURCE, "export const value = 2;\n");
  await git(local.workspaceRoot, ["add", SOURCE]);
  await file(local.workspaceRoot, SOURCE, SOURCE_BYTES);
  assert.equal(await readFile(path.join(local.workspaceRoot, SOURCE), "utf8"), SOURCE_BYTES);
  await assert.rejects(verify(local), code("INDEX_DIRTY"));
  await assert.rejects(capture({ workspaceRoot: local.workspaceRoot }), code("INDEX_DIRTY"));

  for (const args of [
    ["rm", "--cached", SOURCE],
    ["update-index", "--chmod=+x", SOURCE],
  ]) {
    const other = await fixture();
    await git(other.workspaceRoot, args);
    await assert.rejects(verify(other), code("INDEX_DIRTY"));
  }
  const added = await fixture();
  await file(added.workspaceRoot, `${CORE}/src/added.ts`, "Added to the index.\n");
  await git(added.workspaceRoot, ["add", `${CORE}/src/added.ts`]);
  await assert.rejects(verify(added), code("INDEX_DIRTY"));
});

test(NAMES[5], async () => {
  for (const flag of ["--assume-unchanged", "--skip-worktree"]) {
    const local = await fixture();
    await git(local.workspaceRoot, ["update-index", flag, SOURCE]);
    await assert.rejects(verify(local), code("INDEX_DIRTY"));
    await file(local.workspaceRoot, SOURCE, "export const value = 2;\n");
    assert.equal(await git(local.workspaceRoot, ["status", "--porcelain", "--", CORE]), "");
    await assert.rejects(verify(local), code("INDEX_DIRTY"));
    await assert.rejects(capture({ workspaceRoot: local.workspaceRoot }), code("INDEX_DIRTY"));
  }
});

test(NAMES[6], async () => {
  for (const relative of [`${CORE}/src/ignored.ts`, `${CORE}/test/ignored.test.ts`]) {
    const local = await fixture();
    await file(local.workspaceRoot, relative, "Ignored source cannot bypass the baseline.\n");
    assert.equal(await git(local.workspaceRoot, ["check-ignore", relative]), relative);
    assert.equal(await git(local.workspaceRoot, ["status", "--porcelain", "--", CORE]), "");
    await assert.rejects(verify(local), code("UNTRACKED_SOURCE"));
  }
});

test(NAMES[7], async () => {
  const bytes = serialize(CAPTURE);
  for (const malformed of [
    Buffer.alloc(0),
    Buffer.alloc(4097, 32),
    Buffer.from("not JSON"),
    Buffer.from([0xff]),
    Buffer.from(JSON.stringify(CAPTURE)),
    Buffer.from(`${bytes.toString()}\n`),
    Buffer.from(
      bytes.toString().replace('"schemaVersion": 1,', '"schemaVersion": 1,\n  "schemaVersion": 1,'),
    ),
    Buffer.from(bytes.toString().replace('"tree":', '"extra": true,\n  "tree":')),
    Buffer.from(bytes.toString().replace('"schemaVersion": 1,\n  ', "")),
    Buffer.from("null\n"),
    Buffer.from("[]\n"),
  ]) {
    assert.throws(() => parse(malformed), code("ARTIFACT_INVALID"));
  }
  for (const [key, value] of [
    ["task", "M10-T08"],
    ["schemaVersion", 2],
    ["profile", "arbitrary"],
    ["path", "packages/runtime-react"],
    ["objectFormat", "sha256"],
    ["captureCommit", "deadbeef"],
    ["tree", "A".repeat(40)],
  ]) {
    assert.throws(() => serialize({ ...CAPTURE, [key]: value }), code("ARTIFACT_INVALID"));
  }
  let getterCalled = false;
  const accessor = { ...CAPTURE };
  Object.defineProperty(accessor, "tree", {
    enumerable: true,
    get() {
      getterCalled = true;
      throw new Error("Must not execute an artifact getter.");
    },
  });
  assert.throws(() => serialize(accessor), code("ARTIFACT_INVALID"));
  assert.equal(getterCalled, false);
  assert.throws(() => serialize(new Proxy(CAPTURE, {})), code("ARTIFACT_INVALID"));
  assert.throws(() => parse(new Proxy(bytes, {})), code("ARTIFACT_INVALID"));
  assert.throws(
    () => parse(new Uint8Array(new SharedArrayBuffer(bytes.length))),
    code("ARTIFACT_INVALID"),
  );
  assert.throws(
    () => parse(new Uint8Array(new ArrayBuffer(bytes.length, { maxByteLength: bytes.length + 1 }))),
    code("ARTIFACT_INVALID"),
  );
  const customPrototype = Uint8Array.from(bytes);
  Object.setPrototypeOf(customPrototype, Object.create(Uint8Array.prototype));
  assert.throws(() => parse(customPrototype), code("ARTIFACT_INVALID"));
  const shadowedBytes = Uint8Array.from(bytes);
  Object.defineProperty(shadowedBytes, "byteLength", {
    get() {
      getterCalled = true;
      throw new Error("Must not execute a byte-view getter.");
    },
  });
  assert.throws(() => parse(shadowedBytes), code("ARTIFACT_INVALID"));
  assert.equal(getterCalled, false);
  const local = await fixture();
  await assert.rejects(
    verify({ ...local, baseline: { ...local.baseline, tree: "0".repeat(40) } }),
    code("TREE_CHANGED"),
  );
  for (const options of [
    { workspaceRoot: ROOT, testSeams: {} },
    { workspaceRoot: ROOT, baseline: CAPTURE },
    { workspaceRoot: ROOT, artifactPath: ARTIFACT },
    { workspaceRoot: ROOT, fileOverrides: new Map() },
  ]) {
    await assert.rejects(verifyEvidence(options), code("OPTIONS_INVALID"));
    await assert.rejects(writeEvidence(options), code("OPTIONS_INVALID"));
  }
  await assert.rejects(
    verify({
      ...local,
      testSeams: { beforeGit: async () => assert.fail("Unknown seam executed.") },
    }),
    code("OPTIONS_INVALID"),
  );
  await assert.rejects(
    verify({ ...local, testSeams: { afterWorktreeScan: true } }),
    code("OPTIONS_INVALID"),
  );
  const wrongPin = await temporary();
  const wrongBytes = serialize({ ...CAPTURE, tree: "0".repeat(40) });
  await file(wrongPin, ARTIFACT, wrongBytes);
  await assert.rejects(writeEvidence({ workspaceRoot: wrongPin }), code("ARTIFACT_DRIFT"));
  assert.deepEqual(await readFile(path.join(wrongPin, ARTIFACT)), wrongBytes);
});

test(NAMES[8], { timeout: 30000 }, async () => {
  const noRepository = await temporary();
  await assert.rejects(
    verify({ workspaceRoot: noRepository, baseline: CAPTURE }),
    code("GIT_FAILED"),
  );
  await assert.rejects(
    verify({ workspaceRoot: path.join(noRepository, "missing"), baseline: CAPTURE }),
    code("REPOSITORY_INVALID"),
  );

  const local = await fixture();
  const emptyPath = await temporary();
  const absent = await child(childVerification(local), { PATH: emptyPath });
  assert.deepEqual(absent, {
    code: "RUNTIME_CORE_BASELINE_GIT_FAILED",
    message: "A bounded read-only Git command failed.",
  });
  const executableDirectory = await temporary();
  await file(executableDirectory, "git", `#!${process.execPath}\nsetTimeout(() => {}, 20000);\n`);
  await chmod(path.join(executableDirectory, "git"), 0o755);
  const started = performance.now();
  assert.deepEqual(await child(childVerification(local), { PATH: executableDirectory }), absent);
  assert.ok(performance.now() - started >= 4500, "The actual fixed Git deadline was reached.");
  assert.ok(performance.now() - started < 12000, "The bounded child was terminated promptly.");

  const missingObject = await fixture();
  const tree = missingObject.baseline.tree;
  assert.match(tree, /^[0-9a-f]{40}$/u);
  const looseObject = path.join(
    missingObject.workspaceRoot,
    ".git",
    "objects",
    tree.slice(0, 2),
    tree.slice(2),
  );
  assert.ok((await stat(looseObject)).isFile());
  await rm(looseObject);
  await assert.rejects(verify(missingObject), code("GIT_FAILED"));
  const missingBlob = await fixture();
  const blob = await git(missingBlob.workspaceRoot, ["rev-parse", `HEAD:${SOURCE}`]);
  assert.match(blob, /^[0-9a-f]{40}$/u);
  const looseBlob = path.join(
    missingBlob.workspaceRoot,
    ".git",
    "objects",
    blob.slice(0, 2),
    blob.slice(2),
  );
  assert.ok((await stat(looseBlob)).isFile());
  await rm(looseBlob);
  await assert.rejects(verify(missingBlob), code("GIT_INVALID"));
  const nested = path.join(local.workspaceRoot, CORE);
  await assert.rejects(
    verify({ workspaceRoot: nested, baseline: local.baseline }),
    code("REPOSITORY_INVALID"),
  );
});

test(NAMES[9], async () => {
  const hostile = {
    PATH: process.env.PATH,
    GIT_DIR: "/missing/redirected.git",
    GIT_WORK_TREE: "/missing/worktree",
    GIT_COMMON_DIR: "/missing/common",
    GIT_INDEX_FILE: "/missing/index",
    GIT_OBJECT_DIRECTORY: "/missing/objects",
    GIT_ALTERNATE_OBJECT_DIRECTORIES: "/missing/alternate",
    GIT_CONFIG: "/missing/config",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.bare",
    GIT_CONFIG_VALUE_0: "true",
    GIT_CONFIG_PARAMETERS: "'core.bare=true'",
    GIT_CONFIG_GLOBAL: "/missing/global",
    GIT_CONFIG_SYSTEM: "/missing/system",
    GIT_REPLACE_REF_BASE: "refs/hostile/",
    GIT_EXEC_PATH: "/missing/git-exec",
    NODE_OPTIONS: "--eval=untrusted",
  };
  const captured = gitEnvironment(hostile);
  assert.ok(Object.isFrozen(captured));
  assert.equal(captured.PATH, process.env.PATH);
  assert.equal(captured.GIT_CONFIG_COUNT, "0");
  assert.equal(captured.GIT_CONFIG_NOSYSTEM, "1");
  assert.equal(captured.GIT_CONFIG_GLOBAL, "/dev/null");
  assert.equal(captured.GIT_OPTIONAL_LOCKS, "0");
  assert.equal(captured.GIT_NO_LAZY_FETCH, "1");
  assert.equal(captured.GIT_NO_REPLACE_OBJECTS, "1");
  for (const key of Object.keys(hostile)) {
    if (!["PATH", "GIT_CONFIG_COUNT", "GIT_CONFIG_GLOBAL"].includes(key)) {
      assert.equal(Object.hasOwn(captured, key), false, `${key} is not delegated to Git.`);
    }
  }
  let getterCalled = false;
  const accessor = {};
  Object.defineProperty(accessor, "PATH", {
    get() {
      getterCalled = true;
      return "/untrusted";
    },
  });
  assert.equal(Object.hasOwn(gitEnvironment(accessor), "PATH"), false);
  assert.equal(getterCalled, false);
  assert.throws(() => gitEnvironment(new Proxy({}, {})), code("OPTIONS_INVALID"));
  const local = await fixture();
  const { NODE_OPTIONS: _notDelegated, ...gitOnlyHostile } = hostile;
  const observation = await child(childVerification(local), gitOnlyHostile);
  assert.deepEqual(observation, { clean: true, tree: local.baseline.tree });
});

test(NAMES[10], async () => {
  for (const seam of ["afterInitialGitSnapshot", "afterWorktreeScan"]) {
    for (const mutate of [
      async (root) => {
        await file(root, "README.md", "Unrelated HEAD race.\n");
        await git(root, ["add", "README.md"]);
        await git(root, ["commit", "-m", "Move HEAD during observation"]);
      },
      async (root) => git(root, ["update-index", "--assume-unchanged", SOURCE]),
      async (root) => git(root, ["update-index", "--chmod=+x", SOURCE]),
    ]) {
      const local = await fixture();
      let calls = 0;
      await assert.rejects(
        verify({
          ...local,
          testSeams: {
            [seam]: async () => {
              calls++;
              await mutate(local.workspaceRoot);
            },
          },
        }),
        code("INPUT_RACE"),
      );
      assert.equal(calls, 1);
    }
  }
  const bytes = await fixture();
  await assert.rejects(
    verify({
      ...bytes,
      testSeams: {
        afterWorktreeScan: async () =>
          file(bytes.workspaceRoot, SOURCE, "export const value = 2;\n"),
      },
    }),
    code("INPUT_RACE"),
  );
  const untracked = await fixture();
  await assert.rejects(
    verify({
      ...untracked,
      testSeams: {
        afterWorktreeScan: async () =>
          file(untracked.workspaceRoot, `${CORE}/src/ignored.ts`, "Late ignored source.\n"),
      },
    }),
    code("UNTRACKED_SOURCE"),
  );
});

test(NAMES[11], async () => {
  const directory = await temporary();
  const artifactPath = path.join(directory, "baseline.json");
  const expectedBytes = serialize(CAPTURE);
  const first = await write({ artifactPath, baseline: CAPTURE });
  assert.deepEqual(first, {
    created: true,
    path: artifactPath,
    bytes: expectedBytes.length,
    sha256: createHash("sha256").update(expectedBytes).digest("hex"),
  });
  assert.ok(Object.isFrozen(first));
  assert.deepEqual(await readFile(artifactPath), expectedBytes);
  assert.deepEqual(await write({ artifactPath, baseline: CAPTURE }), { ...first, created: false });
  await assert.rejects(
    write({ artifactPath, baseline: { ...CAPTURE, tree: "0".repeat(40) } }),
    code("ARTIFACT_DRIFT"),
  );
  assert.deepEqual(await readFile(artifactPath), expectedBytes);

  const symbolic = path.join(directory, "symbolic.json");
  await symlink(artifactPath, symbolic);
  await assert.rejects(
    write({ artifactPath: symbolic, baseline: CAPTURE }),
    code("ARTIFACT_UNSAFE"),
  );
  assert.deepEqual(await readFile(artifactPath), expectedBytes);
  const hard = path.join(directory, "hard.json");
  await link(artifactPath, hard);
  await assert.rejects(write({ artifactPath: hard, baseline: CAPTURE }), code("ARTIFACT_UNSAFE"));
  assert.deepEqual(await readFile(artifactPath), expectedBytes);
  const linkedParent = path.join(directory, "linked-parent");
  const ownedParent = path.join(directory, "real-parent");
  await mkdir(ownedParent);
  await symlink(ownedParent, linkedParent);
  await assert.rejects(
    write({ artifactPath: path.join(linkedParent, "baseline.json"), baseline: CAPTURE }),
    code("ARTIFACT_UNSAFE"),
  );
  const malformed = await file(directory, "malformed.json", "Not a baseline.\n");
  await assert.rejects(
    write({ artifactPath: malformed, baseline: CAPTURE }),
    code("ARTIFACT_DRIFT"),
  );
  assert.equal(await readFile(malformed, "utf8"), "Not a baseline.\n");
  await assert.rejects(
    write({
      artifactPath: path.join(directory, "missing-parent", "baseline.json"),
      baseline: CAPTURE,
    }),
    code("ARTIFACT_UNSAFE"),
  );
});
