import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify, types } from "node:util";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const execFileAsync = promisify(execFile);
const MAX_ARTIFACT_BYTES = 4096;
const MAX_GIT_BYTES = 1024 * 1024;
const MAX_TRACKED_FILES = 1024;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const READ_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength").get;
const BUFFER_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer").get;
const RESIZABLE_GETTER = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get;
const BASELINE_KEYS = Object.freeze([
  "schemaVersion",
  "task",
  "profile",
  "path",
  "objectFormat",
  "captureCommit",
  "tree",
]);

/** Whole-package comparison scope, including tests, configuration and README. */
export const RUNTIME_CORE_BASELINE_PATH = "packages/runtime-core";
/** Closed data profile for the committed Git tree captured by M10-T09. */
export const RUNTIME_CORE_BASELINE_PROFILE = "desen.runtime-core-baseline.v1";
/** Immutable record location; generation never rewrites an existing different record. */
export const RUNTIME_CORE_BASELINE_ARTIFACT_PATH =
  "docs/proof/artifacts/runtime-core-baseline.json";
/** Reviewed merged T08 capture provenance, not a requirement to fetch this commit later. */
export const RUNTIME_CORE_BASELINE_CAPTURE = Object.freeze({
  schemaVersion: 1,
  task: "M10-T09",
  profile: RUNTIME_CORE_BASELINE_PROFILE,
  path: RUNTIME_CORE_BASELINE_PATH,
  objectFormat: "sha1",
  captureCommit: "61bfda591a25558193c94e1d0d6a9bb95af6d00d",
  tree: "3fa3613a3be63c749f40b6a0b55af5b40c675773",
});

/** Redacted bounded-baseline failure, without child output or source contents. */
export class RuntimeCoreBaselineProofError extends Error {
  /** Creates one redacted failure with a stable baseline-specific code. */
  constructor(code, message) {
    super(message);
    this.name = "RuntimeCoreBaselineProofError";
    this.code = `RUNTIME_CORE_BASELINE_${code}`;
  }
}

function fail(code, message) {
  throw new RuntimeCoreBaselineProofError(code, message);
}

function record(value, required, optional = [], code = "OPTIONS_INVALID") {
  if (value === null || typeof value !== "object" || types.isProxy(value) || Array.isArray(value)) {
    fail(code, "Expected a closed own-data record.");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(code, "Invalid record prototype.");
  const keys = Reflect.ownKeys(value);
  if (
    required.some((key) => !keys.includes(key)) ||
    keys.some(
      (key) => typeof key !== "string" || (!required.includes(key) && !optional.includes(key)),
    )
  ) {
    fail(code, "Unexpected or missing record fields.");
  }
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor))
      fail(code, "Accessor fields are forbidden.");
    result[key] = descriptor.value;
  }
  return Object.freeze(result);
}

function baselineRecord(raw) {
  const value = record(raw, BASELINE_KEYS, [], "ARTIFACT_INVALID");
  if (
    value.schemaVersion !== 1 ||
    value.task !== "M10-T09" ||
    value.profile !== RUNTIME_CORE_BASELINE_PROFILE ||
    value.path !== RUNTIME_CORE_BASELINE_PATH ||
    value.objectFormat !== "sha1" ||
    typeof value.captureCommit !== "string" ||
    !/^[0-9a-f]{40}$/u.test(value.captureCommit) ||
    typeof value.tree !== "string" ||
    !/^[0-9a-f]{40}$/u.test(value.tree)
  )
    fail("ARTIFACT_INVALID", "Invalid baseline identity.");
  return Object.freeze(Object.fromEntries(BASELINE_KEYS.map((key) => [key, value[key]])));
}

/** Serializes only the small canonical baseline schema; this is data, not an execution receipt. */
export function serializeRuntimeCoreBaseline(baseline) {
  return Buffer.from(`${JSON.stringify(baselineRecord(baseline), null, 2)}\n`, "utf8");
}

