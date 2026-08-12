import { constants } from "node:fs";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

import { BUNDLE_PACKAGE_PREFLIGHT_LIMITS } from "@desen/control-plane-api";

import type { InstalledPackageArtifact, InstalledPackageCandidate } from "@desen/control-plane-api";
import type { Dirent, Stats } from "node:fs";

const CATALOG_FILE = "catalog.json";
const DISTRIBUTION_DIRECTORY = "dist";
const MAX_PACKAGE_DIRECTORY_DEPTH = 32;
const MAX_PACKAGE_DIRECTORIES = 1_024;
const MAX_PACKAGE_ENTRIES =
  MAX_PACKAGE_DIRECTORIES + BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactsPerPackage;

/** Trusted application-owned selection for the one installed Web–React package directory. */
export interface LoadReferenceHostInstalledPackageOptions {
  /** Pre-existing absolute canonical package root selected only by host configuration. */
  readonly installedPackageDirectory: string;
}

function codeUnitOrder(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameFileIdentity(before: Stats, after: Stats): boolean {
  return (
    before.dev === after.dev &&
    before.ino === after.ino &&
    before.nlink === 1 &&
    after.nlink === 1 &&
    before.size === after.size &&
    before.mtimeMs === after.mtimeMs &&
    before.ctimeMs === after.ctimeMs
  );
}

async function securelyReadRegularFile(
  path: string,
  expectedRoot: string,
  maximumBytes: number,
): Promise<Uint8Array> {
  let handle;
  try {
    const canonicalParent = await realpath(dirname(path));
    if (canonicalParent !== expectedRoot && !canonicalParent.startsWith(`${expectedRoot}/`)) {
      throw new TypeError("The installed reference package contains an unsafe entry.");
    }
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat();
    if (
      !before.isFile() ||
      before.nlink !== 1 ||
      !Number.isSafeInteger(before.size) ||
      before.size < 0 ||
      before.size > maximumBytes
    ) {
      throw new TypeError("The installed reference package contains an unsafe entry.");
    }
    const bytes = new Uint8Array(await handle.readFile());
    const after = await handle.stat();
    const canonicalParentAfterRead = await realpath(dirname(path));
    const pathAfterRead = await lstat(path);
    if (
      canonicalParentAfterRead !== canonicalParent ||
      !pathAfterRead.isFile() ||
      pathAfterRead.nlink !== 1 ||
      pathAfterRead.dev !== after.dev ||
      pathAfterRead.ino !== after.ino ||
      bytes.byteLength !== before.size ||
      !sameFileIdentity(before, after)
    ) {
      throw new TypeError("The installed reference package changed while it was read.");
    }
    return bytes;
  } catch (error) {
    if (error instanceof TypeError) throw error;
    // eslint-disable-next-line preserve-caught-error -- Filesystem details are redacted by design.
    throw new TypeError("The installed reference package contains an unsafe entry.");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function collectArtifacts(
  distributionRoot: string,
  catalogByteLength: number,
): Promise<readonly InstalledPackageArtifact[]> {
  const rootStatus = await lstat(distributionRoot);
  if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory()) {
    throw new TypeError("The installed reference package distribution is unsafe.");
  }
  const paths: string[] = [];
  let framedByteLength = catalogByteLength + Buffer.byteLength(CATALOG_FILE, "ascii") + 6 + 40;
  let directoryCount = 0;
  let entryCount = 0;
  async function visit(directory: string, prefix: string, depth: number): Promise<void> {
    directoryCount += 1;
    if (depth > MAX_PACKAGE_DIRECTORY_DEPTH || directoryCount > MAX_PACKAGE_DIRECTORIES) {
      throw new TypeError("The installed reference package exceeds its fixed limits.");
    }
    const status = await lstat(directory);
    const canonicalDirectory = await realpath(directory);
    if (
      status.isSymbolicLink() ||
      !status.isDirectory() ||
      canonicalDirectory !== directory ||
      (directory !== distributionRoot && !directory.startsWith(`${distributionRoot}/`))
    ) {
      throw new TypeError("The installed reference package distribution is unsafe.");
    }
    const entries: Dirent[] = [];
    const directoryHandle = await opendir(directory, { bufferSize: 32 });
    for await (const entry of directoryHandle) {
      entryCount += 1;
      if (entryCount > MAX_PACKAGE_ENTRIES) {
        throw new TypeError("The installed reference package exceeds its fixed limits.");
      }
      entries.push(entry);
    }
    entries.sort((left, right) => codeUnitOrder(left.name, right.name));
    for (const entry of entries) {
      if (
        entry.name.length === 0 ||
        entry.name === "." ||
        entry.name === ".." ||
        entry.name.includes("/") ||
        entry.name.includes("\\")
      ) {
        throw new TypeError("The installed reference package distribution is unsafe.");
      }
      const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      const absolute = join(directory, entry.name);
      const entryStatus = await lstat(absolute);
      if (entryStatus.isSymbolicLink()) {
        throw new TypeError("The installed reference package distribution is unsafe.");
      }
      if (entryStatus.isDirectory()) {
        await visit(absolute, relative, depth + 1);
      } else if (entryStatus.isFile() && entryStatus.nlink === 1) {
        const portablePath = `dist/${relative}`;
        const pathByteLength = Buffer.byteLength(portablePath, "utf8");
        if (
          entryStatus.size > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactEntryBytes ||
          pathByteLength > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactPathBytes ||
          !/^[\x21-\x7e]+$/u.test(portablePath)
        ) {
          throw new TypeError("The installed reference package exceeds its fixed limits.");
        }
        framedByteLength += 2 + pathByteLength + 4 + entryStatus.size;
        if (framedByteLength > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxPackagePreimageBytes) {
          throw new TypeError("The installed reference package exceeds its fixed limits.");
        }
        paths.push(relative);
        if (paths.length > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactsPerPackage) {
          throw new TypeError("The installed reference package exceeds its fixed limits.");
        }
      } else {
        throw new TypeError("The installed reference package distribution is unsafe.");
      }
    }
  }
  await visit(distributionRoot, "", 0);
  if (paths.length === 0) {
    throw new TypeError("The installed reference package distribution is empty.");
  }
  const artifacts: InstalledPackageArtifact[] = [];
  for (const path of paths) {
    const absolute = join(distributionRoot, ...path.split("/"));
    const bytes = await securelyReadRegularFile(
      absolute,
      distributionRoot,
      BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactEntryBytes,
    );
    artifacts.push(Object.freeze({ path: `dist/${path}`, bytes }));
  }
  return Object.freeze(artifacts);
}

function catalogIdentity(
  catalog: unknown,
): Readonly<{ readonly id: string; readonly version: string; readonly target: string }> {
  if (catalog === null || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new TypeError("The installed reference Catalog is invalid.");
  }
  const record = catalog as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.version !== "string" ||
    typeof record.target !== "string"
  ) {
    throw new TypeError("The installed reference Catalog is invalid.");
  }
  return Object.freeze({ id: record.id, version: record.version, target: record.target });
}

/**
 * Loads one complete, exact installed package candidate from a fixed host-owned directory.
 *
 * @remarks The path is never derived from a Bundle. Both the package root and every admitted
 * `catalog.json`/`dist/**` entry are checked with `lstat`; symbolic links, devices, sockets and
 * other special files fail closed before material reaches package preflight.
 *
 * @throws {TypeError} When the root is noncanonical, unsafe, malformed, changing, or over limit.
 */
export async function loadReferenceHostInstalledPackage(
  options: LoadReferenceHostInstalledPackageOptions,
): Promise<InstalledPackageCandidate> {
  let requestedRoot: string;
  try {
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError();
    }
    const descriptor = Object.getOwnPropertyDescriptor(options, "installedPackageDirectory");
    if (
      Reflect.ownKeys(options).length !== 1 ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      !isAbsolute(descriptor.value)
    ) {
      throw new TypeError();
    }
    requestedRoot = descriptor.value;
  } catch {
    throw new TypeError("The installed reference package directory is invalid.");
  }
  let rootStatus;
  let canonicalRoot: string;
  try {
    rootStatus = await lstat(requestedRoot);
    canonicalRoot = await realpath(requestedRoot);
  } catch {
    throw new TypeError("The installed reference package directory is invalid.");
  }
  if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory() || canonicalRoot !== requestedRoot) {
    throw new TypeError("The installed reference package directory is unsafe.");
  }

  const catalogPath = join(canonicalRoot, CATALOG_FILE);
  const catalogBytes = await securelyReadRegularFile(
    catalogPath,
    canonicalRoot,
    BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogCanonicalBytes,
  );
  let catalog: unknown;
  try {
    catalog = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(catalogBytes));
  } catch {
    throw new TypeError("The installed reference Catalog is invalid.");
  }
  const identity = catalogIdentity(catalog);
  let artifacts: readonly InstalledPackageArtifact[];
  try {
    artifacts = await collectArtifacts(
      join(canonicalRoot, DISTRIBUTION_DIRECTORY),
      catalogBytes.byteLength,
    );
  } catch (error) {
    if (error instanceof TypeError) throw error;
    // eslint-disable-next-line preserve-caught-error -- Filesystem details are redacted by design.
    throw new TypeError("The installed reference package distribution is unsafe.");
  }
  return Object.freeze({
    id: identity.id,
    version: identity.version,
    target: identity.target,
    catalog,
    artifacts,
  });
}
