import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, realpath, rename, rm, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { DesenAppLocalDevHostError, startDesenAppLocalDev } from "./local-dev-host.mjs";

const OWNER = "desen.app.local-m10-demo.v1\n";
const MAX_ENTRIES = 10_000;
const MAX_BYTES = 256 * 1024 * 1024;

/** A redacted failure at the local demo's exclusive, application-owned state boundary. */
export class DesenAppLocalDemoError extends Error {
  /** @param {"UNSAFE_DEMO_STATE" | "DEMO_IN_USE" | "DEMO_START_FAILED" | "DEMO_STOP_FAILED"} code */
  constructor(code) {
    super(
      code === "DEMO_IN_USE"
        ? "The demo is already running or its previous shutdown needs inspection. Stop it before resetting."
        : code === "DEMO_START_FAILED"
          ? "The demo could not start. Ensure port 5173 is free; no existing service was stopped."
          : code === "DEMO_STOP_FAILED"
            ? "The demo did not stop cleanly. Its state remains locked for inspection."
            : "The demo state is not safely owned. No reset was authorized.",
    );
    this.name = "DesenAppLocalDemoError";
    /** @readonly */
    this.code = code;
  }
}

/** @param {unknown} error */
function errorCode(error) {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

/** @param {import("node:fs").Stats} stats */
function owned(stats) {
  return process.getuid === undefined || stats.uid === process.getuid();
}

/** @param {string} path @param {boolean} [create] */
async function privateDirectory(path, create = false) {
  if (create) {
    try {
      await mkdir(path, { mode: 0o700 });
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
    }
  }
  const stats = await lstat(path);
  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    !owned(stats) ||
    (stats.mode & 0o777) !== 0o700 ||
    (await realpath(path)) !== path
  ) {
    throw new DesenAppLocalDemoError("UNSAFE_DEMO_STATE");
  }
  return stats;
}

/** @param {string} path */
async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return false;
    throw error;
  }
}

/** Read a small private regular file without following a replaced symbolic link. @param {string} path */
async function readPrivateFile(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stats = await file.stat();
    if (
      !stats.isFile() ||
      stats.nlink !== 1 ||
      !owned(stats) ||
      (stats.mode & 0o777) !== 0o600 ||
      stats.size > 256
    ) {
      throw new DesenAppLocalDemoError("UNSAFE_DEMO_STATE");
    }
    const bytes = await file.readFile("utf8");
    const after = await lstat(path);
    if (
      stats.dev !== after.dev ||
      stats.ino !== after.ino ||
      stats.size !== after.size ||
      stats.mtimeMs !== after.mtimeMs ||
      after.isSymbolicLink()
    ) {
      throw new DesenAppLocalDemoError("UNSAFE_DEMO_STATE");
    }
    return { bytes, stats };
  } finally {
    await file.close();
  }
}

/** Closed finite scan before rotating or pruning only the owned demo generation. @param {string} root */
async function captureTree(root) {
  /** @type {string[]} */
  const receipts = [];
  let count = 0;
  let bytes = 0;
  /** @param {string} path @param {number} depth */
  const visit = async (path, depth) => {
    const stats = await lstat(path);
    count += 1;
    bytes += stats.isFile() ? stats.size : 0;
    if (
      count > MAX_ENTRIES ||
      bytes > MAX_BYTES ||
      depth > 32 ||
      !owned(stats) ||
      stats.isSymbolicLink() ||
      (!stats.isFile() && !stats.isDirectory()) ||
      (stats.isFile() && stats.nlink !== 1) ||
      (stats.mode & 0o022) !== 0
    ) {
      throw new DesenAppLocalDemoError("UNSAFE_DEMO_STATE");
    }
    receipts.push(
      JSON.stringify([
        path,
        stats.dev,
        stats.ino,
        stats.mode,
        stats.nlink,
        stats.size,
        stats.mtimeMs,
      ]),
    );
    if (stats.isDirectory()) {
      for (const name of (await readdir(path)).sort()) await visit(join(path, name), depth + 1);
    }
  };
  await visit(root, 0);
  return JSON.stringify(receipts);
}

/**
 * Exclusively acquires the fixed `.desen/m10-demo/current` store, optionally retaining its prior
 * generation as `previous`. This is a development-data lifecycle, not a Source import or migration.
 * A crash leaves the lease fail-closed; it is never reclaimed by killing a PID or stealing a port.
 *
 * @param {Readonly<{workspaceDirectory: string; reset?: boolean}>} options Canonical trusted repository.
 * @returns {Promise<Readonly<{stateDirectory: string; release: () => Promise<void>}>>}
 */
