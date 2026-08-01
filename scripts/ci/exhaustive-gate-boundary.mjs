import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, readdir, readlink, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify, types as utilTypes } from "node:util";

const EXEC_FILE = promisify(execFileCallback);
const DEFAULT_WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../..");
const PROFILE = "desen.ci.exhaustive-gate-boundary.v1";
const CLEAN_INPUT_PROFILE = "desen.ci.exhaustive-gate-clean-input.v1";
const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_GIT_STATUS_BYTES = 4 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAX_TRACKED_FILE_BYTES = 16 * 1024 * 1024;
const MAX_TRACKED_BYTES = 256 * 1024 * 1024;
const MAX_TRACKED_FILES = 16_384;
const MAX_DIRECTORY_ENTRIES = 8_192;
const MAX_WORKSPACE_PACKAGES = 1_024;
const MAX_SYMLINK_BYTES = 64 * 1024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const TEST_CONFIGURATION_FILE_PATTERN =
  /^(?:vite\.config|vitest\.config|vitest\.workspace)\.[^/]+$/u;
const REVISION_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const INDEX_RECORD_PATTERN =
  /^(100644|100755|120000|160000) ((?:[0-9a-f]{40}|[0-9a-f]{64})) ([0-3])\t(.+)$/u;
const BOUNDARY_OPTION_KEYS = Object.freeze([
  "workspaceRoot",
  "expectedRevision",
  "authenticateInventory",
  "execute",
  "assertCanContinue",
  "readRevisionFunction",
  "readInventoryFunction",
  "captureWorkspaceFunction",
]);

/**
 * Error raised when the neutral exhaustive execution boundary cannot authenticate its inputs or
 * preserve the tracked repository state.
 */
export class ExhaustiveGateBoundaryError extends Error {
  constructor(code, message, details = {}, options = {}) {
    super(message, options);
    this.name = "ExhaustiveGateBoundaryError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}, options = {}) {
  throw new ExhaustiveGateBoundaryError(code, message, details, options);
}

function updateHashField(hash, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  hash.update(`${bytes.byteLength}:`);
  hash.update(bytes);
  hash.update("\0");
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch (error) {
    fail("EXHAUSTIVE_GATE_UTF8_INVALID", `${label} is not valid UTF-8.`, {}, { cause: error });
  }
}

function deepFreezeData(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      deepFreezeData(value[key]);
    }
    Object.freeze(value);
  }
  return value;
}

async function normalizeWorkspaceRoot(workspaceRoot) {
  if (
    typeof workspaceRoot !== "string" ||
    workspaceRoot.length === 0 ||
    workspaceRoot.includes("\0")
  ) {
    fail(
      "EXHAUSTIVE_GATE_WORKSPACE_INVALID",
      "The exhaustive gate workspace root must be one non-empty path string.",
    );
  }
  const absoluteRoot = path.resolve(workspaceRoot);
  let stats;
  let canonicalRoot;
  try {
    stats = await lstat(absoluteRoot);
    canonicalRoot = await realpath(absoluteRoot);
  } catch (error) {
    fail(
      "EXHAUSTIVE_GATE_WORKSPACE_INVALID",
      "The exhaustive gate workspace root is unavailable.",
      { workspaceRoot: absoluteRoot },
      { cause: error },
    );
  }
  if (!stats.isDirectory() || stats.isSymbolicLink() || canonicalRoot !== absoluteRoot) {
    fail(
      "EXHAUSTIVE_GATE_WORKSPACE_INVALID",
      "The exhaustive gate workspace root must be one real non-symbolic directory.",
      { workspaceRoot: absoluteRoot },
    );
  }
  return absoluteRoot;
}

function assertSafeRelativePath(relativePath) {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    relativePath.includes("\0") ||
    relativePath.includes("\\") ||
    path.posix.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath ||
    relativePath === ".." ||
    relativePath.startsWith("../")
  ) {
    fail("EXHAUSTIVE_GATE_PATH_INVALID", "Git returned an unsafe tracked path.", {
      relativePath,
    });
  }
}

