import { execFile as execFileCallback, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, readlink, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const EXEC_FILE = promisify(execFileCallback);
const DEFAULT_WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../..");
const DEFAULT_BASE = "origin/main";
const REVISION_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const RAW_HEADER_PATTERN =
  /^:([0-7]{6}) ([0-7]{6}) ((?:[0-9a-f]{40}|[0-9a-f]{64})) ((?:[0-9a-f]{40}|[0-9a-f]{64})) ([A-Z][0-9]*)$/u;
const SAFE_REGULAR_MODES = Object.freeze(["100644", "100755"]);
const STATUS_MODES = Object.freeze(["000000", "100644", "100755", "120000", "160000"]);
const FOCUSED_PATH_PATTERN = /^(apps|packages)\/([^/]+)\/(src|test|test-d|dev)\/(.+)$/u;
// Only workspace-root build outputs are local/non-authoritative; same-name nested trees stay audited.
const GENERATED_WORKSPACE_DIRECTORIES = Object.freeze([
  ".t09-proof-temp",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const SENSITIVE_ROOT_TREES = Object.freeze([
  ".changeset",
  ".github",
  "docs",
  "e2e",
  "examples",
  "scripts",
  "tests",
  "tooling",
]);
// `.desen/**` is repository-ignored state created by dedicated local runtime profiles, not source.
const FOCUSED_UNTRACKED_PATHSPECS = Object.freeze([
  ":(top,glob)*",
  ...SENSITIVE_ROOT_TREES.map((directory) => `:(top,glob)${directory}/**`),
  ":(top,glob)apps/*/**",
  ":(top,glob)packages/*/**",
  ...["apps", "packages"].flatMap((root) =>
    GENERATED_WORKSPACE_DIRECTORIES.map(
      (directory) => `:(top,exclude,glob)${root}/*/${directory}/**`,
    ),
  ),
]);
const HIDDEN_CONFIGURATION_BASENAME_PATTERN =
  /^\.(?:babelrc|browserslistrc|commitlintrc|editorconfig|eslintignore|eslintrc|gitattributes|gitignore|lintstagedrc|npmrc|nvmrc|prettierignore|prettierrc|stylelintignore|stylelintrc|swcrc|yarnrc)(?:\..*)?$/iu;
const LOCK_OR_WORKSPACE_BASENAME_PATTERN =
  /^(?:bun\.lockb?|npm-shrinkwrap\.json|package-lock\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|yarn\.lock|.+\.code-workspace)$/iu;
const PACKAGE_NAME_PATTERN = /^(?:@desen\/[a-z0-9][a-z0-9-]*|desen)$/u;
const REQUIRED_WORKSPACE_SCRIPTS = Object.freeze(["build", "typecheck", "lint", "test"]);
/** Exact reviewed workspace commands eligible for non-authoritative focused feedback. */
export const LOCAL_PREFLIGHT_REVIEWED_SCRIPT_ALLOWLIST = Object.freeze({
  build: Object.freeze([
    "node scripts/clean-dist.mjs && tsc -p tsconfig.build.json",
    "pnpm run build:authoring && pnpm run build:host",
    "tsc -p tsconfig.build.json",
    "tsc -p tsconfig.build.json && node scripts/copy-styles.mjs",
    "vite build",
  ]),
  typecheck: Object.freeze([
    "tsc -p tsconfig.json --noEmit",
    "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.local-dev.json --noEmit",
  ]),
  lint: Object.freeze([
    "eslint . --max-warnings=0",
    "eslint src --max-warnings=0",
    "eslint src test --max-warnings=0",
    "eslint src test dev --max-warnings=0",
    "eslint src test scripts --max-warnings=0",
    "eslint src test test-d --max-warnings=0",
  ]),
  test: Object.freeze([
    "vitest run",
    "vitest run --passWithNoTests",
    "vitest run test/canonicalization.test.ts test/diagnostics.test.ts",
  ]),
});
const MAXIMUM_METADATA_BYTES = 64 * 1024;
const MAXIMUM_STATUS_BYTES = 4 * 1024 * 1024;
const MAXIMUM_DIFF_BYTES = 32 * 1024 * 1024;
const MAXIMUM_MANIFEST_BYTES = 1024 * 1024;
const MAXIMUM_UNTRACKED_BYTES = 32 * 1024 * 1024;
const MAXIMUM_TRACKED_INDEX_BYTES = 16 * 1024 * 1024;
const MAXIMUM_PATH_BYTES = 4 * 1024;
const MAXIMUM_CHANGE_RECORDS = 2_048;
const MAXIMUM_STATUS_RECORDS = 4_096;
const MAXIMUM_TRACKED_INDEX_RECORDS = 16_384;
const GIT_TIMEOUT_MS = 15_000;
const FOUR_GIB_NODE_OPTIONS = "--max-old-space-size=4096";
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

/** This command is developer feedback only. It never mints required or passing authority. */
export const LOCAL_PREFLIGHT_PROFILE = "desen.ci.local-preflight.v1";

export class LocalPreflightError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "LocalPreflightError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

class LocalPreflightFallback extends Error {
  constructor(reason, message = reason) {
    super(message);
    this.name = "LocalPreflightFallback";
    this.reason = reason;
  }
}

function fallback(reason, message) {
  throw new LocalPreflightFallback(reason, message);
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function splitNulRecords(bytes, maximumRecords, malformedReason, overBudgetReason) {
  if (!Buffer.isBuffer(bytes)) fallback(malformedReason);
  if (bytes.byteLength === 0) return [];
  if (bytes.at(-1) !== 0) fallback(malformedReason);
  const records = [];
  let start = 0;
  for (let index = 0; index < bytes.byteLength; index += 1) {
    if (bytes[index] !== 0) continue;
    if (index === start) fallback(malformedReason);
    records.push(bytes.subarray(start, index));
    if (records.length > maximumRecords) fallback(overBudgetReason);
    start = index + 1;
  }
  if (start !== bytes.byteLength) fallback(malformedReason);
  return records;
}

function decodeUtf8(bytes, reason) {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    fallback(reason);
  }
}

function decodeSafePath(bytes, reason = "PATH_UNSAFE") {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength === 0 || bytes.byteLength > MAXIMUM_PATH_BYTES) {
    fallback(reason);
  }
  const candidate = decodeUtf8(bytes, reason);
  if (
    candidate.length === 0 ||
    candidate.includes("\\") ||
    /[\p{Cc}\p{Cf}]/u.test(candidate) ||
    path.posix.isAbsolute(candidate) ||
    path.posix.normalize(candidate) !== candidate ||
    candidate === "." ||
    candidate === ".." ||
    candidate.startsWith("../") ||
    candidate.normalize("NFC") !== candidate
  ) {
    fallback(reason);
  }
  return candidate;
}

function assertUniquePaths(paths, reason) {
  const exact = new Set();
  const normalized = new Map();
  for (const relativePath of paths) {
    if (exact.has(relativePath)) fallback(reason);
    exact.add(relativePath);
    const normalizationKey = relativePath.normalize("NFKC");
    const previous = normalized.get(normalizationKey);
    if (previous !== undefined && previous !== relativePath) fallback(reason);
    normalized.set(normalizationKey, relativePath);
  }
}

/** Parses bounded `git diff --raw -z --no-renames` output without lossy string splitting. */
export function parseLocalPreflightRawDiff(bytes, objectIdLength) {
  if (![40, 64].includes(objectIdLength)) fallback("DIFF_MALFORMED");
  const records = splitNulRecords(
    bytes,
    MAXIMUM_CHANGE_RECORDS * 3,
    "DIFF_MALFORMED",
    "DIFF_OVER_BUDGET",
  );
  const changes = [];
  const allPaths = [];
  for (let index = 0; index < records.length;) {
    const header = decodeUtf8(records[index], "DIFF_MALFORMED");
    index += 1;
    const match = RAW_HEADER_PATTERN.exec(header);
    if (match === null) fallback("DIFF_MALFORMED");
    const [, beforeMode, afterMode, beforeObjectId, afterObjectId, status] = match;
    if (beforeObjectId.length !== objectIdLength || afterObjectId.length !== objectIdLength) {
      fallback("DIFF_MALFORMED");
    }
    const pathCount = status.startsWith("R") || status.startsWith("C") ? 2 : 1;
    if (index + pathCount > records.length) fallback("DIFF_MALFORMED");
    const paths = [];
    for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
      const relativePath = decodeSafePath(records[index], "DIFF_MALFORMED");
      index += 1;
      paths.push(relativePath);
      allPaths.push(relativePath);
    }
    changes.push({
      status,
      path: paths.at(-1),
      sourcePath: pathCount === 2 ? paths[0] : null,
      beforeMode,
      afterMode,
      beforeObjectId,
      afterObjectId,
    });
    if (changes.length > MAXIMUM_CHANGE_RECORDS) fallback("DIFF_OVER_BUDGET");
  }
  assertUniquePaths(allPaths, "PATH_COLLISION");
  changes.sort((left, right) => compareUtf8(left.path, right.path));
  return deepFreeze(changes);
}

function parseOrdinaryStatus(record) {
  const match =
    /^1 ([^ ]{2}) ([^ ]+) ([0-7]{6}) ([0-7]{6}) ([0-7]{6}) ([0-9a-f]+) ([0-9a-f]+) (.+)$/u.exec(
      record,
    );
  if (match === null) fallback("STATUS_MALFORMED");
  const [, xy, submodule, headMode, indexMode, worktreeMode, headObjectId, indexObjectId, rawPath] =
    match;
  if (
    ![headMode, indexMode, worktreeMode].every((mode) => STATUS_MODES.includes(mode)) ||
    !REVISION_PATTERN.test(headObjectId) ||
    !REVISION_PATTERN.test(indexObjectId) ||
    headObjectId.length !== indexObjectId.length
  ) {
    fallback("STATUS_MALFORMED");
  }
  const relativePath = decodeSafePath(Buffer.from(rawPath), "STATUS_MALFORMED");
  return {
    kind: "ORDINARY",
    xy,
    submodule,
    headMode,
    indexMode,
    worktreeMode,
    headObjectId,
    indexObjectId,
    path: relativePath,
  };
}

/** Parses porcelain-v2 records, including the extra original path owned by rename/copy records. */
export function parseLocalPreflightStatus(bytes) {
  const records = splitNulRecords(
    bytes,
    MAXIMUM_STATUS_RECORDS * 2,
    "STATUS_MALFORMED",
    "STATUS_OVER_BUDGET",
  );
  const parsed = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = decodeUtf8(records[index], "STATUS_MALFORMED");
    if (record.startsWith("1 ")) {
      parsed.push(parseOrdinaryStatus(record));
      continue;
    }
    if (record.startsWith("2 ")) {
      const match =
        /^2 ([^ ]{2}) ([^ ]+) ([0-7]{6}) ([0-7]{6}) ([0-7]{6}) ([0-9a-f]+) ([0-9a-f]+) ([RC][0-9]+) (.+)$/u.exec(
          record,
        );
      if (match === null || index + 1 >= records.length) fallback("STATUS_MALFORMED");
      const destinationPath = decodeSafePath(Buffer.from(match[9]), "STATUS_MALFORMED");
      const sourcePath = decodeSafePath(records[index + 1], "STATUS_MALFORMED");
      index += 1;
      parsed.push({ kind: "RENAMED_OR_COPIED", path: destinationPath, sourcePath });
      continue;
    }
    if (record.startsWith("u ")) {
      const fields = record.split(" ");
      if (fields.length < 11) fallback("STATUS_MALFORMED");
      parsed.push({
        kind: "UNMERGED",
        path: decodeSafePath(Buffer.from(fields.slice(10).join(" ")), "STATUS_MALFORMED"),
      });
      continue;
    }
    if (record.startsWith("? ") || record.startsWith("! ")) {
      parsed.push({
        kind: record.startsWith("? ") ? "UNTRACKED" : "IGNORED",
        path: decodeSafePath(Buffer.from(record.slice(2)), "STATUS_MALFORMED"),
      });
      continue;
    }
    fallback("STATUS_MALFORMED");
  }
  if (parsed.length > MAXIMUM_STATUS_RECORDS) fallback("STATUS_OVER_BUDGET");
  assertUniquePaths(
    parsed.flatMap((entry) => [entry.path, ...(entry.sourcePath ? [entry.sourcePath] : [])]),
    "PATH_COLLISION",
  );
  return deepFreeze(parsed);
}

