import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify, types as utilTypes } from "node:util";

const EXEC_FILE = promisify(execFileCallback);
const DEFAULT_WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../..");
const PROFILE = "desen.ci.affected-change-boundary.v1";
const AUTHORITY = "SHADOW";
const REVISION_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const RAW_HEADER_PATTERN =
  /^:([0-7]{6}) ([0-7]{6}) ((?:[0-9a-f]{40}|[0-9a-f]{64})) ((?:[0-9a-f]{40}|[0-9a-f]{64})) ([A-Z][0-9]*)$/u;
const SAFE_REGULAR_MODES = Object.freeze(["100644", "100755"]);
const OPTION_KEYS = Object.freeze([
  "workspaceRoot",
  "baseRevision",
  "headRevision",
  "executionRevision",
  "sameRepository",
  "testSeams",
]);
const RESULT_KEYS = Object.freeze(["status", "stdout", "stderr"]);
const MAXIMUM_METADATA_BYTES = 64 * 1024;
const MAXIMUM_STATUS_BYTES = 1024 * 1024;
const MAXIMUM_DIFF_BYTES = 4 * 1024 * 1024;
const MAXIMUM_TRACKED_TREE_BYTES = 16 * 1024 * 1024;
const MAXIMUM_CHANGE_RECORDS = 2_048;
const MAXIMUM_TRACKED_PATHS = 16_384;
const MAXIMUM_PATH_BYTES = 4_096;
const MAXIMUM_TOTAL_PATH_BYTES = 1024 * 1024;
const MAXIMUM_TOTAL_TRACKED_PATH_BYTES = 16 * 1024 * 1024;
const GIT_TIMEOUT_MS = 10_000;
const TEST_SEAM_AUTHORITIES = new WeakSet();
const AUTHENTIC_BOUNDARY_RECEIPTS = new WeakSet();

/** Fixed resource limits enforced before any changed path can reach shadow selection. */
export const AFFECTED_CHANGE_BOUNDARY_LIMITS = Object.freeze({
  maximumMetadataBytes: MAXIMUM_METADATA_BYTES,
  maximumStatusBytes: MAXIMUM_STATUS_BYTES,
  maximumDiffBytes: MAXIMUM_DIFF_BYTES,
  maximumTrackedTreeBytes: MAXIMUM_TRACKED_TREE_BYTES,
  maximumChangeRecords: MAXIMUM_CHANGE_RECORDS,
  maximumTrackedPaths: MAXIMUM_TRACKED_PATHS,
  maximumPathBytes: MAXIMUM_PATH_BYTES,
  maximumTotalPathBytes: MAXIMUM_TOTAL_PATH_BYTES,
  maximumTotalTrackedPathBytes: MAXIMUM_TOTAL_TRACKED_PATH_BYTES,
});

class BoundaryFallback extends Error {
  constructor(reason) {
    super(reason);
    this.name = "BoundaryFallback";
    this.reason = reason;
  }
}

function fallback(reason) {
  throw new BoundaryFallback(reason);
}

function deepFreezeData(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) deepFreezeData(value[key]);
    Object.freeze(value);
  }
  return value;
}

function exactDataRecord(value, allowedKeys, label, requireAllKeys = false) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fallback("INPUT_INVALID");
  }
  const keys = Reflect.ownKeys(value);
  if (
    (requireAllKeys && keys.length !== allowedKeys.length) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fallback("INPUT_INVALID");
  }
  const captured = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fallback("INPUT_INVALID");
    }
    captured[key] = descriptor.value;
  }
  if (requireAllKeys && allowedKeys.some((key) => !Object.hasOwn(captured, key))) {
    fallback("INPUT_INVALID");
  }
  return captured;
}