async function assertRealParent(workspaceRoot, absolutePath, relativePath) {
  const parentPath = path.dirname(absolutePath);
  let canonicalParent;
  try {
    canonicalParent = await realpath(parentPath);
  } catch (error) {
    fail(
      "EXHAUSTIVE_GATE_FILE_INVALID",
      `The parent of "${relativePath}" is unavailable.`,
      { relativePath },
      { cause: error },
    );
  }
  if (
    canonicalParent !== parentPath ||
    (parentPath !== workspaceRoot && !parentPath.startsWith(`${workspaceRoot}${path.sep}`))
  ) {
    fail(
      "EXHAUSTIVE_GATE_FILE_INVALID",
      `The path "${relativePath}" crosses a symbolic or external parent.`,
      { relativePath },
    );
  }
}

async function readBoundedRegularFile(
  workspaceRoot,
  relativePath,
  { maximumBytes = MAX_MANIFEST_BYTES, allowEmpty = false, allowMissing = false } = {},
) {
  assertSafeRelativePath(relativePath);
  const absolutePath = path.join(workspaceRoot, ...relativePath.split("/"));
  let before;
  try {
    before = await lstat(absolutePath);
  } catch (error) {
    if (allowMissing && error?.code === "ENOENT") return undefined;
    fail(
      "EXHAUSTIVE_GATE_FILE_INVALID",
      `Required repository file "${relativePath}" is unavailable.`,
      { relativePath },
      { cause: error },
    );
  }
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    (!allowEmpty && before.size === 0) ||
    before.size > maximumBytes
  ) {
    fail(
      "EXHAUSTIVE_GATE_FILE_INVALID",
      `Repository file "${relativePath}" is not one bounded regular file.`,
      { relativePath, bytes: before.size, maximumBytes },
    );
  }
  await assertRealParent(workspaceRoot, absolutePath, relativePath);

  let handle;
  try {
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size
    ) {
      fail(
        "EXHAUSTIVE_GATE_FILE_INVALID",
        `Repository file "${relativePath}" changed during secure open.`,
        { relativePath },
      );
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      bytes.byteLength !== opened.size
    ) {
      fail(
        "EXHAUSTIVE_GATE_FILE_INVALID",
        `Repository file "${relativePath}" changed during capture.`,
        { relativePath },
      );
    }
    return bytes;
  } catch (error) {
    if (error instanceof ExhaustiveGateBoundaryError) throw error;
    fail(
      "EXHAUSTIVE_GATE_FILE_INVALID",
      `Repository file "${relativePath}" could not be read safely.`,
      { relativePath },
      { cause: error },
    );
  } finally {
    await handle?.close();
  }
}

async function readBoundedDirectory(workspaceRoot, relativePath) {
  assertSafeRelativePath(relativePath);
  const absolutePath = path.join(workspaceRoot, ...relativePath.split("/"));
  let stats;
  let canonicalPath;
  let entries;
  try {
    stats = await lstat(absolutePath);
    canonicalPath = await realpath(absolutePath);
    entries = await readdir(absolutePath, { withFileTypes: true });
  } catch (error) {
    fail(
      "EXHAUSTIVE_GATE_DIRECTORY_INVALID",
      `Required repository directory "${relativePath}" is unavailable.`,
      { relativePath },
      { cause: error },
    );
  }
  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    canonicalPath !== absolutePath ||
    entries.length > MAX_DIRECTORY_ENTRIES
  ) {
    fail(
      "EXHAUSTIVE_GATE_DIRECTORY_INVALID",
      `Repository directory "${relativePath}" is symbolic, invalid, or over budget.`,
      { relativePath, entries: entries.length, maximumEntries: MAX_DIRECTORY_ENTRIES },
    );
  }
  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

async function runGit(workspaceRoot, args) {
  try {
    return await EXEC_FILE("git", args, {
      cwd: workspaceRoot,
      encoding: "buffer",
      maxBuffer: MAX_GIT_OUTPUT_BYTES,
      windowsHide: true,
    });
  } catch (error) {
    fail(
      "EXHAUSTIVE_GATE_GIT_INVALID",
      `Git could not authenticate the exhaustive gate input: git ${args.join(" ")}.`,
      { args },
      { cause: error },
    );
  }
}