function gitEnvironment() {
  const environment = {
    GIT_CONFIG_COUNT: "0",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    LANG: "C",
    LC_ALL: "C",
  };
  for (const key of ["PATH", "SYSTEMROOT", "WINDIR", "TMPDIR", "TEMP", "TMP"]) {
    if (typeof process.env[key] === "string") environment[key] = process.env[key];
  }
  return environment;
}

async function defaultRunGit(workspaceRoot, args, maximumBytes, signal) {
  try {
    const { stdout, stderr } = await EXEC_FILE(
      "git",
      [
        "--no-optional-locks",
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.untrackedCache=false",
        "-c",
        "core.fileMode=true",
        ...args,
      ],
      {
        cwd: workspaceRoot,
        encoding: "buffer",
        env: gitEnvironment(),
        maxBuffer: maximumBytes,
        ...(signal ? { signal } : {}),
        timeout: GIT_TIMEOUT_MS,
        windowsHide: true,
      },
    );
    return { status: 0, stdout, stderr };
  } catch (error) {
    if (Number.isSafeInteger(error?.code)) {
      return {
        status: error.code,
        stdout: Buffer.isBuffer(error.stdout) ? error.stdout : Buffer.alloc(0),
        stderr: Buffer.isBuffer(error.stderr) ? error.stderr : Buffer.alloc(0),
      };
    }
    fallback("GIT_FAILURE");
  }
}