function captureOptions(rawOptions) {
  const options = exactDataRecord(rawOptions, OPTION_KEYS, "Affected change boundary options");
  const workspaceRoot = options.workspaceRoot ?? DEFAULT_WORKSPACE_ROOT;
  if (
    typeof workspaceRoot !== "string" ||
    workspaceRoot.length === 0 ||
    workspaceRoot.length > 16_384 ||
    workspaceRoot.includes("\0")
  ) {
    fallback("INPUT_INVALID");
  }
  for (const revision of [options.baseRevision, options.headRevision, options.executionRevision]) {
    if (typeof revision !== "string" || !REVISION_PATTERN.test(revision)) {
      fallback("INPUT_INVALID");
    }
  }
  if (
    options.baseRevision.length !== options.headRevision.length ||
    options.baseRevision.length !== options.executionRevision.length ||
    new Set([options.baseRevision, options.headRevision, options.executionRevision]).size !== 3
  ) {
    fallback("INPUT_INVALID");
  }
  if (options.sameRepository !== true) fallback("UNTRUSTED_REPOSITORY");
  if (
    options.testSeams !== undefined &&
    (!TEST_SEAM_AUTHORITIES.has(options.testSeams) ||
      !Object.isFrozen(options.testSeams) ||
      typeof options.testSeams.runGit !== "function")
  ) {
    fallback("INPUT_INVALID");
  }
  return {
    workspaceRoot,
    baseRevision: options.baseRevision,
    headRevision: options.headRevision,
    executionRevision: options.executionRevision,
    runGit: options.testSeams?.runGit ?? runGit,
  };
}

async function normalizeWorkspaceRoot(workspaceRoot) {
  const absoluteRoot = path.resolve(workspaceRoot);
  try {
    const [stats, canonicalRoot] = await Promise.all([lstat(absoluteRoot), realpath(absoluteRoot)]);
    if (!stats.isDirectory() || stats.isSymbolicLink() || canonicalRoot !== absoluteRoot) {
      fallback("WORKSPACE_UNTRUSTED");
    }
  } catch (error) {
    if (error instanceof BoundaryFallback) throw error;
    fallback("WORKSPACE_UNTRUSTED");
  }
  return absoluteRoot;
}

function gitEnvironment() {
  const environment = {
    GIT_CONFIG_COUNT: "0",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_OPTIONAL_LOCKS: "0",
    LANG: "C",
    LC_ALL: "C",
  };
  for (const key of ["PATH", "SYSTEMROOT", "WINDIR", "TMPDIR", "TEMP", "TMP"]) {
    if (typeof process.env[key] === "string") environment[key] = process.env[key];
  }
  return environment;
}

async function runGit(workspaceRoot, args, maximumBytes) {
  const gitArgs = [
    "--no-optional-locks",
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.untrackedCache=false",
    ...args,
  ];
  try {
    const { stdout, stderr } = await EXEC_FILE("git", gitArgs, {
      cwd: workspaceRoot,
      encoding: "buffer",
      env: gitEnvironment(),
      maxBuffer: maximumBytes,
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
    });
    return { status: 0, stdout, stderr };
  } catch (error) {
    if (Number.isSafeInteger(error?.code)) {
      return {
        status: error.code,
        stdout: Buffer.isBuffer(error.stdout) ? error.stdout : Buffer.alloc(0),
        stderr: Buffer.isBuffer(error.stderr) ? error.stderr : Buffer.alloc(0),
      };
    }
    throw error;
  }
}

function validateGitResult(candidate, maximumBytes) {
  const result = exactDataRecord(candidate, RESULT_KEYS, "Git result", true);
  if (
    !Number.isSafeInteger(result.status) ||
    result.status < 0 ||
    result.status > 255 ||
    !Buffer.isBuffer(result.stdout) ||
    !Buffer.isBuffer(result.stderr) ||
    result.stdout.byteLength > maximumBytes ||
    result.stderr.byteLength > maximumBytes
  ) {
    fallback("GIT_RESULT_INVALID");
  }
  if (result.stderr.byteLength !== 0) fallback("GIT_RESULT_INVALID");
  return result;
}

async function observeGit(runGitFunction, workspaceRoot, args, maximumBytes) {
  const frozenArgs = Object.freeze([...args]);
  try {
    return validateGitResult(
      await runGitFunction(workspaceRoot, frozenArgs, maximumBytes),
      maximumBytes,
    );
  } catch (error) {
    if (error instanceof BoundaryFallback) throw error;
    fallback("GIT_FAILURE");
  }
}

function decodeMetadata(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    fallback("GIT_RESULT_INVALID");
  }
}

