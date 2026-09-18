import { execFile as execFileCallback, spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFile = promisify(execFileCallback);
const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../..");
const DEFAULT_BASE = "origin/main";
const FOCUSED_PATH_PATTERN = /^(?:apps|packages)\/[^/]+\/(?:src|test|test-d|dev)\/.+/u;
const FORBIDDEN_FOCUSED_PATH_PATTERN =
  /(?:^|\/)(?:package\.json|pnpm-lock\.yaml|tsconfig(?:\.[^/]+)?\.json|vite\.config\.[^/]+|turbo\.json|dependency-cruiser\.config\.[^/]+)$/u;

/**
 * Local feedback is intentionally non-authoritative. Hosted CI remains the only required proof
 * authority; this command only shortens the safe developer feedback loop between commits.
 */
export const LOCAL_PREFLIGHT_PROFILE = "desen.ci.local-preflight.v1";

function usageError(message) {
  const error = new Error(message);
  error.name = "LocalPreflightUsageError";
  return error;
}

function runGit(args) {
  return execFile("git", ["--no-optional-locks", ...args], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_CONFIG_COUNT: "0",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_OPTIONAL_LOCKS: "0",
      LANG: "C",
      LC_ALL: "C",
    },
  });
}

async function readGit(args) {
  const result = await runGit(args);
  return result.stdout;
}