/** Rejects noncanonical, duplicate-key, malformed, oversized and executable baseline inputs. */
export function parseRuntimeCoreBaselineBytes(rawBytes) {
  if (types.isProxy(rawBytes) || !types.isUint8Array(rawBytes))
    fail("ARTIFACT_INVALID", "Expected inert bytes.");
  const prototype = Object.getPrototypeOf(rawBytes);
  if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
    fail("ARTIFACT_INVALID", "Custom byte prototypes are forbidden.");
  }
  const buffer = BUFFER_GETTER.call(rawBytes);
  if (types.isSharedArrayBuffer(buffer) || RESIZABLE_GETTER?.call(buffer))
    fail("ARTIFACT_INVALID", "Mutable shared bytes are forbidden.");
  const byteLength = BYTE_LENGTH_GETTER.call(rawBytes);
  if (byteLength === 0 || byteLength > MAX_ARTIFACT_BYTES)
    fail("ARTIFACT_INVALID", "Artifact byte limit exceeded.");
  for (const key of Reflect.ownKeys(rawBytes)) {
    if (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= byteLength) {
      fail("ARTIFACT_INVALID", "Byte views cannot carry custom fields.");
    }
  }
  const bytes = Buffer.from(rawBytes);
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("ARTIFACT_INVALID", "Artifact is not valid UTF-8 JSON.");
  }
  const baseline = baselineRecord(parsed);
  if (!serializeRuntimeCoreBaseline(baseline).equals(bytes))
    fail("ARTIFACT_INVALID", "Artifact encoding is not canonical.");
  return baseline;
}

/** Copies only the process environment needed by read-only Git, excluding Git injection state. */
export function captureRuntimeCoreGitEnvironment(base = process.env) {
  if (base === null || typeof base !== "object" || types.isProxy(base) || Array.isArray(base)) {
    fail("OPTIONS_INVALID", "Invalid Git environment.");
  }
  const environment = {
    GIT_CONFIG_COUNT: "0",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_TERMINAL_PROMPT: "0",
    LANG: "C",
    LC_ALL: "C",
  };
  for (const key of ["PATH", "SYSTEMROOT", "WINDIR", "TMPDIR", "TEMP", "TMP"]) {
    const descriptor = Object.getOwnPropertyDescriptor(base, key);
    if (descriptor && "value" in descriptor && typeof descriptor.value === "string")
      environment[key] = descriptor.value;
  }
  return Object.freeze(environment);
}

function options(raw, required = [], optional = []) {
  return record(raw === undefined ? {} : raw, required, ["workspaceRoot", ...optional]);
}

function absolutePath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 4096 ||
    [...value].some(
      (character) => character.charCodeAt(0) === 0 || character === "\r" || character === "\n",
    ) ||
    !path.isAbsolute(value) ||
    path.resolve(value) !== value
  ) {
    fail("OPTIONS_INVALID", `${label} must be one canonical absolute path.`);
  }
  return value;
}

async function canonicalRoot(value = ROOT) {
  const root = absolutePath(value, "Workspace");
  try {
    const stat = await lstat(root);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (await realpath(root)) !== root)
      throw new Error();
  } catch {
    fail("REPOSITORY_INVALID", "Workspace must be an existing canonical directory.");
  }
  return root;
}