async function checkedMetadata(runGitFunction, workspaceRoot, args) {
  const result = await observeGit(runGitFunction, workspaceRoot, args, MAXIMUM_METADATA_BYTES);
  if (result.status !== 0) fallback("GIT_FAILURE");
  const decoded = decodeMetadata(result.stdout);
  if (!decoded.endsWith("\n") || decoded.endsWith("\n\n") || decoded.includes("\r")) {
    fallback("GIT_RESULT_INVALID");
  }
  return decoded.slice(0, -1);
}

async function assertRepositoryIsComplete(runGitFunction, workspaceRoot) {
  const shallow = await checkedMetadata(runGitFunction, workspaceRoot, [
    "rev-parse",
    "--is-shallow-repository",
  ]);
  if (shallow === "true") fallback("REPOSITORY_SHALLOW");
  if (shallow !== "false") fallback("GIT_RESULT_INVALID");
}

async function assertCommitAvailable(runGitFunction, workspaceRoot, revision) {
  const type = await checkedMetadata(runGitFunction, workspaceRoot, ["cat-file", "-t", revision]);
  if (type !== "commit") fallback("REVISION_UNAVAILABLE");
}

async function readCurrentHead(runGitFunction, workspaceRoot) {
  const revision = await checkedMetadata(runGitFunction, workspaceRoot, [
    "rev-parse",
    "--verify",
    "HEAD^{commit}",
  ]);
  if (!REVISION_PATTERN.test(revision)) fallback("GIT_RESULT_INVALID");
  return revision;
}

async function readExecutionParents(runGitFunction, workspaceRoot, executionRevision) {
  const output = await checkedMetadata(runGitFunction, workspaceRoot, [
    "rev-list",
    "--parents",
    "-n",
    "1",
    executionRevision,
  ]);
  const fields = output.split(" ");
  if (fields.length !== 3 || fields.some((field) => !REVISION_PATTERN.test(field))) {
    fallback("EXECUTION_PARENT_MISMATCH");
  }
  if (fields[0] !== executionRevision) fallback("EXECUTION_PARENT_MISMATCH");
  return fields.slice(1);
}

async function assertAncestor(runGitFunction, workspaceRoot, ancestor, descendant) {
  const result = await observeGit(
    runGitFunction,
    workspaceRoot,
    ["merge-base", "--is-ancestor", ancestor, descendant],
    MAXIMUM_METADATA_BYTES,
  );
  if (result.stdout.byteLength !== 0) fallback("GIT_RESULT_INVALID");
  if (result.status === 1) fallback("ANCESTRY_UNTRUSTED");
  if (result.status !== 0) fallback("GIT_FAILURE");
}

async function readUniqueMergeBase(runGitFunction, workspaceRoot, baseRevision, headRevision) {
  const output = await checkedMetadata(runGitFunction, workspaceRoot, [
    "merge-base",
    "--all",
    baseRevision,
    headRevision,
  ]);
  const revisions = output.length === 0 ? [] : output.split("\n");
  if (
    revisions.length !== 1 ||
    !REVISION_PATTERN.test(revisions[0]) ||
    revisions[0].length !== baseRevision.length
  ) {
    fallback("MERGE_BASE_AMBIGUOUS");
  }
  return revisions[0];
}

async function assertCleanWorkspace(runGitFunction, workspaceRoot) {
  const result = await observeGit(
    runGitFunction,
    workspaceRoot,
    ["status", "--porcelain=v2", "-z", "--untracked-files=all", "--ignore-submodules=none"],
    MAXIMUM_STATUS_BYTES,
  );
  if (result.status !== 0) fallback("GIT_FAILURE");
  if (result.stdout.byteLength !== 0) fallback("WORKSPACE_DIRTY");
}

function splitNulRecords(bytes, maximumRecords, malformedReason, overBudgetReason) {
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

function decodeSafePath(bytes) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAXIMUM_PATH_BYTES) {
    fallback("PATH_UNSAFE");
  }
  let candidate;
  try {
    candidate = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    fallback("PATH_UNSAFE");
  }
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
    fallback("PATH_UNSAFE");
  }
  return candidate;
}