async function readBoundedGitStatus(workspaceRoot) {
  const args = [
    "status",
    "--porcelain=v2",
    "-z",
    "--untracked-files=all",
    "--ignore-submodules=none",
  ];
  try {
    const { stdout } = await EXEC_FILE("git", args, {
      cwd: workspaceRoot,
      encoding: "buffer",
      maxBuffer: MAX_GIT_STATUS_BYTES,
      windowsHide: true,
    });
    return stdout;
  } catch (error) {
    if (error?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
      fail(
        "EXHAUSTIVE_GATE_CLEAN_INPUT_OVER_BUDGET",
        "Git status exceeded the clean-input output budget.",
        { maximumBytes: MAX_GIT_STATUS_BYTES },
        { cause: error },
      );
    }
    fail(
      "EXHAUSTIVE_GATE_GIT_INVALID",
      `Git could not authenticate the exhaustive gate input: git ${args.join(" ")}.`,
      { args },
      { cause: error },
    );
  }
}

/**
 * Reads the exact repository surfaces needed by the reviewed workload-inventory validator.
 *
 * This function discovers data only. It never chooses a command and never treats discovery as an
 * authenticated inventory; callers must pass the result to their code-owned validator.
 */
export async function readExhaustiveGateRepositoryInventory(
  workspaceRoot = DEFAULT_WORKSPACE_ROOT,
) {
  const root = await normalizeWorkspaceRoot(workspaceRoot);
  const packageBytes = await readBoundedRegularFile(root, "package.json");
  const workspaceManifestBytes = await readBoundedRegularFile(root, "pnpm-workspace.yaml");
  let packageJson;
  try {
    packageJson = JSON.parse(decodeUtf8(packageBytes, "package.json"));
  } catch (error) {
    if (error instanceof ExhaustiveGateBoundaryError) throw error;
    fail("EXHAUSTIVE_GATE_JSON_INVALID", "package.json is not valid JSON.", {}, { cause: error });
  }

  const rootEntries = await readdir(root, { withFileTypes: true });
  if (rootEntries.length > MAX_DIRECTORY_ENTRIES) {
    fail("EXHAUSTIVE_GATE_DIRECTORY_INVALID", "The repository root exceeds its entry budget.", {
      entries: rootEntries.length,
      maximumEntries: MAX_DIRECTORY_ENTRIES,
    });
  }
  const scriptEntries = await readBoundedDirectory(root, "scripts");
  const testEntries = await readBoundedDirectory(root, "tests");
  const testConfigurationFiles = rootEntries
    .filter((entry) => TEST_CONFIGURATION_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const workspacePackages = [];

  for (const workspaceDirectory of ["apps", "packages"]) {
    const workspaceEntries = await readBoundedDirectory(root, workspaceDirectory);
    for (const entry of workspaceEntries) {
      if (entry.isSymbolicLink()) {
        fail(
          "EXHAUSTIVE_GATE_DIRECTORY_INVALID",
          `Workspace entry "${workspaceDirectory}/${entry.name}" may not be symbolic.`,
          { relativePath: `${workspaceDirectory}/${entry.name}` },
        );
      }
      if (!entry.isDirectory()) continue;
      if (workspacePackages.length >= MAX_WORKSPACE_PACKAGES) {
        fail(
          "EXHAUSTIVE_GATE_INVENTORY_OVER_BUDGET",
          "The workspace package inventory exceeds its fixed bound.",
          { maximumPackages: MAX_WORKSPACE_PACKAGES },
        );
      }
      const packageDirectory = `${workspaceDirectory}/${entry.name}`;
      const packageEntries = await readBoundedDirectory(root, packageDirectory);
      testConfigurationFiles.push(
        ...packageEntries
          .filter((candidate) => TEST_CONFIGURATION_FILE_PATTERN.test(candidate.name))
          .map((candidate) => `${packageDirectory}/${candidate.name}`),
      );
      const manifestBytes = await readBoundedRegularFile(root, `${packageDirectory}/package.json`, {
        allowMissing: true,
      });
      if (manifestBytes === undefined) continue;
      try {
        workspacePackages.push(
          JSON.parse(decodeUtf8(manifestBytes, `${packageDirectory}/package.json`)),
        );
      } catch (error) {
        if (error instanceof ExhaustiveGateBoundaryError) throw error;
        fail(
          "EXHAUSTIVE_GATE_JSON_INVALID",
          `Workspace manifest "${packageDirectory}/package.json" is not valid JSON.`,
          { relativePath: `${packageDirectory}/package.json` },
          { cause: error },
        );
      }
    }
  }

  return deepFreezeData({
    packageJson,
    verifierFiles: scriptEntries
      .filter(
        (entry) =>
          entry.name.startsWith("verify-") &&
          entry.name.endsWith(".mjs") &&
          entry.name !== "verify-boundary-fixtures.mjs",
      )
      .map((entry) => `scripts/${entry.name}`),
    rootTestFiles: testEntries
      .filter((entry) => entry.name.endsWith(".test.mjs"))
      .map((entry) => `tests/${entry.name}`),
    workspacePackages,
    testConfigurationFiles: testConfigurationFiles.sort(),
    workspaceManifestText: decodeUtf8(workspaceManifestBytes, "pnpm-workspace.yaml"),
  });
}

async function readCurrentExhaustiveGateRevision(workspaceRoot) {
  if (
    typeof workspaceRoot !== "string" ||
    workspaceRoot.length === 0 ||
    !path.isAbsolute(workspaceRoot)
  ) {
    fail("EXHAUSTIVE_GATE_WORKSPACE_INVALID", "The normalized Git workspace is invalid.");
  }
  const { stdout } = await runGit(workspaceRoot, ["rev-parse", "--verify", "HEAD^{commit}"]);
  const revision = decodeUtf8(stdout, "Git revision output").trim();
  if (!REVISION_PATTERN.test(revision)) {
    fail(
      "EXHAUSTIVE_GATE_REVISION_INVALID",
      "Git returned an unsupported exhaustive gate revision.",
      { revision },
    );
  }
  return revision;
}

/**
 * Reads the checked-out commit directly from Git and optionally authenticates the hosted revision.
 */
export async function readExhaustiveGateRevision(
  workspaceRoot = DEFAULT_WORKSPACE_ROOT,
  expectedRevision = process.env.GITHUB_SHA,
) {
  const root = await normalizeWorkspaceRoot(workspaceRoot);
  if (
    expectedRevision !== undefined &&
    (typeof expectedRevision !== "string" || !REVISION_PATTERN.test(expectedRevision))
  ) {
    fail(
      "EXHAUSTIVE_GATE_REVISION_INVALID",
      "The expected exhaustive gate revision is not a lowercase Git object ID.",
      { expectedRevision },
    );
  }
  const revision = await readCurrentExhaustiveGateRevision(root);
  if (expectedRevision !== undefined && revision !== expectedRevision) {
    fail(
      "EXHAUSTIVE_GATE_REVISION_MISMATCH",
      "The checked-out commit differs from the expected hosted revision.",
      { expectedRevision, actualRevision: revision },
    );
  }
  return revision;
}

/**
 * Proves that one checkout is bound to the supplied commit and contains no staged, unstaged,
 * untracked, or submodule changes before exhaustive execution begins.
 *
 * The receipt commits only to the raw porcelain byte count and digest. It deliberately does not
 * decode or disclose repository paths, so arbitrary Git filename bytes cannot weaken the check or
 * leak into hosted logs.
 */
export async function assertExhaustiveGateCleanInput(
  workspaceRoot = DEFAULT_WORKSPACE_ROOT,
  expectedRevision,
) {
  const root = await normalizeWorkspaceRoot(workspaceRoot);
  if (typeof expectedRevision !== "string" || !REVISION_PATTERN.test(expectedRevision)) {
    fail(
      "EXHAUSTIVE_GATE_REVISION_INVALID",
      "A lowercase expected Git object ID is required for the exhaustive clean-input proof.",
      { expectedRevision },
    );
  }

  const revision = await readCurrentExhaustiveGateRevision(root);
  const statusBytes = await readBoundedGitStatus(root);
  const revisionMatches = revision === expectedRevision;
  const clean = statusBytes.byteLength === 0;
  const failureCode = !revisionMatches
    ? "EXHAUSTIVE_GATE_REVISION_MISMATCH"
    : clean
      ? null
      : "EXHAUSTIVE_GATE_INPUT_DIRTY";
  const receipt = deepFreezeData({
    schemaVersion: 1,
    profile: CLEAN_INPUT_PROFILE,
    status: failureCode === null ? "PASS" : "FAIL",
    failureCode,
    expectedRevision,
    revision,
    revisionMatches,
    clean,
    gitStatusBytes: statusBytes.byteLength,
    gitStatusSha256: createHash("sha256").update(statusBytes).digest("hex"),
  });

  if (!revisionMatches) {
    fail(
      "EXHAUSTIVE_GATE_REVISION_MISMATCH",
      "The checked-out commit differs from the expected exhaustive clean-input revision.",
      { expectedRevision, actualRevision: revision, receipt },
    );
  }
  if (!clean) {
    fail("EXHAUSTIVE_GATE_INPUT_DIRTY", "The exhaustive gate requires a clean input checkout.", {
      receipt,
    });
  }
  return receipt;
}

async function captureTrackedPath(workspaceRoot, relativePath, indexMode, worktreeHash) {
  const absolutePath = path.join(workspaceRoot, ...relativePath.split("/"));
  let before;
  try {
    before = await lstat(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      updateHashField(worktreeHash, relativePath);
      updateHashField(worktreeHash, "missing");
      return 0;
    }
    fail(
      "EXHAUSTIVE_GATE_TRACKED_PATH_INVALID",
      `Tracked path "${relativePath}" is unreadable.`,
      { relativePath },
      { cause: error },
    );
  }

  updateHashField(worktreeHash, relativePath);
  await assertRealParent(workspaceRoot, absolutePath, relativePath);
  if (before.isSymbolicLink()) {
    let target;
    let after;
    try {
      target = await readlink(absolutePath, { encoding: "buffer" });
      after = await lstat(absolutePath);
    } catch (error) {
      fail(
        "EXHAUSTIVE_GATE_TRACKED_PATH_INVALID",
        `Tracked symbolic path "${relativePath}" changed during capture.`,
        { relativePath },
        { cause: error },
      );
    }
    if (
      target.byteLength > MAX_SYMLINK_BYTES ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.mode !== before.mode
    ) {
      fail(
        "EXHAUSTIVE_GATE_TRACKED_PATH_INVALID",
        `Tracked symbolic path "${relativePath}" is unstable or over budget.`,
        { relativePath, bytes: target.byteLength },
      );
    }
    updateHashField(worktreeHash, "symlink");
    updateHashField(worktreeHash, before.mode & 0o111 ? "executable" : "not-executable");
    updateHashField(worktreeHash, target);
    return target.byteLength;
  }

  if (!before.isFile() || before.size > MAX_TRACKED_FILE_BYTES) {
    fail(
      "EXHAUSTIVE_GATE_TRACKED_PATH_INVALID",
      `Tracked path "${relativePath}" is not one bounded regular file.`,
      { relativePath, bytes: before.size, maximumBytes: MAX_TRACKED_FILE_BYTES, indexMode },
    );
  }
  let handle;
  try {
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size ||
      opened.mode !== before.mode
    ) {
      fail(
        "EXHAUSTIVE_GATE_TRACKED_PATH_INVALID",
        `Tracked path "${relativePath}" changed during secure open.`,
        { relativePath },
      );
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.mode !== opened.mode ||
      bytes.byteLength !== opened.size
    ) {
      fail(
        "EXHAUSTIVE_GATE_TRACKED_PATH_INVALID",
        `Tracked path "${relativePath}" changed during capture.`,
        { relativePath },
      );
    }
    updateHashField(worktreeHash, "file");
    updateHashField(worktreeHash, opened.mode & 0o111 ? "executable" : "not-executable");
    updateHashField(worktreeHash, bytes);
    return bytes.byteLength;
  } catch (error) {
    if (error instanceof ExhaustiveGateBoundaryError) throw error;
    fail(
      "EXHAUSTIVE_GATE_TRACKED_PATH_INVALID",
      `Tracked path "${relativePath}" could not be captured safely.`,
      { relativePath },
      { cause: error },
    );
  } finally {
    await handle?.close();
  }
}

