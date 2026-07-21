import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

/** The committed location of the opaque upstream protocol tree. */
export const SNAPSHOT_RELATIVE_PATH = "packages/protocol/upstream/0.1.0/snapshot";

/** The canonical snapshot location, resolved independently from the caller's working directory. */
export const DEFAULT_SNAPSHOT_ROOT = path.resolve(
  scriptDirectory,
  "..",
  "..",
  ...SNAPSHOT_RELATIVE_PATH.split("/"),
);

/** Pinned facts obtained from the frozen upstream Git tree. */
export const EXPECTED_PROTOCOL_SNAPSHOT = Object.freeze({
  protocol: "0.1.0",
  sourceCommit: "b0bd7c4f0f61555b1d90e3a2ceb90d6e3d43daca",
  sourceTree: "cd7afa57888095718c4ee82b69b5b282980763c8",
  manifestSha256: "92e1c817d75ddc71e993de0dcf42ad7003738b6a59dc57905b879f872828c2cd",
  aggregateSha256: "afe8fc359465ce891f4325fcdeca4b2f12bca48f1aa54a34c4f3a97985f7e060",
  manifestEntries: 30,
  snapshotFiles: 31,
  totalBytes: 306_604,
  executablePaths: Object.freeze(["tools/jcs.mjs", "tools/validate.py"]),
});