function validateGitResult(candidate, maximumBytes) {
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    !Number.isSafeInteger(candidate.status) ||
    candidate.status < 0 ||
    candidate.status > 255 ||
    !Buffer.isBuffer(candidate.stdout) ||
    !Buffer.isBuffer(candidate.stderr) ||
    candidate.stdout.byteLength > maximumBytes ||
    candidate.stderr.byteLength > maximumBytes
  ) {
    fallback("GIT_RESULT_INVALID");
  }
  return candidate;
}

async function observeGit(runGit, workspaceRoot, args, maximumBytes) {
  try {
    return validateGitResult(
      await runGit(workspaceRoot, Object.freeze([...args]), maximumBytes),
      maximumBytes,
    );
  } catch (error) {
    if (error instanceof LocalPreflightFallback) throw error;
    fallback("GIT_FAILURE");
  }
}

function decodeMetadataOutput(result, failureReason) {
  if (result.status !== 0 || result.stderr.byteLength !== 0) fallback(failureReason);
  const output = decodeUtf8(result.stdout, "GIT_RESULT_INVALID");
  if (!output.endsWith("\n") || output.endsWith("\n\n") || output.includes("\r")) {
    fallback("GIT_RESULT_INVALID");
  }
  return output.slice(0, -1);
}

async function resolveRevision(runGit, workspaceRoot, revision, failureReason) {
  if (
    typeof revision !== "string" ||
    revision.length === 0 ||
    revision.length > 1_024 ||
    revision.startsWith("-") ||
    revision.includes("\0")
  ) {
    fallback("BASE_INVALID");
  }
  const result = await observeGit(
    runGit,
    workspaceRoot,
    ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`],
    MAXIMUM_METADATA_BYTES,
  );
  const resolved = decodeMetadataOutput(result, failureReason);
  if (!REVISION_PATTERN.test(resolved)) fallback("GIT_RESULT_INVALID");
  return resolved;
}

async function readUniqueMergeBase(runGit, workspaceRoot, baseRevision, headRevision) {
  const result = await observeGit(
    runGit,
    workspaceRoot,
    ["merge-base", "--all", baseRevision, headRevision],
    MAXIMUM_METADATA_BYTES,
  );
  const output = decodeMetadataOutput(result, "MERGE_BASE_UNAVAILABLE");
  const revisions = output.split("\n");
  if (
    revisions.length !== 1 ||
    !REVISION_PATTERN.test(revisions[0]) ||
    revisions[0].length !== headRevision.length
  ) {
    fallback("MERGE_BASE_AMBIGUOUS");
  }
  return revisions[0];
}

function parseTrackedIndex(bytes) {
  const records = splitNulRecords(
    bytes,
    MAXIMUM_TRACKED_INDEX_RECORDS,
    "TRACKED_INDEX_MALFORMED",
    "TRACKED_INDEX_OVER_BUDGET",
  );
  const entries = records.map((record) => {
    if (record.byteLength < 3 || record[1] !== 0x20) fallback("TRACKED_INDEX_MALFORMED");
    const tag = decodeUtf8(record.subarray(0, 1), "TRACKED_INDEX_MALFORMED");
    if (!/^[A-Za-z?]$/u.test(tag)) fallback("TRACKED_INDEX_MALFORMED");
    return {
      tag,
      path: decodeSafePath(record.subarray(2), "TRACKED_INDEX_MALFORMED"),
    };
  });
  assertUniquePaths(
    entries.map(({ path: relativePath }) => relativePath),
    "TRACKED_INDEX_MALFORMED",
  );
  return entries.sort((left, right) => compareUtf8(left.path, right.path));
}

function parsePathList(bytes, malformedReason, overBudgetReason) {
  const records = splitNulRecords(bytes, MAXIMUM_STATUS_RECORDS, malformedReason, overBudgetReason);
  const paths = records.map((record) => decodeSafePath(record, malformedReason));
  assertUniquePaths(paths, "PATH_COLLISION");
  return paths.sort(compareUtf8);
}

function decodeOptionalBooleanConfig(result) {
  if (result.status === 1 && result.stdout.byteLength === 0 && result.stderr.byteLength === 0) {
    return null;
  }
  if (result.status !== 0 || result.stderr.byteLength !== 0) fallback("GIT_RESULT_INVALID");
  const value = decodeMetadataOutput(result, "GIT_RESULT_INVALID");
  if (value === "true") return true;
  if (value === "false") return false;
  fallback("GIT_RESULT_INVALID");
}

async function captureRepositoryBoundary(runGit, workspaceRoot) {
  const [topLevelResult, shallowResult, sparseResult, trackedIndexResult, eligibleResult] =
    await Promise.all([
      observeGit(runGit, workspaceRoot, ["rev-parse", "--show-toplevel"], MAXIMUM_METADATA_BYTES),
      observeGit(
        runGit,
        workspaceRoot,
        ["rev-parse", "--is-shallow-repository"],
        MAXIMUM_METADATA_BYTES,
      ),
      observeGit(
        runGit,
        workspaceRoot,
        ["config", "--bool", "--get", "core.sparseCheckout"],
        MAXIMUM_METADATA_BYTES,
      ),
      observeGit(runGit, workspaceRoot, ["ls-files", "-v", "-z"], MAXIMUM_TRACKED_INDEX_BYTES),
      observeGit(
        runGit,
        workspaceRoot,
        ["ls-files", "--others", "-z", "--", ...FOCUSED_UNTRACKED_PATHSPECS],
        MAXIMUM_STATUS_BYTES,
      ),
    ]);
  const topLevel = decodeMetadataOutput(topLevelResult, "WORKSPACE_UNSAFE");
  if (topLevel.includes("\n")) fallback("GIT_RESULT_INVALID");
  const shallow = decodeMetadataOutput(shallowResult, "GIT_FAILURE");
  if (!["true", "false"].includes(shallow)) fallback("GIT_RESULT_INVALID");
  const sparseCheckout = decodeOptionalBooleanConfig(sparseResult);
  if (
    trackedIndexResult.status !== 0 ||
    trackedIndexResult.stderr.byteLength !== 0 ||
    eligibleResult.status !== 0 ||
    eligibleResult.stderr.byteLength !== 0
  ) {
    fallback("GIT_FAILURE");
  }
  const trackedIndexEntries = parseTrackedIndex(trackedIndexResult.stdout);
  const eligibleUntrackedPaths = parsePathList(
    eligibleResult.stdout,
    "ELIGIBLE_UNTRACKED_LIST_MALFORMED",
    "STATUS_OVER_BUDGET",
  );
  return deepFreeze({
    topLevel,
    shallow: shallow === "true",
    sparseCheckout,
    trackedIndexEntries,
    trackedIndexSha256: sha256(trackedIndexResult.stdout),
    eligibleUntrackedPaths,
  });
}

function assertRepositoryBoundary(boundary, workspaceRoot) {
  if (path.resolve(boundary.topLevel) !== workspaceRoot) fallback("WORKSPACE_UNSAFE");
  if (boundary.shallow) fallback("REPOSITORY_SHALLOW");
  if (boundary.sparseCheckout) fallback("SPARSE_CHECKOUT");
  if (boundary.trackedIndexEntries.some(({ tag }) => tag !== "H")) {
    fallback("INDEX_VISIBILITY_UNSAFE");
  }
}

async function normalizeWorkspaceRoot(workspaceRoot) {
  if (
    typeof workspaceRoot !== "string" ||
    workspaceRoot.length === 0 ||
    workspaceRoot.length > 16_384 ||
    workspaceRoot.includes("\0")
  ) {
    fallback("WORKSPACE_UNSAFE");
  }
  const absoluteRoot = path.resolve(workspaceRoot);
  try {
    const [stats, canonicalRoot] = await Promise.all([lstat(absoluteRoot), realpath(absoluteRoot)]);
    if (!stats.isDirectory() || stats.isSymbolicLink() || canonicalRoot !== absoluteRoot) {
      fallback("WORKSPACE_UNSAFE");
    }
  } catch (error) {
    if (error instanceof LocalPreflightFallback) throw error;
    fallback("WORKSPACE_UNSAFE");
  }
  return absoluteRoot;
}

async function readBoundedWorkspacePath(workspaceRoot, relativePath, maximumBytes) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  let handle;
  try {
    const namedBefore = await lstat(absolutePath);
    if (namedBefore.isSymbolicLink()) {
      return {
        kind: "SYMLINK",
        bytes: Buffer.from(await readlink(absolutePath), "utf8"),
        mode: namedBefore.mode,
        size: namedBefore.size,
        dev: namedBefore.dev,
        ino: namedBefore.ino,
        nlink: namedBefore.nlink,
      };
    }
    if (!namedBefore.isFile() || namedBefore.size > maximumBytes) {
      return {
        kind: "UNSAFE",
        bytes: Buffer.alloc(0),
        mode: namedBefore.mode,
        size: namedBefore.size,
        dev: namedBefore.dev,
        ino: namedBefore.ino,
        nlink: namedBefore.nlink,
      };
    }
    handle = await open(absolutePath, READ_FLAGS);
    const before = await handle.stat();
    if (
      !before.isFile() ||
      before.dev !== namedBefore.dev ||
      before.ino !== namedBefore.ino ||
      before.size !== namedBefore.size ||
      before.size > maximumBytes
    ) {
      fallback("WORKSPACE_INPUT_UNSTABLE");
    }
    const bytes = await handle.readFile();
    const [after, namedAfter] = await Promise.all([handle.stat(), lstat(absolutePath)]);
    if (
      !after.isFile() ||
      !namedAfter.isFile() ||
      namedAfter.isSymbolicLink() ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mode !== before.mode ||
      namedAfter.dev !== before.dev ||
      namedAfter.ino !== before.ino ||
      namedAfter.size !== before.size ||
      bytes.byteLength !== before.size
    ) {
      fallback("WORKSPACE_INPUT_UNSTABLE");
    }
    return {
      kind: "REGULAR",
      bytes,
      mode: before.mode,
      size: before.size,
      dev: before.dev,
      ino: before.ino,
      nlink: before.nlink,
    };
  } catch (error) {
    if (error instanceof LocalPreflightFallback) throw error;
    fallback("WORKSPACE_INPUT_UNREADABLE");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function readUntrackedPaths(runGit, workspaceRoot) {
  const result = await observeGit(
    runGit,
    workspaceRoot,
    ["ls-files", "--others", "--exclude-standard", "-z"],
    MAXIMUM_STATUS_BYTES,
  );
  if (result.status !== 0 || result.stderr.byteLength !== 0) fallback("GIT_FAILURE");
  return parsePathList(result.stdout, "UNTRACKED_LIST_MALFORMED", "STATUS_OVER_BUDGET");
}

async function captureWorkspaceFingerprint(runGit, workspaceRoot, trackedPaths = []) {
  const headRevision = await resolveRevision(runGit, workspaceRoot, "HEAD", "HEAD_UNAVAILABLE");
  const [statusResult, patchResult, untrackedPaths, repositoryBoundary] = await Promise.all([
    observeGit(
      runGit,
      workspaceRoot,
      ["status", "--porcelain=v2", "-z", "--untracked-files=all", "--ignore-submodules=none"],
      MAXIMUM_STATUS_BYTES,
    ),
    observeGit(
      runGit,
      workspaceRoot,
      [
        "diff",
        "--binary",
        "--full-index",
        "--no-ext-diff",
        "--no-textconv",
        "--ignore-submodules=none",
        headRevision,
        "--",
      ],
      MAXIMUM_DIFF_BYTES,
    ),
    readUntrackedPaths(runGit, workspaceRoot),
    captureRepositoryBoundary(runGit, workspaceRoot),
  ]);
  if (
    statusResult.status !== 0 ||
    patchResult.status !== 0 ||
    statusResult.stderr.byteLength !== 0 ||
    patchResult.stderr.byteLength !== 0
  ) {
    fallback("GIT_FAILURE");
  }
  const statusRecords = parseLocalPreflightStatus(statusResult.stdout);
  const declaredUntracked = statusRecords
    .filter(({ kind }) => kind === "UNTRACKED")
    .map(({ path: relativePath }) => relativePath)
    .sort(compareUtf8);
  if (JSON.stringify(declaredUntracked) !== JSON.stringify(untrackedPaths)) {
    fallback("WORKSPACE_INPUT_UNSTABLE");
  }
  const untrackedPathSet = new Set(untrackedPaths);
  const hiddenEligibleUntrackedPaths = repositoryBoundary.eligibleUntrackedPaths.filter(
    (relativePath) => !untrackedPathSet.has(relativePath),
  );
  let totalUntrackedBytes = 0;
  const untrackedReceipts = [];
  for (const relativePath of untrackedPaths) {
    const capture = await readBoundedWorkspacePath(
      workspaceRoot,
      relativePath,
      MAXIMUM_UNTRACKED_BYTES,
    );
    if (capture.kind === "UNSAFE") fallback("UNTRACKED_INPUT_UNSAFE");
    totalUntrackedBytes += capture.bytes.byteLength;
    if (totalUntrackedBytes > MAXIMUM_UNTRACKED_BYTES) fallback("UNTRACKED_INPUT_OVER_BUDGET");
    untrackedReceipts.push({
      path: relativePath,
      kind: capture.kind,
      mode: capture.mode,
      size: capture.size,
      dev: capture.dev,
      ino: capture.ino,
      nlink: capture.nlink,
      sha256: sha256(capture.bytes),
    });
  }
  const hiddenEligibleUntrackedReceipts = [];
  for (const relativePath of hiddenEligibleUntrackedPaths) {
    const capture = await readBoundedWorkspacePath(
      workspaceRoot,
      relativePath,
      MAXIMUM_UNTRACKED_BYTES,
    );
    if (capture.kind === "UNSAFE") fallback("UNTRACKED_INPUT_UNSAFE");
    totalUntrackedBytes += capture.bytes.byteLength;
    if (totalUntrackedBytes > MAXIMUM_UNTRACKED_BYTES) {
      fallback("UNTRACKED_INPUT_OVER_BUDGET");
    }
    hiddenEligibleUntrackedReceipts.push({
      path: relativePath,
      kind: capture.kind,
      mode: capture.mode,
      size: capture.size,
      dev: capture.dev,
      ino: capture.ino,
      nlink: capture.nlink,
      sha256: sha256(capture.bytes),
    });
  }
  const repositoryBoundaryProjection = {
    topLevel: repositoryBoundary.topLevel,
    shallow: repositoryBoundary.shallow,
    sparseCheckout: repositoryBoundary.sparseCheckout,
    trackedIndexSha256: repositoryBoundary.trackedIndexSha256,
    trackedIndexCount: repositoryBoundary.trackedIndexEntries.length,
    eligibleUntrackedPaths: repositoryBoundary.eligibleUntrackedPaths,
  };
  const baseProjection = {
    headRevision,
    statusSha256: sha256(statusResult.stdout),
    patchSha256: sha256(patchResult.stdout),
    repositoryBoundary: repositoryBoundaryProjection,
    untrackedReceipts,
    hiddenEligibleUntrackedReceipts,
  };
  const canonicalTrackedPaths = [...trackedPaths].sort(compareUtf8);
  assertUniquePaths(canonicalTrackedPaths, "PATH_COLLISION");
  let totalTrackedBytes = 0;
  const trackedReceipts = [];
  for (const relativePath of canonicalTrackedPaths) {
    const capture = await readBoundedWorkspacePath(workspaceRoot, relativePath, MAXIMUM_DIFF_BYTES);
    totalTrackedBytes += capture.bytes.byteLength;
    if (
      capture.kind !== "REGULAR" ||
      capture.nlink !== 1 ||
      totalTrackedBytes > MAXIMUM_DIFF_BYTES
    ) {
      fallback("TRACKED_INPUT_UNSAFE");
    }
    trackedReceipts.push({
      path: relativePath,
      mode: capture.mode,
      size: capture.size,
      dev: capture.dev,
      ino: capture.ino,
      nlink: capture.nlink,
      sha256: sha256(capture.bytes),
    });
  }
  const projection = { ...baseProjection, trackedReceipts };
  return deepFreeze({
    ...projection,
    repositoryBoundary,
    statusRecords,
    baseDigest: sha256(JSON.stringify(baseProjection)),
    digest: sha256(JSON.stringify(projection)),
  });
}

function rawChangedPaths(changes) {
  return [
    ...new Set(
      changes.flatMap(({ path: relativePath, sourcePath }) => [
        relativePath,
        ...(sourcePath ? [sourcePath] : []),
      ]),
    ),
  ].sort(compareUtf8);
}

function isFocusedConfigurationPath(relativePath) {
  const basename = path.posix.basename(relativePath);
  if (basename.toLowerCase() === "package.json") return true;
  if (/^(?:ts|js)config(?:\.[^.]+)*\.json$/iu.test(basename)) return true;
  if (/^.+\.config\..+$/iu.test(basename)) return true;
  if (LOCK_OR_WORKSPACE_BASENAME_PATTERN.test(basename)) return true;
  if (/(?:^|[.-])(?:lock|workspace)(?:[.-]|$)/iu.test(basename)) return true;
  if (HIDDEN_CONFIGURATION_BASENAME_PATTERN.test(basename)) return true;
  if (/^\.env(?:\..*)?$/iu.test(basename)) return true;
  if (/^\..+(?:ignore|rc)(?:\..*)?$/iu.test(basename)) return true;
  return /^(?:biome\.jsonc?|deno\.jsonc?|lerna\.json|nx\.json|turbo\.json)$/iu.test(basename);
}

export function classifyLocalPreflightChangeSet(changes, statusRecords) {
  if (statusRecords.some(({ kind }) => kind === "UNTRACKED")) {
    return { mode: "EXHAUSTIVE", reason: "UNTRACKED_WORKTREE" };
  }
  if (statusRecords.some(({ kind }) => kind !== "ORDINARY")) {
    return { mode: "EXHAUSTIVE", reason: "UNSUPPORTED_WORKTREE_STATUS" };
  }
  if (
    statusRecords.some(
      ({ xy, submodule, headMode, indexMode, worktreeMode, headObjectId, indexObjectId }) =>
        !/^(?:M\.|\.M|MM)$/u.test(xy) ||
        typeof submodule !== "string" ||
        submodule !== "N..." ||
        !SAFE_REGULAR_MODES.includes(headMode) ||
        indexMode !== headMode ||
        worktreeMode !== headMode ||
        /^0+$/u.test(headObjectId) ||
        /^0+$/u.test(indexObjectId),
    )
  ) {
    return { mode: "EXHAUSTIVE", reason: "UNSUPPORTED_WORKTREE_STATUS" };
  }
  if (changes.length === 0) {
    return statusRecords.length === 0
      ? { mode: "NO_CHANGES", reason: "CLEAN" }
      : { mode: "EXHAUSTIVE", reason: "INCONSISTENT_GIT_INPUT" };
  }
  const changedPathSet = new Set(rawChangedPaths(changes));
  if (statusRecords.some(({ path: relativePath }) => !changedPathSet.has(relativePath))) {
    return { mode: "EXHAUSTIVE", reason: "INCONSISTENT_GIT_INPUT" };
  }
  for (const change of changes) {
    if (
      change.status !== "M" ||
      change.sourcePath !== null ||
      change.beforeMode !== change.afterMode ||
      !SAFE_REGULAR_MODES.includes(change.beforeMode) ||
      /^0+$/u.test(change.beforeObjectId) ||
      (!/^0+$/u.test(change.afterObjectId) && change.beforeObjectId === change.afterObjectId)
    ) {
      return { mode: "EXHAUSTIVE", reason: "UNSUPPORTED_CHANGE" };
    }
    if (FOCUSED_PATH_PATTERN.exec(change.path) === null) {
      return { mode: "EXHAUSTIVE", reason: "NON_SOURCE_CHANGE" };
    }
    if (isFocusedConfigurationPath(change.path)) {
      return { mode: "EXHAUSTIVE", reason: "SOURCE_CONFIGURATION_CHANGE" };
    }
  }
  return { mode: "FOCUSED", reason: "TRACKED_SOURCE_ONLY" };
}

function workspaceManifestPath(relativePath) {
  const match = FOCUSED_PATH_PATTERN.exec(relativePath);
  if (match === null) fallback("NON_SOURCE_CHANGE");
  return `${match[1]}/${match[2]}/package.json`;
}

async function readBasePath(runGit, workspaceRoot, revision, relativePath) {
  const result = await observeGit(
    runGit,
    workspaceRoot,
    ["show", `${revision}:${relativePath}`],
    MAXIMUM_MANIFEST_BYTES,
  );
  if (result.status !== 0 || result.stderr.byteLength !== 0)
    fallback("WORKSPACE_MANIFEST_UNREVIEWED");
  return result.stdout;
}

async function resolveWorkspaceFilters(runGit, workspaceRoot, mergeBaseRevision, changes) {
  const manifestPaths = [
    ...new Set(changes.map(({ path: relativePath }) => workspaceManifestPath(relativePath))),
  ].sort(compareUtf8);
  const packageNames = [];
  for (const manifestPath of manifestPaths) {
    const [current, reviewed] = await Promise.all([
      readBoundedWorkspacePath(workspaceRoot, manifestPath, MAXIMUM_MANIFEST_BYTES),
      readBasePath(runGit, workspaceRoot, mergeBaseRevision, manifestPath),
    ]);
    if (
      current.kind !== "REGULAR" ||
      current.nlink !== 1 ||
      !current.bytes.equals(reviewed) ||
      current.bytes.byteLength === 0
    ) {
      fallback("WORKSPACE_MANIFEST_UNREVIEWED");
    }
    let manifest;
    try {
      manifest = JSON.parse(decodeUtf8(current.bytes, "WORKSPACE_MANIFEST_INVALID"));
    } catch (error) {
      if (error instanceof LocalPreflightFallback) throw error;
      fallback("WORKSPACE_MANIFEST_INVALID");
    }
    if (
      manifest === null ||
      typeof manifest !== "object" ||
      Array.isArray(manifest) ||
      typeof manifest.name !== "string" ||
      !PACKAGE_NAME_PATTERN.test(manifest.name) ||
      manifest.scripts === null ||
      typeof manifest.scripts !== "object" ||
      Array.isArray(manifest.scripts) ||
      REQUIRED_WORKSPACE_SCRIPTS.some(
        (scriptName) =>
          typeof manifest.scripts[scriptName] !== "string" ||
          manifest.scripts[scriptName].trim().length === 0,
      )
    ) {
      fallback("WORKSPACE_MANIFEST_INVALID");
    }
    if (
      REQUIRED_WORKSPACE_SCRIPTS.some(
        (scriptName) =>
          !LOCAL_PREFLIGHT_REVIEWED_SCRIPT_ALLOWLIST[scriptName].includes(
            manifest.scripts[scriptName],
          ),
      )
    ) {
      fallback("WORKSPACE_SCRIPT_UNSAFE");
    }
    packageNames.push(manifest.name);
  }
  if (packageNames.length === 0 || new Set(packageNames).size !== packageNames.length) {
    fallback("WORKSPACE_MANIFEST_INVALID");
  }
  return packageNames.sort(compareUtf8).map((packageName) => `...${packageName}`);
}

function command(id, executable, args, environment = {}) {
  return { id, command: executable, args, environment };
}

function focusedCommands(workspaceFilters) {
  const filterArguments = workspaceFilters.map((filter) => `--filter=${filter}`);
  return [
    command("format", "pnpm", ["format:check"]),
    command(
      "workspace-build-typecheck",
      "pnpm",
      ["exec", "turbo", "run", "build", "typecheck", ...filterArguments, "--force", "--ui=stream"],
      { TURBO_FORCE: "true" },
    ),
    command(
      "workspace-lint-test",
      "pnpm",
      [
        "exec",
        "turbo",
        "run",
        "lint",
        "test",
        ...filterArguments,
        "--only",
        "--force",
        "--ui=stream",
      ],
      { TURBO_FORCE: "true" },
    ),
    command("boundaries", "pnpm", ["boundaries"], { NODE_OPTIONS: FOUR_GIB_NODE_OPTIONS }),
    command("proof-reader-checkpoints", "node", ["scripts/ci/verify-proof-reader-checkpoints.mjs"]),
  ];
}

function exhaustiveCommands() {
  return [
    command("exhaustive-check", "pnpm", ["check"], {
      NODE_OPTIONS: FOUR_GIB_NODE_OPTIONS,
    }),
  ];
}

/** Creates the deterministic, explicitly non-authoritative plan printed by `--dry-run`. */
export function createLocalPreflightPlan({
  mode,
  reason,
  baseRevision,
  headRevision,
  mergeBaseRevision,
  changedPaths = [],
  workspaceFilters = [],
}) {
  if (!["NO_CHANGES", "FOCUSED", "EXHAUSTIVE"].includes(mode)) {
    throw new LocalPreflightError("PLAN_INVALID", "Local preflight mode is invalid.");
  }
  const sortedPaths = [...changedPaths].sort(compareUtf8);
  const sortedFilters = [...workspaceFilters].sort(compareUtf8);
  const commands =
    mode === "FOCUSED"
      ? focusedCommands(sortedFilters)
      : mode === "EXHAUSTIVE"
        ? exhaustiveCommands()
        : [];
  return deepFreeze({
    schemaVersion: 1,
    profile: LOCAL_PREFLIGHT_PROFILE,
    authority: "NONE",
    authoritative: false,
    mode,
    reason,
    baseRevision,
    headRevision,
    mergeBaseRevision,
    changedPaths: sortedPaths,
    workspaceFilters: sortedFilters,
    commands,
  });
}

function fallbackPlan(reason, fingerprint, changedPaths = []) {
  return createLocalPreflightPlan({
    mode: "EXHAUSTIVE",
    reason,
    baseRevision: null,
    headRevision: fingerprint.headRevision,
    mergeBaseRevision: null,
    changedPaths,
    workspaceFilters: [],
  });
}

/** Inspects a local repository twice around planning so the returned plan owns one stable input. */
export async function inspectLocalPreflight({
  workspaceRoot = DEFAULT_WORKSPACE_ROOT,
  base = DEFAULT_BASE,
  runGit = defaultRunGit,
} = {}) {
  const root = await normalizeWorkspaceRoot(workspaceRoot);
  const initialFingerprint = await captureWorkspaceFingerprint(runGit, root);
  let baseRevision;
  let mergeBaseRevision;
  try {
    assertRepositoryBoundary(initialFingerprint.repositoryBoundary, root);
    if (initialFingerprint.hiddenEligibleUntrackedReceipts.length > 0) {
      fallback("HIDDEN_UNTRACKED_SOURCE");
    }
    baseRevision = await resolveRevision(runGit, root, base, "BASE_UNAVAILABLE");
    mergeBaseRevision = await readUniqueMergeBase(
      runGit,
      root,
      baseRevision,
      initialFingerprint.headRevision,
    );
  } catch (error) {
    if (!(error instanceof LocalPreflightFallback)) throw error;
    const closingFingerprint = await captureWorkspaceFingerprint(runGit, root);
    if (closingFingerprint.digest !== initialFingerprint.digest) {
      throw new LocalPreflightError(
        "WORKSPACE_INPUT_DRIFT",
        "Workspace inputs changed while the fallback plan was captured.",
      );
    }
    return deepFreeze({
      workspaceRoot: root,
      fingerprint: initialFingerprint,
      plan: fallbackPlan(error.reason, initialFingerprint),
    });
  }

  let changes = [];
  let classification;
  let workspaceFilters = [];
  try {
    const diffResult = await observeGit(
      runGit,
      root,
      [
        "diff",
        "--raw",
        "-z",
        "--no-abbrev",
        "--no-renames",
        "--no-ext-diff",
        "--no-textconv",
        "--ignore-submodules=none",
        mergeBaseRevision,
        "--",
      ],
      MAXIMUM_DIFF_BYTES,
    );
    if (diffResult.status !== 0 || diffResult.stderr.byteLength !== 0) fallback("GIT_FAILURE");
    changes = parseLocalPreflightRawDiff(diffResult.stdout, initialFingerprint.headRevision.length);
    classification = classifyLocalPreflightChangeSet(changes, initialFingerprint.statusRecords);
    if (classification.mode === "FOCUSED") {
      workspaceFilters = await resolveWorkspaceFilters(runGit, root, mergeBaseRevision, changes);
    }
  } catch (error) {
    if (!(error instanceof LocalPreflightFallback)) throw error;
    classification = { mode: "EXHAUSTIVE", reason: error.reason };
  }

  const focusedPaths = classification.mode === "FOCUSED" ? rawChangedPaths(changes) : [];
  let closingFingerprint;
  try {
    closingFingerprint = await captureWorkspaceFingerprint(runGit, root, focusedPaths);
  } catch (error) {
    if (!(error instanceof LocalPreflightFallback) || classification.mode !== "FOCUSED") {
      throw error;
    }
    classification = { mode: "EXHAUSTIVE", reason: error.reason };
    workspaceFilters = [];
    closingFingerprint = await captureWorkspaceFingerprint(runGit, root);
  }
  if (closingFingerprint.baseDigest !== initialFingerprint.baseDigest) {
    throw new LocalPreflightError(
      "WORKSPACE_INPUT_DRIFT",
      "Workspace inputs changed while the local preflight plan was captured.",
    );
  }
  const plan = createLocalPreflightPlan({
    ...classification,
    baseRevision,
    headRevision: initialFingerprint.headRevision,
    mergeBaseRevision,
    changedPaths: rawChangedPaths(changes),
    workspaceFilters,
  });
  return deepFreeze({ workspaceRoot: root, fingerprint: closingFingerprint, plan });
}

function formatCommand(step) {
  return [step.command, ...step.args]
    .map((value) => (/\s/u.test(value) ? JSON.stringify(value) : value))
    .join(" ");
}

function forwardProcessGroupSignal(signal, child) {
  if (!child) return false;
  if (process.platform !== "win32" && Number.isSafeInteger(child.pid) && child.pid > 0) {
    try {
      process.kill(-child.pid, signal);
      return true;
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  }
  try {
    return child.kill(signal);
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

function defaultRunCommand(step, workspaceRoot, signalState) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`\n[local-preflight:${step.id}] $ ${formatCommand(step)}\n`);
    const child = spawn(step.command, step.args, {
      cwd: workspaceRoot,
      env: { ...process.env, ...step.environment },
      detached: process.platform !== "win32",
      shell: false,
      stdio: "inherit",
    });
    signalState.activeChild = child;
    let settled = false;
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      if (signalState.activeChild === child) signalState.activeChild = undefined;
      reject(error);
    });
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (signalState.activeChild === child) signalState.activeChild = undefined;
      if (code === 0 && signal === null) {
        resolve();
        return;
      }
      reject(
        new LocalPreflightError("COMMAND_FAILED", `Local preflight step ${step.id} failed.`, {
          stepId: step.id,
          code,
          signal,
        }),
      );
    });
  });
}

function installSignalForwarding(processObject, signalState, forwardSignal) {
  const handlers = new Map();
  for (const signal of ["SIGINT", "SIGTERM"]) {
    const handler = () => {
      if (signalState.signal === null) {
        signalState.signal = signal;
        signalState.activeCaptureController?.abort();
        forwardSignal(signal, signalState.activeChild);
      } else {
        signalState.activeCaptureController?.abort();
        forwardSignal("SIGKILL", signalState.activeChild);
      }
    };
    handlers.set(signal, handler);
    processObject.on(signal, handler);
  }
  return () => {
    for (const [signal, handler] of handlers) processObject.off(signal, handler);
  };
}

function assertNotCancelled(signalState) {
  if (signalState.signal !== null) {
    throw new LocalPreflightError(
      "CANCELLED",
      `Local preflight was cancelled by ${signalState.signal}.`,
      { signal: signalState.signal, exitCode: signalState.signal === "SIGINT" ? 130 : 143 },
    );
  }
}

async function captureFingerprintWithCancellation(
  captureFingerprint,
  signalState,
  { allowExistingCancellation = false } = {},
) {
  if (!allowExistingCancellation) assertNotCancelled(signalState);
  const abortController = new AbortController();
  const abortSignal = abortController.signal;
  signalState.activeCaptureController = abortController;
  let removeAbortListener = () => undefined;
  const cancelled = new Promise((resolve) => {
    const onAbort = () => resolve({ kind: "CANCELLED" });
    removeAbortListener = () => abortSignal.removeEventListener("abort", onAbort);
    abortSignal.addEventListener("abort", onAbort, { once: true });
    if (abortSignal.aborted) onAbort();
  });
  const captured = Promise.resolve()
    .then(() => captureFingerprint(abortSignal))
    .then(
      (value) => ({ kind: "CAPTURED", value }),
      (error) => ({ kind: "FAILED", error }),
    );
  try {
    const outcome = await Promise.race([captured, cancelled]);
    if (outcome.kind === "CANCELLED") assertNotCancelled(signalState);
    if (outcome.kind === "FAILED") throw outcome.error;
    if (!allowExistingCancellation) assertNotCancelled(signalState);
    return outcome.value;
  } finally {
    if (signalState.activeCaptureController === abortController) {
      signalState.activeCaptureController = undefined;
    }
    removeAbortListener();
  }
}

/** Runs commands in order with fail-fast, cancellation, and before/after input drift fences. */
export async function executeLocalPreflightPlan({
  plan,
  workspaceRoot,
  initialFingerprint,
  captureFingerprint,
  runCommand = defaultRunCommand,
  processObject = process,
  forwardSignal = forwardProcessGroupSignal,
}) {
  if (
    process.platform === "win32" &&
    processObject === process &&
    forwardSignal === forwardProcessGroupSignal
  ) {
    throw new LocalPreflightError(
      "PLATFORM_UNSUPPORTED",
      "Local preflight execution requires reliable process-group cancellation.",
    );
  }
  const signalState = {
    signal: null,
    activeChild: undefined,
    activeCaptureController: undefined,
  };
  const capture =
    captureFingerprint ??
    ((signal) =>
      captureWorkspaceFingerprint(
        (root, args, maximumBytes) => defaultRunGit(root, args, maximumBytes, signal),
        workspaceRoot,
        initialFingerprint.trackedReceipts.map(({ path: relativePath }) => relativePath),
      ));
  const uninstall = installSignalForwarding(processObject, signalState, forwardSignal);
  let completedSteps = 0;
  try {
    for (const step of plan.commands) {
      assertNotCancelled(signalState);
      const before = await captureFingerprintWithCancellation(capture, signalState);
      if (before.digest !== initialFingerprint.digest) {
        throw new LocalPreflightError(
          "WORKSPACE_INPUT_DRIFT",
          `Workspace inputs changed before local preflight step ${step.id}.`,
          { stepId: step.id },
        );
      }
      assertNotCancelled(signalState);
      let commandError;
      try {
        await runCommand(step, workspaceRoot, signalState);
      } catch (error) {
        commandError = error;
      }
      let after;
      let closingCaptureError;
      try {
        after = await captureFingerprintWithCancellation(capture, signalState, {
          allowExistingCancellation: true,
        });
      } catch (error) {
        closingCaptureError = error;
      }
      if (
        closingCaptureError instanceof LocalPreflightError &&
        closingCaptureError.code === "CANCELLED"
      ) {
        throw closingCaptureError;
      }
      if (closingCaptureError || after.digest !== initialFingerprint.digest) {
        throw new LocalPreflightError(
          "WORKSPACE_INPUT_DRIFT",
          `Workspace inputs changed during local preflight step ${step.id}.`,
          {
            stepId: step.id,
            commandFailureCode:
              commandError instanceof LocalPreflightError
                ? commandError.code
                : commandError
                  ? "ERROR"
                  : null,
            cancelledSignal: signalState.signal,
            closingCaptureCode:
              closingCaptureError instanceof LocalPreflightError
                ? closingCaptureError.code
                : closingCaptureError
                  ? "ERROR"
                  : null,
          },
        );
      }
      assertNotCancelled(signalState);
      if (commandError) throw commandError;
      completedSteps += 1;
    }
    return deepFreeze({
      profile: LOCAL_PREFLIGHT_PROFILE,
      authority: "NONE",
      authoritative: false,
      status: "PASS",
      mode: plan.mode,
      completedSteps,
    });
  } finally {
    uninstall();
  }
}

export function parseLocalPreflightArguments(argv) {
  let base = DEFAULT_BASE;
  let baseSeen = false;
  let dryRun = false;
  let help = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (argument === "--dry-run") {
      if (dryRun) throw new LocalPreflightError("ARGUMENT_INVALID", "--dry-run was repeated.");
      dryRun = true;
      continue;
    }
    if (argument === "--base") {
      if (baseSeen || index + 1 >= argv.length) {
        throw new LocalPreflightError("ARGUMENT_INVALID", "--base requires one revision.");
      }
      baseSeen = true;
      base = argv[index + 1];
      index += 1;
      continue;
    }
    throw new LocalPreflightError("ARGUMENT_INVALID", `Unknown argument: ${argument}`);
  }
  return Object.freeze({ base, dryRun, help });
}

export async function runLocalPreflight({
  workspaceRoot = DEFAULT_WORKSPACE_ROOT,
  base = DEFAULT_BASE,
  dryRun = false,
} = {}) {
  const inspection = await inspectLocalPreflight({ workspaceRoot, base });
  process.stdout.write(`${JSON.stringify(inspection.plan)}\n`);
  if (dryRun || inspection.plan.mode === "NO_CHANGES") return 0;
  const result = await executeLocalPreflightPlan({
    plan: inspection.plan,
    workspaceRoot: inspection.workspaceRoot,
    initialFingerprint: inspection.fingerprint,
  });
  process.stdout.write(`DESEN_LOCAL_PREFLIGHT_RESULT=${JSON.stringify(result)}\n`);
  return 0;
}

async function main() {
  try {
    const options = parseLocalPreflightArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(
        "Usage: node scripts/ci/local-preflight.mjs [--base <revision>] [--dry-run]\n" +
          "Prints a non-authoritative plan and runs focused checks only for reviewed tracked source edits.\n",
      );
      return;
    }
    process.exitCode = await runLocalPreflight(options);
  } catch (error) {
    process.stderr.write(`${error.stack ?? String(error)}\n`);
    process.exitCode =
      error instanceof LocalPreflightError && error.code === "CANCELLED"
        ? error.details.exitCode
        : 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (import.meta.url === entrypoint) await main();