/**
 * Captures Git index mode/object identity plus current tracked bytes and executable modes.
 */
export async function captureExhaustiveGateWorkspace(workspaceRoot = DEFAULT_WORKSPACE_ROOT) {
  const root = await normalizeWorkspaceRoot(workspaceRoot);
  const { stdout } = await runGit(root, ["ls-files", "--stage", "-z"]);
  const records = decodeUtf8(stdout, "Git tracked-path inventory").split("\0");
  if (records.at(-1) !== "") {
    fail(
      "EXHAUSTIVE_GATE_GIT_INVALID",
      "Git tracked-path inventory is missing its NUL terminator.",
    );
  }
  records.pop();
  if (records.length > MAX_TRACKED_FILES) {
    fail(
      "EXHAUSTIVE_GATE_INVENTORY_OVER_BUDGET",
      "The tracked workspace exceeds its fixed file-count bound.",
      { trackedFileCount: records.length, maximumTrackedFiles: MAX_TRACKED_FILES },
    );
  }

  const indexHash = createHash("sha256");
  const worktreeHash = createHash("sha256");
  const trackedPaths = new Set();
  let trackedBytes = 0;

  for (const record of records) {
    const match = INDEX_RECORD_PATTERN.exec(record);
    if (match === null) {
      fail("EXHAUSTIVE_GATE_GIT_INVALID", "Git returned an unreadable tracked-file record.", {
        record,
      });
    }
    const [, indexMode, indexObjectId, stage, relativePath] = match;
    assertSafeRelativePath(relativePath);
    if (stage !== "0" || trackedPaths.has(relativePath)) {
      fail(
        "EXHAUSTIVE_GATE_GIT_INVALID",
        "The tracked workspace contains an unresolved or duplicate index record.",
        { relativePath, stage },
      );
    }
    trackedPaths.add(relativePath);
    updateHashField(indexHash, relativePath);
    updateHashField(indexHash, indexMode);
    updateHashField(indexHash, indexObjectId);
    updateHashField(indexHash, stage);
    trackedBytes += await captureTrackedPath(root, relativePath, indexMode, worktreeHash);
    if (trackedBytes > MAX_TRACKED_BYTES) {
      fail(
        "EXHAUSTIVE_GATE_INVENTORY_OVER_BUDGET",
        "The tracked workspace exceeds its fixed byte bound.",
        { trackedBytes, maximumTrackedBytes: MAX_TRACKED_BYTES },
      );
    }
  }

  const indexSha256 = indexHash.digest("hex");
  const worktreeSha256 = worktreeHash.digest("hex");
  const combinedHash = createHash("sha256");
  updateHashField(combinedHash, PROFILE);
  updateHashField(combinedHash, records.length);
  updateHashField(combinedHash, trackedBytes);
  updateHashField(combinedHash, indexSha256);
  updateHashField(combinedHash, worktreeSha256);
  return Object.freeze({
    profile: PROFILE,
    digest: combinedHash.digest("hex"),
    indexSha256,
    worktreeSha256,
    trackedFileCount: records.length,
    trackedBytes,
  });
}