/** Internal error with a stable code for snapshot-integrity automation. */
export class ProtocolSnapshotIntegrityError extends Error {
  /**
   * @param {string} code stable internal failure code
   * @param {string} message human-readable failure summary
   * @param {Record<string, unknown>} [details] structured diagnostic context
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProtocolSnapshotIntegrityError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Returns the lowercase SHA-256 digest for bytes without interpreting or normalizing them.
 *
 * @param {Uint8Array} bytes exact file bytes
 */
function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Parses the frozen SHA256SUMS grammar while rejecting paths that could escape the snapshot.
 *
 * @param {Uint8Array} manifestBytes exact manifest bytes
 * @returns {ReadonlyArray<Readonly<{ path: string; sha256: string }>>}
 */
export function parseChecksumManifest(manifestBytes) {
  const text = Buffer.from(manifestBytes).toString("utf8");
  const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
  const entries = [];
  const seenPaths = new Set();

  for (const [index, line] of lines.entries()) {
    const match = /^([0-9a-f]{64}) {2}\.\/(.+)$/.exec(line);
    if (!match) {
      throw new ProtocolSnapshotIntegrityError(
        "UPSTREAM_MANIFEST_MALFORMED",
        `SHA256SUMS line ${index + 1} does not match the frozen manifest grammar.`,
        { line: index + 1 },
      );
    }

    const [, digest, relativePath] = match;
    const segments = relativePath.split("/");
    const isUnsafe =
      relativePath.includes("\\") ||
      path.posix.isAbsolute(relativePath) ||
      segments.some((segment) => segment === "" || segment === "." || segment === "..") ||
      path.posix.normalize(relativePath) !== relativePath;

    if (isUnsafe || relativePath === "SHA256SUMS") {
      throw new ProtocolSnapshotIntegrityError(
        "UPSTREAM_MANIFEST_UNSAFE_PATH",
        `SHA256SUMS contains an unsafe path on line ${index + 1}.`,
        { line: index + 1, path: relativePath },
      );
    }

    if (seenPaths.has(relativePath)) {
      throw new ProtocolSnapshotIntegrityError(
        "UPSTREAM_MANIFEST_DUPLICATE_PATH",
        `SHA256SUMS contains the path more than once: ${relativePath}`,
        { path: relativePath },
      );
    }

    seenPaths.add(relativePath);
    entries.push(Object.freeze({ path: relativePath, sha256: digest }));
  }

  const paths = entries.map((entry) => entry.path);
  const sortedPaths = [...paths].sort();
  if (paths.some((entryPath, index) => entryPath !== sortedPaths[index])) {
    throw new ProtocolSnapshotIntegrityError(
      "UPSTREAM_MANIFEST_UNSORTED",
      "SHA256SUMS paths are not in deterministic byte-order.",
    );
  }

  return Object.freeze(entries);
}

/**
 * Recursively inventories regular files while rejecting symlinks and other special entries.
 *
 * @param {string} root snapshot root
 * @param {string} [relativeDirectory] current POSIX-style relative directory
 * @returns {Promise<string[]>}
 */
async function inventoryRegularFiles(root, relativeDirectory = "") {
  const absoluteDirectory = path.join(root, ...relativeDirectory.split("/").filter(Boolean));
  const directoryEntries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const directoryEntry of directoryEntries.sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  )) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${directoryEntry.name}`
      : directoryEntry.name;

    if (directoryEntry.isDirectory()) {
      files.push(...(await inventoryRegularFiles(root, relativePath)));
      continue;
    }

    if (!directoryEntry.isFile()) {
      throw new ProtocolSnapshotIntegrityError(
        "UPSTREAM_UNSUPPORTED_ENTRY",
        `The frozen snapshot contains a symlink or non-regular entry: ${relativePath}`,
        { path: relativePath },
      );
    }

    files.push(relativePath);
  }

  return files;
}

/**
 * Verifies the exact frozen protocol file set and every byte covered by its pinned manifest.
 *
 * The aggregate digest is SHA-256 over sorted UTF-8 records in the form
 * `relativePath + NUL + sha256(fileBytes) + LF` for all 31 snapshot files.
 *
 * @param {string} [snapshotRoot] alternate root used only by negative tests
 */
export async function verifyProtocolSnapshot(snapshotRoot = DEFAULT_SNAPSHOT_ROOT) {
  let rootStats;
  try {
    rootStats = await lstat(snapshotRoot);
  } catch (error) {
    throw new ProtocolSnapshotIntegrityError(
      "UPSTREAM_SNAPSHOT_MISSING",
      "The frozen protocol snapshot directory is missing.",
      { cause: String(error) },
    );
  }

  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new ProtocolSnapshotIntegrityError(
      "UPSTREAM_SNAPSHOT_NOT_DIRECTORY",
      "The frozen protocol snapshot root must be a real directory.",
    );
  }

  const manifestPath = path.join(snapshotRoot, "SHA256SUMS");
  let manifestBytes;
  try {
    manifestBytes = await readFile(manifestPath);
  } catch (error) {
    throw new ProtocolSnapshotIntegrityError(
      "UPSTREAM_MANIFEST_MISSING",
      "The frozen SHA256SUMS manifest is missing.",
      { cause: String(error) },
    );
  }

  const manifestSha256 = sha256(manifestBytes);
  if (manifestSha256 !== EXPECTED_PROTOCOL_SNAPSHOT.manifestSha256) {
    throw new ProtocolSnapshotIntegrityError(
      "UPSTREAM_MANIFEST_CHECKSUM_MISMATCH",
      "The SHA256SUMS manifest differs from the pinned upstream bytes.",
      { expected: EXPECTED_PROTOCOL_SNAPSHOT.manifestSha256, actual: manifestSha256 },
    );
  }

  const manifestEntries = parseChecksumManifest(manifestBytes);
  if (manifestEntries.length !== EXPECTED_PROTOCOL_SNAPSHOT.manifestEntries) {
    throw new ProtocolSnapshotIntegrityError(
      "UPSTREAM_MANIFEST_ENTRY_COUNT_MISMATCH",
      "The SHA256SUMS entry count differs from the frozen baseline.",
      { expected: EXPECTED_PROTOCOL_SNAPSHOT.manifestEntries, actual: manifestEntries.length },
    );
  }

  const actualPaths = (await inventoryRegularFiles(snapshotRoot)).sort();
  const expectedPaths = [...manifestEntries.map((entry) => entry.path), "SHA256SUMS"].sort();
  const missing = expectedPaths.filter((entryPath) => !actualPaths.includes(entryPath));
  const unexpected = actualPaths.filter((entryPath) => !expectedPaths.includes(entryPath));

  if (missing.length > 0 || unexpected.length > 0) {
    throw new ProtocolSnapshotIntegrityError(
      "UPSTREAM_INVENTORY_MISMATCH",
      "The frozen snapshot has missing or unexpected files.",
      { missing, unexpected },
    );
  }

  const hashesByPath = new Map([["SHA256SUMS", manifestSha256]]);
  let totalBytes = manifestBytes.byteLength;

  for (const entry of manifestEntries) {
    const absolutePath = path.join(snapshotRoot, ...entry.path.split("/"));
    const bytes = await readFile(absolutePath);
    const actualSha256 = sha256(bytes);
    totalBytes += bytes.byteLength;
    hashesByPath.set(entry.path, actualSha256);

    if (actualSha256 !== entry.sha256) {
      throw new ProtocolSnapshotIntegrityError(
        "UPSTREAM_FILE_CHECKSUM_MISMATCH",
        `The frozen snapshot file differs from its manifest: ${entry.path}`,
        { path: entry.path, expected: entry.sha256, actual: actualSha256 },
      );
    }
  }

  const aggregate = createHash("sha256");
  for (const relativePath of actualPaths) {
    aggregate.update(`${relativePath}\0${hashesByPath.get(relativePath)}\n`, "utf8");
  }
  const aggregateSha256 = aggregate.digest("hex");

  if (
    actualPaths.length !== EXPECTED_PROTOCOL_SNAPSHOT.snapshotFiles ||
    totalBytes !== EXPECTED_PROTOCOL_SNAPSHOT.totalBytes ||
    aggregateSha256 !== EXPECTED_PROTOCOL_SNAPSHOT.aggregateSha256
  ) {
    throw new ProtocolSnapshotIntegrityError(
      "UPSTREAM_AGGREGATE_MISMATCH",
      "The frozen snapshot aggregate facts differ from the pinned Git tree.",
      {
        expected: {
          files: EXPECTED_PROTOCOL_SNAPSHOT.snapshotFiles,
          bytes: EXPECTED_PROTOCOL_SNAPSHOT.totalBytes,
          sha256: EXPECTED_PROTOCOL_SNAPSHOT.aggregateSha256,
        },
        actual: { files: actualPaths.length, bytes: totalBytes, sha256: aggregateSha256 },
      },
    );
  }

  let executableModesVerified = false;
  if (process.platform !== "win32") {
    const actualExecutablePaths = [];
    for (const relativePath of actualPaths) {
      const fileStats = await lstat(path.join(snapshotRoot, ...relativePath.split("/")));
      if ((fileStats.mode & 0o111) !== 0) {
        actualExecutablePaths.push(relativePath);
      }
    }

    const expectedExecutablePaths = [...EXPECTED_PROTOCOL_SNAPSHOT.executablePaths].sort();
    if (
      actualExecutablePaths.length !== expectedExecutablePaths.length ||
      actualExecutablePaths.some(
        (relativePath, index) => relativePath !== expectedExecutablePaths[index],
      )
    ) {
      throw new ProtocolSnapshotIntegrityError(
        "UPSTREAM_EXECUTABLE_MODE_MISMATCH",
        "The frozen snapshot executable-file set differs from the upstream Git tree.",
        { expected: expectedExecutablePaths, actual: actualExecutablePaths },
      );
    }
    executableModesVerified = true;
  }

  return Object.freeze({
    protocol: EXPECTED_PROTOCOL_SNAPSHOT.protocol,
    sourceCommit: EXPECTED_PROTOCOL_SNAPSHOT.sourceCommit,
    sourceTree: EXPECTED_PROTOCOL_SNAPSHOT.sourceTree,
    snapshotPath: SNAPSHOT_RELATIVE_PATH,
    snapshotFiles: actualPaths.length,
    manifestEntries: manifestEntries.length,
    totalBytes,
    manifestSha256,
    aggregateSha256,
    executableModesVerified,
  });
}
