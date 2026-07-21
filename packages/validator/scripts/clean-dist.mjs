import { lstat, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const DIST_DIRECTORY = path.join(PACKAGE_ROOT, "dist");

if (path.dirname(DIST_DIRECTORY) !== PACKAGE_ROOT || path.basename(DIST_DIRECTORY) !== "dist") {
  throw new Error("Refusing to clean a path other than the validator package dist directory.");
}

try {
  const stats = await lstat(DIST_DIRECTORY);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error("Refusing to clean a symlink or non-directory dist entry.");
  }
  await rm(DIST_DIRECTORY, { recursive: true });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