async function git(root, args, input = undefined) {
  try {
    const pending = execFileAsync(
      "git",
      [
        "--no-optional-locks",
        "--no-replace-objects",
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.untrackedCache=false",
        "-c",
        `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
        "-c",
        "protocol.allow=never",
        ...args,
      ],
      {
        cwd: root,
        // Node may append inherited permission flags; never let it mutate the frozen sanitizer result.
        env: { ...captureRuntimeCoreGitEnvironment() },
        encoding: "buffer",
        timeout: 5000,
        maxBuffer: MAX_GIT_BYTES,
        windowsHide: true,
      },
    );
    // Only the code-owned blob object-id batch uses stdin; no paths or shell syntax are parsed.
    if (input !== undefined) {
      pending.child.stdin.on("error", () => undefined);
      pending.child.stdin.end(input);
    }
    const result = await pending;
    return new TextDecoder("utf-8", { fatal: true }).decode(result.stdout);
  } catch {
    fail("GIT_FAILED", "A bounded read-only Git command failed.");
  }
}

function oid(text) {
  if (!/^[0-9a-f]{40}\n$/u.test(text))
    fail("GIT_INVALID", "Git returned an invalid object identity.");
  return text.slice(0, -1);
}

function nulRecords(text) {
  if (text === "") return [];
  if (!text.endsWith("\0")) fail("GIT_INVALID", "Git inventory is not NUL-terminated.");
  return text.slice(0, -1).split("\0");
}

function safeCorePath(value) {
  if (
    !value.startsWith(`${RUNTIME_CORE_BASELINE_PATH}/`) ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character === "\\") ||
    value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    fail("GIT_INVALID", "Git returned an unsafe Core path.");
  }
  return value;
}

async function snapshot(root) {
  const commit = oid(await git(root, ["rev-parse", "--verify", "HEAD^{commit}"]));
  const tree = oid(
    await git(root, ["rev-parse", "--verify", `${commit}:${RUNTIME_CORE_BASELINE_PATH}`]),
  );
  const index = await git(root, ["ls-files", "--stage", "-z", "--", RUNTIME_CORE_BASELINE_PATH]);
  const flags = await git(root, ["ls-files", "-v", "-z", "--", RUNTIME_CORE_BASELINE_PATH]);
  return Object.freeze({ commit, tree, index, flags });
}

async function assertNoUntracked(root) {
  const visible = await git(root, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    RUNTIME_CORE_BASELINE_PATH,
  ]);
  // Ignored build outputs are not committed Core; ignored source still participates in compilation.
  const source = await git(root, [
    "ls-files",
    "--others",
    "-z",
    "--",
    `${RUNTIME_CORE_BASELINE_PATH}/src`,
    `${RUNTIME_CORE_BASELINE_PATH}/test`,
  ]);
  if (visible !== "" || source !== "")
    fail("UNTRACKED_SOURCE", "Core has untracked source or nonignored files.");
}

async function fileState(root, entry) {
  const target = path.join(root, entry.path);
  try {
    const stat = await lstat(target, { bigint: true });
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      (await realpath(target)) !== target ||
      stat.size > BigInt(MAX_FILE_BYTES) ||
      (stat.mode & 0o111n ? "100755" : "100644") !== entry.mode
    ) {
      fail("WORKTREE_DIRTY", "A tracked Core file has an unsafe type, size or changed mode.");
    }
    return [stat.dev, stat.ino, stat.size, stat.mode, stat.mtimeNs, stat.ctimeNs]
      .map(String)
      .join(":");
  } catch (error) {
    if (error instanceof RuntimeCoreBaselineProofError) throw error;
    fail("WORKTREE_DIRTY", "A tracked Core file is missing or unreadable.");
  }
}

async function observe(root, expected, seams = {}) {
  if (
    (await git(root, ["rev-parse", "--show-toplevel"])) !== `${root}\n` ||
    (await git(root, ["rev-parse", "--is-bare-repository"])) !== "false\n" ||
    (await git(root, ["rev-parse", "--show-object-format"])) !== "sha1\n"
  ) {
    fail("REPOSITORY_INVALID", "Expected the exact non-bare SHA-1 workspace root.");
  }
  const before = await snapshot(root);
  if (expected !== undefined && before.tree !== expected.tree)
    fail("TREE_CHANGED", "The committed Core tree differs from the frozen baseline.");
  await seams.afterInitialGitSnapshot?.();
  const treeRecords = nulRecords(
    await git(root, ["ls-tree", "-r", "-z", before.commit, "--", RUNTIME_CORE_BASELINE_PATH]),
  );
  if (treeRecords.length === 0 || treeRecords.length > MAX_TRACKED_FILES)
    fail("GIT_INVALID", "Core inventory exceeds its finite file budget.");
  const entries = treeRecords.map((line) => {
    const match = /^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/u.exec(line);
    if (match === null) fail("GIT_INVALID", "Core must contain only regular committed files.");
    return Object.freeze({ mode: match[1], oid: match[2], path: safeCorePath(match[3]) });
  });
  const paths = entries.map((entry) => entry.path);
  if (new Set(paths).size !== paths.length)
    fail("GIT_INVALID", "Core inventory contains duplicate paths.");
  const expectedIndex = entries
    .map((entry) => `${entry.mode} ${entry.oid} 0\t${entry.path}\0`)
    .join("");
  const expectedFlags = entries.map((entry) => `H ${entry.path}\0`).join("");
  if (before.index !== expectedIndex || before.flags !== expectedFlags)
    fail("INDEX_DIRTY", "Core index differs or hides tracked state.");
  const objects = await git(
    root,
    ["cat-file", "--batch-check=%(objectname) %(objecttype)"],
    entries.map((entry) => `${entry.oid}\n`).join(""),
  );
  if (objects !== entries.map((entry) => `${entry.oid} blob\n`).join("")) {
    fail("GIT_INVALID", "A committed Core blob is missing or has an invalid type.");
  }
  await assertNoUntracked(root);
  const states = [];
  let totalBytes = 0;
  for (const entry of entries) {
    const state = await fileState(root, entry);
    totalBytes += Number(state.split(":")[2]);
    if (totalBytes > MAX_TOTAL_BYTES)
      fail("WORKTREE_DIRTY", "Core worktree exceeds its finite byte budget.");
    states.push(state);
  }
  // No -w, filters or stat-cache shortcut: Git reads every tracked file's current raw bytes.
  const hashes = await git(root, ["hash-object", "--no-filters", "--", ...paths]);
  if (hashes !== entries.map((entry) => `${entry.oid}\n`).join(""))
    fail("WORKTREE_DIRTY", "Tracked Core bytes differ from their committed blobs.");
  await seams.afterWorktreeScan?.();
  for (let index = 0; index < entries.length; index += 1) {
    if ((await fileState(root, entries[index])) !== states[index])
      fail("INPUT_RACE", "Tracked Core identity changed during observation.");
  }
  await assertNoUntracked(root);
  const after = await snapshot(root);
  if (JSON.stringify(after) !== JSON.stringify(before))
    fail("INPUT_RACE", "HEAD or Core index changed during observation.");
  return Object.freeze({
    currentCommit: before.commit,
    tree: before.tree,
    objectFormat: "sha1",
    path: RUNTIME_CORE_BASELINE_PATH,
    trackedFiles: entries.length,
    clean: true,
  });
}

/** Captures a clean current committed Core tree; no test, build or historical-success claim is made. */
export async function captureRuntimeCoreBaseline(rawOptions = undefined) {
  const captured = options(rawOptions);
  const observation = await observe(await canonicalRoot(captured.workspaceRoot));
  return baselineRecord({
    ...RUNTIME_CORE_BASELINE_CAPTURE,
    captureCommit: observation.currentCommit,
    tree: observation.tree,
  });
}

/**
 * Compares a supplied data baseline to fresh Git/index/worktree observations.
 * Test hooks are explicit generic-helper seams, never accepted by the checkpointed evidence API.
 */
export async function verifyRuntimeCoreBaseline(rawOptions) {
  const captured = options(rawOptions, ["baseline"], ["testSeams"]);
  const baseline = baselineRecord(captured.baseline);
  const seams =
    captured.testSeams === undefined
      ? {}
      : record(captured.testSeams, [], ["afterInitialGitSnapshot", "afterWorktreeScan"]);
  for (const hook of Object.values(seams))
    if (typeof hook !== "function") fail("OPTIONS_INVALID", "A test seam must be a function.");
  return observe(await canonicalRoot(captured.workspaceRoot), baseline, seams);
}

async function readArtifact(target) {
  let handle;
  try {
    const before = await lstat(target, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1n ||
      before.size === 0n ||
      before.size > BigInt(MAX_ARTIFACT_BYTES) ||
      (await realpath(target)) !== target
    )
      throw new Error();
    handle = await open(target, READ_FLAGS);
    const opened = await handle.stat({ bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size)
      throw new Error();
    const allocated = Buffer.alloc(MAX_ARTIFACT_BYTES + 1);
    let used = 0;
    while (used < allocated.length) {
      const { bytesRead } = await handle.read(allocated, used, allocated.length - used, used);
      if (bytesRead === 0) break;
      used += bytesRead;
    }
    if (used > MAX_ARTIFACT_BYTES) throw new Error();
    const bytes = allocated.subarray(0, used);
    const after = await handle.stat({ bigint: true });
    const linked = await lstat(target, { bigint: true });
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs ||
      linked.dev !== before.dev ||
      linked.ino !== before.ino ||
      bytes.length !== Number(before.size)
    )
      throw new Error();
    return bytes;
  } catch {
    fail("ARTIFACT_UNSAFE", "Artifact must be one bounded stable regular file.");
  } finally {
    await handle?.close();
  }
}

/** Writes canonical baseline data once with exclusive creation; an existing different file is never overwritten. */
export async function writeRuntimeCoreBaseline(rawOptions) {
  const captured = record(rawOptions, ["artifactPath", "baseline"]);
  const target = absolutePath(captured.artifactPath, "Artifact");
  try {
    if ((await realpath(path.dirname(target))) !== path.dirname(target)) throw new Error();
  } catch {
    fail("ARTIFACT_UNSAFE", "Artifact parent must be canonical.");
  }
  const bytes = serializeRuntimeCoreBaseline(captured.baseline);
  let created = false;
  let handle;
  try {
    handle = await open(target, "wx", 0o644);
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    if (error?.code !== "EEXIST") fail("ARTIFACT_UNSAFE", "Exclusive artifact creation failed.");
  } finally {
    await handle?.close();
  }
  const actual = await readArtifact(target);
  if (!actual.equals(bytes)) fail("ARTIFACT_DRIFT", "The existing immutable artifact differs.");
  return Object.freeze({
    created,
    path: target,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  });
}

function assertFrozenBaseline(baseline) {
  if (
    !serializeRuntimeCoreBaseline(baseline).equals(
      serializeRuntimeCoreBaseline(RUNTIME_CORE_BASELINE_CAPTURE),
    )
  ) {
    fail("ARTIFACT_DRIFT", "The reviewed T08 capture identity differs.");
  }
}

/** Generates the first reviewed artifact or verifies its unchanged bytes and fresh current Core state. */
export async function writeRuntimeCoreBaselineEvidence(rawOptions = undefined) {
  const captured = options(rawOptions);
  const workspaceRoot = await canonicalRoot(captured.workspaceRoot);
  const artifactPath = path.join(workspaceRoot, RUNTIME_CORE_BASELINE_ARTIFACT_PATH);
  let exists = false;
  try {
    await lstat(artifactPath);
    exists = true;
  } catch (error) {
    if (error?.code !== "ENOENT") fail("ARTIFACT_UNSAFE", "Artifact state is unreadable.");
  }
  if (exists) assertFrozenBaseline(parseRuntimeCoreBaselineBytes(await readArtifact(artifactPath)));
  else assertFrozenBaseline(await captureRuntimeCoreBaseline({ workspaceRoot }));
  await verifyRuntimeCoreBaseline({ workspaceRoot, baseline: RUNTIME_CORE_BASELINE_CAPTURE });
  return writeRuntimeCoreBaseline({ artifactPath, baseline: RUNTIME_CORE_BASELINE_CAPTURE });
}

/** Authenticates the frozen artifact through the existing checkpoint, then freshly verifies current Core without fetching history. */
export async function verifyRuntimeCoreBaselineEvidence(rawOptions = undefined) {
  const captured = options(rawOptions);
  const workspaceRoot = await canonicalRoot(captured.workspaceRoot);
  const frozen = await readCheckpointedFrozenArtifact("M10-T09", { workspaceRoot });
  if (frozen.path !== RUNTIME_CORE_BASELINE_ARTIFACT_PATH)
    fail("ARTIFACT_DRIFT", "Checkpoint baseline path differs.");
  const baseline = parseRuntimeCoreBaselineBytes(frozen.bytes);
  assertFrozenBaseline(baseline);
  const observation = await verifyRuntimeCoreBaseline({ workspaceRoot, baseline });
  const after = await readCheckpointedFrozenArtifact("M10-T09", { workspaceRoot });
  if (after.sha256 !== frozen.sha256 || after.checkpointHeadSha256 !== frozen.checkpointHeadSha256)
    fail("INPUT_RACE", "Frozen baseline authority changed during verification.");
  return Object.freeze({
    status: "PASS",
    task: "M10-T09",
    artifactSha256: frozen.sha256,
    checkpointHeadSha256: frozen.checkpointHeadSha256,
    baseline,
    observation,
  });
}