function assertWorkspaceReceipt(value, label) {
  const keys = [
    "profile",
    "digest",
    "indexSha256",
    "worktreeSha256",
    "trackedFileCount",
    "trackedBytes",
  ];
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value) ||
    Reflect.ownKeys(value).length !== keys.length
  ) {
    fail("EXHAUSTIVE_GATE_WORKSPACE_RECEIPT_INVALID", `${label} is not one exact receipt.`);
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "EXHAUSTIVE_GATE_WORKSPACE_RECEIPT_INVALID",
        `${label} contains an accessor-backed or missing field.`,
        { key },
      );
    }
  }
  if (
    value.profile !== PROFILE ||
    !SHA256_PATTERN.test(value.digest) ||
    !SHA256_PATTERN.test(value.indexSha256) ||
    !SHA256_PATTERN.test(value.worktreeSha256) ||
    !Number.isSafeInteger(value.trackedFileCount) ||
    value.trackedFileCount < 0 ||
    value.trackedFileCount > MAX_TRACKED_FILES ||
    !Number.isSafeInteger(value.trackedBytes) ||
    value.trackedBytes < 0 ||
    value.trackedBytes > MAX_TRACKED_BYTES
  ) {
    fail("EXHAUSTIVE_GATE_WORKSPACE_RECEIPT_INVALID", `${label} contains an unsupported value.`);
  }
  return value;
}

