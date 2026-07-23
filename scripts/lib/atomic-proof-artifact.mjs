import { randomBytes } from "node:crypto";
import { lstat, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";

function byteEqual(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}

async function optionalLstat(entryPath) {
  try {
    return await lstat(entryPath);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

async function assertRegularDestination(artifactPath) {
  const entry = await optionalLstat(artifactPath);
  if (entry !== undefined && !entry.isFile()) {
    throw new TypeError(`Proof artifact destination must be a regular file: ${artifactPath}`);
  }
}

async function removeTemporary(temporaryPath) {
  try {
    await unlink(temporaryPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/**
 * Writes exact proof bytes through an exclusive same-directory temporary and atomic rename.
 *
 * The caller supplies already deterministic bytes. This helper owns only destination safety:
 * existing symlinks and non-files are rejected, the open temporary inode and bytes are rechecked
 * immediately before rename, and committed bytes are read back before success is reported.
 */
export async function writeAtomicProofArtifact({
  artifactPath,
  artifactBytes,
  beforeAtomicRename,
}) {
  const absoluteArtifactPath = path.resolve(artifactPath);
  const parent = await realpath(path.dirname(absoluteArtifactPath));
  const resolvedArtifactPath = path.join(parent, path.basename(absoluteArtifactPath));
  await assertRegularDestination(resolvedArtifactPath);

  const temporaryPath = path.join(
    parent,
    `.${path.basename(resolvedArtifactPath)}.${randomBytes(12).toString("hex")}.tmp`,
  );
  const handle = await open(temporaryPath, "wx", 0o600);
  let handleOpen = true;
  try {
    await handle.writeFile(artifactBytes);
    await handle.sync();
    if (beforeAtomicRename !== undefined) {
      await beforeAtomicRename(
        Object.freeze({ artifactPath: resolvedArtifactPath, temporaryPath }),
      );
    }

    const [handleEntry, pathEntry, temporaryBytes] = await Promise.all([
      handle.stat(),
      lstat(temporaryPath),
      readFile(temporaryPath),
    ]);
    if (
      !handleEntry.isFile() ||
      !pathEntry.isFile() ||
      handleEntry.dev !== pathEntry.dev ||
      handleEntry.ino !== pathEntry.ino
    ) {
      throw new TypeError("Proof artifact temporary path no longer names the open regular file");
    }
    if (!byteEqual(temporaryBytes, artifactBytes)) {
      throw new TypeError("Proof artifact temporary bytes changed before atomic rename");
    }

    await assertRegularDestination(resolvedArtifactPath);
    await handle.close();
    handleOpen = false;
    await rename(temporaryPath, resolvedArtifactPath);

    const [committedEntry, committedBytes] = await Promise.all([
      lstat(resolvedArtifactPath),
      readFile(resolvedArtifactPath),
    ]);
    if (!committedEntry.isFile() || !byteEqual(committedBytes, artifactBytes)) {
      throw new TypeError("Committed proof artifact identity or bytes differ from the input");
    }
    return Object.freeze({ artifactPath: resolvedArtifactPath });
  } catch (error) {
    if (handleOpen) {
      try {
        await handle.close();
      } catch {
        // Preserve the primary writer error.
      }
    }
    await removeTemporary(temporaryPath);
    throw error;
  }
}