function parseRawDiff(bytes, objectIdLength) {
  const records = splitNulRecords(
    bytes,
    MAXIMUM_CHANGE_RECORDS * 3,
    "DIFF_MALFORMED",
    "DIFF_OVER_BUDGET",
  );
  if (records.length === 0) fallback("EMPTY_CHANGE_SET");
  const changes = [];
  const exactPaths = new Set();
  const normalizedPaths = new Map();
  let totalPathBytes = 0;

  for (let index = 0; index < records.length;) {
    let header;
    try {
      header = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(records[index]);
    } catch {
      fallback("DIFF_MALFORMED");
    }
    index += 1;
    const match = RAW_HEADER_PATTERN.exec(header);
    if (!match) fallback("DIFF_MALFORMED");
    const [, beforeMode, afterMode, beforeObjectId, afterObjectId, status] = match;
    if (status !== "M") fallback("UNSUPPORTED_CHANGE_KIND");
    if (
      beforeMode !== afterMode ||
      !SAFE_REGULAR_MODES.includes(beforeMode) ||
      beforeObjectId.length !== objectIdLength ||
      beforeObjectId.length !== afterObjectId.length ||
      /^0+$/u.test(beforeObjectId) ||
      /^0+$/u.test(afterObjectId) ||
      beforeObjectId === afterObjectId
    ) {
      fallback("UNSUPPORTED_FILE_MODE");
    }
    if (index >= records.length) fallback("DIFF_MALFORMED");
    const pathBytes = records[index];
    index += 1;
    totalPathBytes += pathBytes.byteLength;
    if (totalPathBytes > MAXIMUM_TOTAL_PATH_BYTES) fallback("DIFF_OVER_BUDGET");
    const relativePath = decodeSafePath(pathBytes);
    if (exactPaths.has(relativePath)) fallback("PATH_COLLISION");
    exactPaths.add(relativePath);
    const normalizationKey = relativePath.normalize("NFKC");
    const previousPath = normalizedPaths.get(normalizationKey);
    if (previousPath !== undefined && previousPath !== relativePath) {
      fallback("PATH_COLLISION");
    }
    normalizedPaths.set(normalizationKey, relativePath);
    changes.push({
      path: relativePath,
      status,
      mode: beforeMode,
      beforeObjectId,
      afterObjectId,
    });
    if (changes.length > MAXIMUM_CHANGE_RECORDS) fallback("DIFF_OVER_BUDGET");
  }

  changes.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return changes;
}

function parseTrackedTree(bytes, objectIdLength) {
  const records = splitNulRecords(
    bytes,
    MAXIMUM_TRACKED_PATHS,
    "TRACKED_TREE_INVALID",
    "TRACKED_TREE_OVER_BUDGET",
  );
  if (records.length === 0 || records.length > MAXIMUM_TRACKED_PATHS) {
    fallback("TRACKED_TREE_INVALID");
  }
  const trackedPaths = [];
  const exactPaths = new Set();
  const normalizedPaths = new Map();
  let totalPathBytes = 0;
  for (const record of records) {
    const tabIndex = record.indexOf(0x09);
    if (tabIndex <= 0 || tabIndex === record.byteLength - 1) fallback("TRACKED_TREE_INVALID");
    let metadata;
    try {
      metadata = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
        record.subarray(0, tabIndex),
      );
    } catch {
      fallback("TRACKED_TREE_INVALID");
    }
    const fields = metadata.split(" ");
    if (
      fields.length !== 3 ||
      !SAFE_REGULAR_MODES.includes(fields[0]) ||
      fields[1] !== "blob" ||
      !REVISION_PATTERN.test(fields[2]) ||
      fields[2].length !== objectIdLength
    ) {
      fallback("TRACKED_TREE_UNSUPPORTED");
    }
    const pathBytes = record.subarray(tabIndex + 1);
    totalPathBytes += pathBytes.byteLength;
    if (totalPathBytes > MAXIMUM_TOTAL_TRACKED_PATH_BYTES) fallback("TRACKED_TREE_OVER_BUDGET");
    const relativePath = decodeSafePath(pathBytes);
    if (exactPaths.has(relativePath)) fallback("PATH_COLLISION");
    exactPaths.add(relativePath);
    const normalizationKey = relativePath.normalize("NFKC");
    const previousPath = normalizedPaths.get(normalizationKey);
    if (previousPath !== undefined && previousPath !== relativePath) {
      fallback("PATH_COLLISION");
    }
    normalizedPaths.set(normalizationKey, relativePath);
    trackedPaths.push(relativePath);
  }
  trackedPaths.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return trackedPaths;
}