export async function acquireDesenAppDemoState(options) {
  if (
    typeof options.workspaceDirectory !== "string" ||
    !isAbsolute(options.workspaceDirectory) ||
    (await realpath(options.workspaceDirectory)) !== options.workspaceDirectory ||
    !(await lstat(options.workspaceDirectory)).isDirectory() ||
    (options.reset !== undefined && typeof options.reset !== "boolean")
  ) {
    throw new DesenAppLocalDemoError("UNSAFE_DEMO_STATE");
  }
  const parent = join(options.workspaceDirectory, ".desen");
  const root = join(parent, "m10-demo");
  const ownerPath = join(root, "owner");
  const leasePath = join(root, "lease");
  const current = join(root, "current");
  const previous = join(root, "previous");
  await privateDirectory(parent, true);
  let created = false;
  try {
    await mkdir(root, { mode: 0o700 });
    created = true;
  } catch (error) {
    if (errorCode(error) !== "EEXIST") throw error;
  }
  const rootStats = await privateDirectory(root);
  if (created) {
    const owner = await open(ownerPath, "wx", 0o600);
    try {
      await owner.writeFile(OWNER);
      await owner.sync();
    } finally {
      await owner.close();
    }
  }
  if ((await readPrivateFile(ownerPath)).bytes !== OWNER) {
    throw new DesenAppLocalDemoError("UNSAFE_DEMO_STATE");
  }
  let lease;
  try {
    lease = await open(leasePath, "wx", 0o600);
  } catch (error) {
    if (errorCode(error) === "EEXIST") throw new DesenAppLocalDemoError("DEMO_IN_USE");
    throw error;
  }
  const leaseBytes = `${OWNER}pid=${process.pid}\n`;
  const leaseStats = await lease.stat();
  /** @type {Promise<void> | undefined} */
  let releasePromise;
  const checkOwnership = async () => {
    const now = await privateDirectory(root);
    const activeLease = await readPrivateFile(leasePath);
    if (
      now.dev !== rootStats.dev ||
      now.ino !== rootStats.ino ||
      (await readPrivateFile(ownerPath)).bytes !== OWNER ||
      activeLease.bytes !== leaseBytes ||
      activeLease.stats.dev !== leaseStats.dev ||
      activeLease.stats.ino !== leaseStats.ino
    ) {
      throw new DesenAppLocalDemoError("UNSAFE_DEMO_STATE");
    }
  };
  const release = () => {
    releasePromise ??= (async () => {
      try {
        await checkOwnership();
        await unlink(leasePath);
      } finally {
        await lease.close();
      }
    })();
    return releasePromise;
  };
  try {
    await lease.writeFile(leaseBytes);
    await lease.sync();
    const names = await readdir(root);
    if (names.some((name) => !["owner", "lease", "current", "previous"].includes(name))) {
      throw new DesenAppLocalDemoError("UNSAFE_DEMO_STATE");
    }
    const hasCurrent = await exists(current);
    const hasPrevious = await exists(previous);
    if (hasCurrent) await privateDirectory(current);
    if (hasPrevious) await privateDirectory(previous);
    if (!hasCurrent && hasPrevious) throw new DesenAppLocalDemoError("UNSAFE_DEMO_STATE");
    if (options.reset && hasCurrent) {
      const currentReceipt = await captureTree(current);
      const previousReceipt = hasPrevious ? await captureTree(previous) : null;
      await checkOwnership();
      if (
        currentReceipt !== (await captureTree(current)) ||
        (hasPrevious && previousReceipt !== (await captureTree(previous)))
      ) {
        throw new DesenAppLocalDemoError("UNSAFE_DEMO_STATE");
      }
      // Exactly one prior generation is retained. Only the validated older backup is pruned.
      if (hasPrevious) await rm(previous, { recursive: true });
      await rename(current, previous);
      try {
        await mkdir(current, { mode: 0o700 });
      } catch (error) {
        await rename(previous, current);
        throw error;
      }
    } else if (!hasCurrent) {
      await mkdir(current, { mode: 0o700 });
    }
    await checkOwnership();
    return Object.freeze({ stateDirectory: current, release });
  } catch (error) {
    try {
      await release();
    } catch {
      /* A replaced or unreadable lease remains fail-closed on disk. */
    }
    throw error instanceof DesenAppLocalDemoError
      ? error
      : new DesenAppLocalDemoError("UNSAFE_DEMO_STATE");
  }
}

/**
 * Starts the ordinary product and independent host with a reusable, exclusively owned demo store.
 * No fixture Source, positive document injection, alternative product entry or extra editor port exists.
 *
 * @param {Readonly<{workspaceDirectory: string; reset?: boolean; startHost?: typeof startDesenAppLocalDev}>} options
 * Trusted repository and reset intent; the optional composition seam is for focused lifetime tests.
 * @returns {Promise<import("./local-dev-host.mjs").DesenAppLocalDevHost>}
 */
export async function startDesenAppLocalDemo(options) {
  const state = await acquireDesenAppDemoState(options);
  let host;
  try {
    host = await (options.startHost ?? startDesenAppLocalDev)({
      appDirectory: join(options.workspaceDirectory, "apps/desen-app"),
      stateDirectory: state.stateDirectory,
      publication: {
        channelName: "preview",
        clientRootDirectory: join(options.workspaceDirectory, "apps/reference-host-web"),
        hostId: "reference-host-web",
        installedPackageDirectory: join(
          options.workspaceDirectory,
          "packages/reference-catalog-web",
        ),
      },
    });
  } catch (error) {
    if (error instanceof DesenAppLocalDevHostError && error.code === "LOCAL_START_FAILED") {
      await state.release();
    } else {
      // An unknown or incompletely cleaned startup cannot release the store to a second writer.
      throw new DesenAppLocalDemoError("DEMO_STOP_FAILED");
    }
    throw new DesenAppLocalDemoError("DEMO_START_FAILED");
  }
  /** @type {Promise<void> | undefined} */
  let closePromise;
  return Object.freeze({
    appOrigin: host.appOrigin,
    referenceHostOrigin: host.referenceHostOrigin,
    close() {
      closePromise ??= (async () => {
        try {
          await host.close();
        } catch {
          throw new DesenAppLocalDemoError("DEMO_STOP_FAILED");
        }
        await state.release();
      })();
      return closePromise;
    },
  });
}