/**
 * Rejects any index object, index mode, tracked byte, file kind, or executable-mode drift.
 */
export function assertExhaustiveGateWorkspaceUnchanged(before, after) {
  const trustedBefore = assertWorkspaceReceipt(before, "The opening workspace receipt");
  const trustedAfter = assertWorkspaceReceipt(after, "The closing workspace receipt");
  if (
    trustedBefore.digest !== trustedAfter.digest ||
    trustedBefore.indexSha256 !== trustedAfter.indexSha256 ||
    trustedBefore.worktreeSha256 !== trustedAfter.worktreeSha256 ||
    trustedBefore.trackedFileCount !== trustedAfter.trackedFileCount ||
    trustedBefore.trackedBytes !== trustedAfter.trackedBytes
  ) {
    fail(
      "EXHAUSTIVE_GATE_WORKSPACE_CHANGED",
      "An exhaustive gate workload changed tracked workspace bytes, modes, or Git index identity.",
      { before: trustedBefore, after: trustedAfter },
    );
  }
}

function normalizeBoundaryOptions(rawOptions) {
  if (
    rawOptions === null ||
    typeof rawOptions !== "object" ||
    utilTypes.isProxy(rawOptions) ||
    Array.isArray(rawOptions) ||
    Object.getPrototypeOf(rawOptions) !== Object.prototype
  ) {
    fail(
      "EXHAUSTIVE_GATE_OPTIONS_INVALID",
      "Exhaustive gate options must be one ordinary own-data record.",
    );
  }
  const keys = Reflect.ownKeys(rawOptions);
  for (const key of keys) {
    const descriptor =
      typeof key === "string" ? Object.getOwnPropertyDescriptor(rawOptions, key) : undefined;
    if (
      typeof key !== "string" ||
      !BOUNDARY_OPTION_KEYS.includes(key) ||
      !descriptor ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail(
        "EXHAUSTIVE_GATE_OPTIONS_INVALID",
        "Exhaustive gate options contain an unknown or accessor-backed field.",
        { key: typeof key === "string" ? key : String(key) },
      );
    }
  }
  for (const requiredFunction of ["authenticateInventory", "execute"]) {
    if (typeof rawOptions[requiredFunction] !== "function") {
      fail(
        "EXHAUSTIVE_GATE_OPTIONS_INVALID",
        `Exhaustive gate option "${requiredFunction}" must be a function.`,
      );
    }
  }
  for (const optionalFunction of [
    "assertCanContinue",
    "readRevisionFunction",
    "readInventoryFunction",
    "captureWorkspaceFunction",
  ]) {
    if (
      rawOptions[optionalFunction] !== undefined &&
      typeof rawOptions[optionalFunction] !== "function"
    ) {
      fail(
        "EXHAUSTIVE_GATE_OPTIONS_INVALID",
        `Exhaustive gate option "${optionalFunction}" must be a function when present.`,
      );
    }
  }
  return rawOptions;
}