async function readTrackedPaths(runGitFunction, workspaceRoot, executionRevision) {
  const result = await observeGit(
    runGitFunction,
    workspaceRoot,
    ["ls-tree", "--full-tree", "-r", "-z", executionRevision],
    MAXIMUM_TRACKED_TREE_BYTES,
  );
  if (result.status !== 0) fallback("GIT_FAILURE");
  return parseTrackedTree(result.stdout, executionRevision.length);
}

function trackedPathSetSha256(executionRevision, trackedPaths) {
  return createHash("sha256")
    .update(JSON.stringify({ profile: PROFILE, executionRevision, trackedPaths }))
    .digest("hex");
}

async function readChangedFiles(runGitFunction, workspaceRoot, baseRevision, headRevision) {
  const result = await observeGit(
    runGitFunction,
    workspaceRoot,
    [
      "diff-tree",
      "--no-commit-id",
      "--raw",
      "-z",
      "--no-abbrev",
      "--no-renames",
      "--no-ext-diff",
      "--no-textconv",
      "-r",
      baseRevision,
      headRevision,
      "--",
    ],
    MAXIMUM_DIFF_BYTES,
  );
  if (result.status !== 0) fallback("GIT_FAILURE");
  return parseRawDiff(result.stdout, headRevision.length);
}

function exhaustiveReceipt(reason) {
  const receipt = deepFreezeData({
    schemaVersion: 1,
    profile: PROFILE,
    authority: AUTHORITY,
    selection: "EXHAUSTIVE",
    reason,
    baseRevision: null,
    headRevision: null,
    executionRevision: null,
    mergeBaseRevision: null,
    trackedPathCount: 0,
    trackedPathSetSha256: null,
    trackedPaths: [],
    changeCount: 0,
    changeSetSha256: null,
    changes: [],
  });
  AUTHENTIC_BOUNDARY_RECEIPTS.add(receipt);
  return receipt;
}

function affectedReceipt({
  baseRevision,
  headRevision,
  executionRevision,
  mergeBaseRevision,
  trackedPaths,
  changes,
}) {
  const pathSetSha256 = trackedPathSetSha256(executionRevision, trackedPaths);
  const changeSetSha256 = createHash("sha256")
    .update(
      JSON.stringify({
        profile: PROFILE,
        baseRevision,
        headRevision,
        executionRevision,
        mergeBaseRevision,
        trackedPathSetSha256: pathSetSha256,
        changes,
      }),
    )
    .digest("hex");
  const receipt = deepFreezeData({
    schemaVersion: 1,
    profile: PROFILE,
    authority: AUTHORITY,
    selection: "AFFECTED",
    reason: "ELIGIBLE_REGULAR_MODIFICATIONS",
    baseRevision,
    headRevision,
    executionRevision,
    mergeBaseRevision,
    trackedPathCount: trackedPaths.length,
    trackedPathSetSha256: pathSetSha256,
    trackedPaths,
    changeCount: changes.length,
    changeSetSha256,
    changes,
  });
  AUTHENTIC_BOUNDARY_RECEIPTS.add(receipt);
  return receipt;
}

/**
 * Creates an authenticated read-only Git seam for focused contract tests.
 *
 * Production callers must omit this seam; it cannot create required execution authority.
 */
export function createAffectedChangeBoundaryTestSeams(runGitFunction) {
  if (typeof runGitFunction !== "function" || utilTypes.isProxy(runGitFunction)) {
    throw new TypeError("The affected-change test Git reader must be one direct function.");
  }
  const seams = Object.freeze({ runGit: runGitFunction });
  TEST_SEAM_AUTHORITIES.add(seams);
  return seams;
}

/**
 * Admits only the exact receipt object minted by this module in the current process.
 *
 * The private identity authority cannot be reconstructed from receipt fields or digests. Clones,
 * proxies, and caller-created lookalikes are rejected even when their data is otherwise identical.
 */