async function resolveRevision(revision) {
  if (typeof revision !== "string" || revision.length === 0 || revision.startsWith("-")) {
    throw usageError("--base must be one non-empty Git revision or ref.");
  }
  const output = await readGit([
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${revision}^{commit}`,
  ]);
  const resolved = output.trim();
  if (!/^[0-9a-f]{40}$/u.test(resolved)) {
    throw new Error(`Base revision did not resolve to one commit: ${revision}`);
  }
  return resolved;
}

async function assertBaseIsAncestor(baseRevision) {
  try {
    await runGit(["merge-base", "--is-ancestor", baseRevision, "HEAD"]);
  } catch {
    throw new Error(`Base revision is not an ancestor of HEAD: ${baseRevision}`);
  }
}

function parseNameStatus(output) {
  const fields = output.split("\0").filter(Boolean);
  const changes = [];
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index];
    const filePath = fields[index + 1];
    if (typeof filePath !== "string" || filePath.length === 0) {
      throw new Error("Git returned an incomplete name-status record.");
    }
    changes.push(Object.freeze({ status, path: filePath }));
  }
  return Object.freeze(changes);
}

function parseWorktreeStatus(output) {
  const fields = output.split("\0").filter(Boolean);
  return Object.freeze(
    fields.map((field) => Object.freeze({ status: field.slice(0, 2), path: field.slice(3) })),
  );
}

function isFocusedSourcePath(filePath) {
  return FOCUSED_PATH_PATTERN.test(filePath) && !FORBIDDEN_FOCUSED_PATH_PATTERN.test(filePath);
}

/** Classifies only package/application source edits as eligible for the local focused path. */
export function classifyLocalChangeSet({ changes, worktreeStatus = [] }) {
  if (!Array.isArray(changes) || !Array.isArray(worktreeStatus)) {
    throw usageError("Local change classification requires change and worktree arrays.");
  }
  if (worktreeStatus.some(({ status }) => status === "??")) {
    return Object.freeze({ mode: "FULL", reason: "UNTRACKED_WORKTREE" });
  }
  if (changes.length === 0) return Object.freeze({ mode: "NO_CHANGES", reason: "CLEAN" });
  if (
    changes.some(({ status, path: filePath }) => status !== "M" || !isFocusedSourcePath(filePath))
  ) {
    return Object.freeze({ mode: "FULL", reason: "UNSAFE_OR_NON_SOURCE_CHANGE" });
  }
  return Object.freeze({ mode: "FOCUSED", reason: "PACKAGE_SOURCE_ONLY" });
}

export function createLocalPreflightPlan({ baseRevision, changes, worktreeStatus = [] }) {
  const classification = classifyLocalChangeSet({ changes, worktreeStatus });
  const common = Object.freeze({
    profile: LOCAL_PREFLIGHT_PROFILE,
    baseRevision,
    changedPaths: Object.freeze(changes.map(({ path: filePath }) => filePath)),
    ...classification,
  });
  if (classification.mode === "NO_CHANGES") {
    return Object.freeze({ ...common, commands: Object.freeze([]) });
  }
  if (classification.mode === "FOCUSED") {
    return Object.freeze({
      ...common,
      commands: Object.freeze([
        Object.freeze({ command: "pnpm", args: Object.freeze(["format:check"]) }),
        Object.freeze({
          command: "pnpm",
          args: Object.freeze([
            "exec",
            "turbo",
            "run",
            "lint",
            "typecheck",
            "build",
            "test",
            `--filter=...[${baseRevision}]`,
            "--force",
          ]),
          env: Object.freeze({ TURBO_FORCE: "true" }),
        }),
        Object.freeze({ command: "pnpm", args: Object.freeze(["boundaries"]) }),
      ]),
    });
  }
  return Object.freeze({
    ...common,
    commands: Object.freeze([Object.freeze({ command: "pnpm", args: Object.freeze(["check"]) })]),
  });
}

async function captureLocalInputs(baseRevision) {
  const resolvedBase = await resolveRevision(baseRevision);
  await assertBaseIsAncestor(resolvedBase);
  const [diffOutput, statusOutput] = await Promise.all([
    readGit(["diff", "--name-status", "--no-renames", "-z", resolvedBase]),
    readGit(["status", "--porcelain=v1", "--untracked-files=all", "-z"]),
  ]);
  return {
    baseRevision,
    changes: parseNameStatus(diffOutput),
    worktreeStatus: parseWorktreeStatus(statusOutput),
  };
}

function spawnCommand({ command, args, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: WORKSPACE_ROOT,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code: code ?? 1, signal }));
  });
}

function formatCommand({ command, args }) {
  return [command, ...args]
    .map((value) => (value.includes(" ") ? JSON.stringify(value) : value))
    .join(" ");
}

function printPlan(plan) {
  process.stdout.write(
    `${JSON.stringify({
      profile: plan.profile,
      mode: plan.mode,
      reason: plan.reason,
      baseRevision: plan.baseRevision,
      changedPaths: plan.changedPaths,
      commands: plan.commands.map(formatCommand),
      authoritative: false,
    })}\n`,
  );
}

function parseArguments(argv) {
  let baseRevision = DEFAULT_BASE;
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      process.stdout.write(
        "Usage: node scripts/ci/local-preflight.mjs [--base <revision>] [--dry-run]\n" +
          "Runs focused package feedback only for clean tracked source edits; all other changes fall back to pnpm check.\n",
      );
      return null;
    }
    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (argument === "--base") {
      baseRevision = argv[++index];
      if (!baseRevision) throw usageError("--base requires a revision or ref.");
      continue;
    }
    throw usageError(`Unknown argument: ${argument}`);
  }
  return { baseRevision, dryRun };
}

export async function runLocalPreflight({ baseRevision = DEFAULT_BASE, dryRun = false } = {}) {
  const inputs = await captureLocalInputs(baseRevision);
  const plan = createLocalPreflightPlan(inputs);
  printPlan(plan);
  if (dryRun || plan.mode === "NO_CHANGES") return 0;
  for (const command of plan.commands) {
    const startedAt = performance.now();
    const result = await spawnCommand(command);
    const durationMs = Math.round(performance.now() - startedAt);
    process.stdout.write(
      `DESEN_LOCAL_PREFLIGHT_STEP=${JSON.stringify({ command: formatCommand(command), ...result, durationMs })}\n`,
    );
    if (result.code !== 0) return result.code;
  }
  return 0;
}

async function main() {
  try {
    const parsed = parseArguments(process.argv.slice(2));
    if (parsed === null) return;
    process.exitCode = await runLocalPreflight(parsed);
  } catch (error) {
    process.stderr.write(`${error.stack ?? String(error)}\n`);
    process.exitCode = 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (import.meta.url === entrypoint) await main();