function errorProjection(error) {
  return Object.freeze({
    name: error instanceof Error ? error.name : "NonErrorFailure",
    message: error instanceof Error ? error.message : String(error),
  });
}

function attachBoundaryEvidence(primaryError, receipt, workspaceError) {
  if (primaryError instanceof Error && Object.isExtensible(primaryError)) {
    Object.defineProperty(primaryError, "exhaustiveGateReceipt", {
      value: receipt,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    if (workspaceError) {
      Object.defineProperty(primaryError, "exhaustiveGateWorkspaceError", {
        value: workspaceError,
        enumerable: false,
        configurable: false,
        writable: false,
      });
    }
    return primaryError;
  }
  return new ExhaustiveGateBoundaryError(
    "EXHAUSTIVE_GATE_EXECUTION_FAILED",
    "The exhaustive workload failed inside the neutral execution boundary.",
    {
      primary: errorProjection(primaryError),
      workspace: workspaceError ? errorProjection(workspaceError) : undefined,
      receipt,
    },
    { cause: primaryError },
  );
}

/**
 * Authenticates repository inventory and revision, runs one caller-owned exhaustive workload, and
 * always compares fresh opening and closing tracked-workspace receipts.
 *
 * The boundary does not own executable commands. `authenticateInventory` and `execute` are
 * mandatory so a caller cannot accidentally interpret discovery as authority or report success
 * without running its reviewed exhaustive plan.
 */
export async function executeExhaustiveGateBoundary(rawOptions) {
  const options = normalizeBoundaryOptions(rawOptions);
  const workspaceRoot = await normalizeWorkspaceRoot(
    options.workspaceRoot ?? DEFAULT_WORKSPACE_ROOT,
  );
  const readRevisionFunction = options.readRevisionFunction ?? readExhaustiveGateRevision;
  const readInventoryFunction =
    options.readInventoryFunction ?? readExhaustiveGateRepositoryInventory;
  const captureWorkspaceFunction =
    options.captureWorkspaceFunction ?? captureExhaustiveGateWorkspace;
  const startedAt = performance.now();
  let revision;
  let authenticatedInventory;
  let before;
  let after;
  let execution;
  let primaryError;
  let workspaceError;

  try {
    options.assertCanContinue?.();
    revision = await readRevisionFunction(workspaceRoot, options.expectedRevision);
    options.assertCanContinue?.();
    const discoveredInventory = await readInventoryFunction(workspaceRoot);
    authenticatedInventory = await options.authenticateInventory(discoveredInventory);
    if (authenticatedInventory === undefined) {
      fail(
        "EXHAUSTIVE_GATE_INVENTORY_UNAUTHENTICATED",
        "The code-owned inventory validator returned no authenticated receipt.",
      );
    }
    options.assertCanContinue?.();
    before = assertWorkspaceReceipt(
      await captureWorkspaceFunction(workspaceRoot),
      "The opening workspace receipt",
    );
    options.assertCanContinue?.();
    execution = await options.execute(
      Object.freeze({ workspaceRoot, revision, inventory: authenticatedInventory }),
    );
    options.assertCanContinue?.();
  } catch (error) {
    primaryError = error;
  }

  if (before) {
    try {
      after = assertWorkspaceReceipt(
        await captureWorkspaceFunction(workspaceRoot),
        "The closing workspace receipt",
      );
      assertExhaustiveGateWorkspaceUnchanged(before, after);
    } catch (error) {
      workspaceError = error;
    }
    try {
      options.assertCanContinue?.();
    } catch (error) {
      primaryError ??= error;
    }
  }

  const failed = primaryError !== undefined || workspaceError !== undefined;
  const receipt = deepFreezeData({
    schemaVersion: 1,
    profile: PROFILE,
    status: failed ? "FAIL" : "PASS",
    revision,
    inventory: authenticatedInventory,
    workspaceBefore: before,
    workspaceAfter: after,
    trackedFileCount: before?.trackedFileCount ?? 0,
    durationMs: performance.now() - startedAt,
    execution,
    error: primaryError ? errorProjection(primaryError) : undefined,
    workspaceError: workspaceError ? errorProjection(workspaceError) : undefined,
  });

  if (primaryError) {
    throw attachBoundaryEvidence(primaryError, receipt, workspaceError);
  }
  if (workspaceError) {
    if (Object.isExtensible(workspaceError)) {
      Object.defineProperty(workspaceError, "exhaustiveGateReceipt", {
        value: receipt,
        enumerable: false,
        configurable: false,
        writable: false,
      });
    }
    throw workspaceError;
  }
  return receipt;
}