export function validateAffectedChangeBoundaryReceipt(candidate) {
  if (!AUTHENTIC_BOUNDARY_RECEIPTS.has(candidate)) {
    throw new TypeError("The affected-change receipt was not minted by the boundary authority.");
  }
  return candidate;
}

/**
 * Authenticates one same-repository pull-request comparison and returns changed regular files.
 *
 * The checked-out execution revision must be an exact two-parent merge of the supplied base and
 * head revisions. Every uncertain condition returns an inert `EXHAUSTIVE` receipt with no partial
 * paths; only same-mode regular-file modifications may return `AFFECTED` in shadow.
 */
export async function captureAffectedChangeBoundary(rawOptions) {
  try {
    const options = captureOptions(rawOptions);
    const workspaceRoot = await normalizeWorkspaceRoot(options.workspaceRoot);
    await assertRepositoryIsComplete(options.runGit, workspaceRoot);
    for (const revision of [
      options.baseRevision,
      options.headRevision,
      options.executionRevision,
    ]) {
      await assertCommitAvailable(options.runGit, workspaceRoot, revision);
    }

    if ((await readCurrentHead(options.runGit, workspaceRoot)) !== options.executionRevision) {
      fallback("EXECUTION_REVISION_MISMATCH");
    }
    const parents = await readExecutionParents(
      options.runGit,
      workspaceRoot,
      options.executionRevision,
    );
    if (parents[0] !== options.baseRevision || parents[1] !== options.headRevision) {
      fallback("EXECUTION_PARENT_MISMATCH");
    }
    await assertAncestor(
      options.runGit,
      workspaceRoot,
      options.baseRevision,
      options.executionRevision,
    );
    await assertAncestor(
      options.runGit,
      workspaceRoot,
      options.headRevision,
      options.executionRevision,
    );
    const mergeBaseRevision = await readUniqueMergeBase(
      options.runGit,
      workspaceRoot,
      options.baseRevision,
      options.headRevision,
    );
    await assertAncestor(options.runGit, workspaceRoot, mergeBaseRevision, options.baseRevision);
    await assertAncestor(options.runGit, workspaceRoot, mergeBaseRevision, options.headRevision);
    await assertCleanWorkspace(options.runGit, workspaceRoot);
    const trackedPaths = await readTrackedPaths(
      options.runGit,
      workspaceRoot,
      options.executionRevision,
    );
    const openingTrackedPathSetSha256 = trackedPathSetSha256(
      options.executionRevision,
      trackedPaths,
    );

    const changes = await readChangedFiles(
      options.runGit,
      workspaceRoot,
      options.baseRevision,
      options.headRevision,
    );

    await assertCleanWorkspace(options.runGit, workspaceRoot);
    if ((await readCurrentHead(options.runGit, workspaceRoot)) !== options.executionRevision) {
      fallback("INPUT_CHANGED_DURING_CAPTURE");
    }
    const closingParents = await readExecutionParents(
      options.runGit,
      workspaceRoot,
      options.executionRevision,
    );
    if (closingParents[0] !== options.baseRevision || closingParents[1] !== options.headRevision) {
      fallback("INPUT_CHANGED_DURING_CAPTURE");
    }
    await assertRepositoryIsComplete(options.runGit, workspaceRoot);
    const closingMergeBase = await readUniqueMergeBase(
      options.runGit,
      workspaceRoot,
      options.baseRevision,
      options.headRevision,
    );
    if (closingMergeBase !== mergeBaseRevision) fallback("INPUT_CHANGED_DURING_CAPTURE");
    const closingTrackedPaths = await readTrackedPaths(
      options.runGit,
      workspaceRoot,
      options.executionRevision,
    );
    if (
      trackedPathSetSha256(options.executionRevision, closingTrackedPaths) !==
      openingTrackedPathSetSha256
    ) {
      fallback("INPUT_CHANGED_DURING_CAPTURE");
    }

    return affectedReceipt({
      baseRevision: options.baseRevision,
      headRevision: options.headRevision,
      executionRevision: options.executionRevision,
      mergeBaseRevision,
      trackedPaths,
      changes,
    });
  } catch (error) {
    return exhaustiveReceipt(error instanceof BoundaryFallback ? error.reason : "INTERNAL_ERROR");
  }
}
