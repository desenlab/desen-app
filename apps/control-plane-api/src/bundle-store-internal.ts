import { constants as bufferConstants } from "node:buffer";
import { randomBytes } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import {
  link,
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import path from "node:path";

import { isSha256Digest } from "@desen/protocol";

import { BundleStoreError } from "./bundle-store-contract.js";

import type {
  BundleStore,
  BundleStoreEntry,
  BundleStorePutResult,
  BundleStoreReadResult,
  OpenBundleStoreOptions,
} from "./bundle-store-contract.js";
import type { BigIntStats } from "node:fs";

const STORE_DIRECTORY_NAME = "bundles";
const ALGORITHM_DIRECTORY_NAME = "sha256";
const ENTRY_FILE_SUFFIX = ".bundle";
const TEMPORARY_RANDOM_BYTES = 16;
const MAX_TEMPORARY_CREATE_ATTEMPTS = 8;
const READ_FLAGS = fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW | fileConstants.O_NONBLOCK;
const DIRECTORY_FLAGS =
  fileConstants.O_RDONLY | fileConstants.O_DIRECTORY | fileConstants.O_NOFOLLOW;
const TEMPORARY_FLAGS =
  fileConstants.O_CREAT | fileConstants.O_EXCL | fileConstants.O_NOFOLLOW | fileConstants.O_RDWR;

const STORED_RESULT = Object.freeze({ status: "stored" } as const);
const UNCHANGED_RESULT = Object.freeze({ status: "unchanged" } as const);
const CONFLICT_RESULT = Object.freeze({ status: "conflict" } as const);
const MISSING_RESULT = Object.freeze({ status: "missing" } as const);

const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedArrayBufferGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer")?.get;
const typedArrayByteLengthGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength",
)?.get;
const typedArrayByteOffsetGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteOffset",
)?.get;
const typedArrayTagGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  Symbol.toStringTag,
)?.get;

interface EntryLocation {
  readonly revision: string;
  readonly shardName: string;
  readonly fileName: string;
}

interface FileIdentity {
  readonly device: bigint;
  readonly inode: bigint;
}

interface DirectoryIdentity extends FileIdentity {
  readonly path: string;
}

interface StoreAuthority {
  readonly root: DirectoryIdentity;
  readonly bundles: DirectoryIdentity;
  readonly algorithm: DirectoryIdentity;
  readonly hooks: BundleStoreInternalHooks | undefined;
}

/** @internal Deterministic fault seam exercised only by focused M07-T01 storage tests. */
export interface BundleStoreInternalHookContext {
  readonly temporaryPath: string;
  readonly finalPath: string;
}

/** @internal Directory durability context retained only by focused M07-T01 fault tests. */
export interface BundleStoreInternalShardHookContext {
  readonly shardPath: string;
}

/** @internal Hooks never cross the package root or production factory. */
export interface BundleStoreInternalHooks {
  readonly afterTemporaryWrite?: (context: BundleStoreInternalHookContext) => void | Promise<void>;
  readonly beforeLink?: (context: BundleStoreInternalHookContext) => void | Promise<void>;
  readonly afterLink?: (context: BundleStoreInternalHookContext) => void | Promise<void>;
  readonly beforeShardParentSync?: (
    context: BundleStoreInternalShardHookContext,
  ) => void | Promise<void>;
  readonly afterCommittedCleanupSync?: (
    context: BundleStoreInternalShardHookContext,
  ) => void | Promise<void>;
}

function systemErrorCode(error: unknown): string | undefined {
  try {
    if (error === null || typeof error !== "object") return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    return descriptor !== undefined && "value" in descriptor && typeof descriptor.value === "string"
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function fileIdentity(entry: BigIntStats): FileIdentity {
  return Object.freeze({ device: entry.dev, inode: entry.ino });
}

function sameIdentity(entry: BigIntStats, expected: FileIdentity): boolean {
  return entry.dev === expected.device && entry.ino === expected.inode;
}

function sameStableFile(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function sameLinkedFile(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs
  );
}

async function optionalLstat(entryPath: string): Promise<BigIntStats | undefined> {
  try {
    return await lstat(entryPath, { bigint: true });
  } catch (error) {
    if (systemErrorCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

async function createDirectoryIfMissing(directoryPath: string): Promise<boolean> {
  try {
    await mkdir(directoryPath, { mode: 0o700 });
    return true;
  } catch (error) {
    if (systemErrorCode(error) !== "EEXIST") throw error;
    return false;
  }
}

async function captureDirectory(directoryPath: string): Promise<DirectoryIdentity> {
  const entry = await optionalLstat(directoryPath);
  if (entry === undefined || !entry.isDirectory() || entry.isSymbolicLink()) {
    throw new BundleStoreError("UNSAFE_STORAGE_PATH");
  }
  const canonicalPath = await realpath(directoryPath);
  if (canonicalPath !== directoryPath) {
    throw new BundleStoreError("UNSAFE_STORAGE_PATH");
  }
  return Object.freeze({
    path: directoryPath,
    ...fileIdentity(entry),
  });
}

async function assertDirectoryIdentity(directory: DirectoryIdentity): Promise<void> {
  const entry = await optionalLstat(directory.path);
  if (
    entry === undefined ||
    !entry.isDirectory() ||
    entry.isSymbolicLink() ||
    !sameIdentity(entry, directory)
  ) {
    throw new BundleStoreError("UNSAFE_STORAGE_PATH");
  }
  const canonicalPath = await realpath(directory.path);
  if (canonicalPath !== directory.path) {
    throw new BundleStoreError("UNSAFE_STORAGE_PATH");
  }
}

async function syncDirectory(directory: DirectoryIdentity): Promise<void> {
  await assertDirectoryIdentity(directory);
  const handle = await open(directory.path, DIRECTORY_FLAGS);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isDirectory() || !sameIdentity(before, directory)) {
      throw new BundleStoreError("UNSAFE_STORAGE_PATH");
    }
    await handle.sync();
    const after = await handle.stat({ bigint: true });
    if (!after.isDirectory() || !sameIdentity(after, directory)) {
      throw new BundleStoreError("UNSAFE_STORAGE_PATH");
    }
    await assertDirectoryIdentity(directory);
  } finally {
    await handle.close();
  }
}

function captureRootDirectory(input: unknown): string {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new BundleStoreError("INVALID_ROOT_DIRECTORY");
  }
  try {
    const prototype = Object.getPrototypeOf(input);
    const keys = Reflect.ownKeys(input);
    const descriptor = Object.getOwnPropertyDescriptor(input, "rootDirectory");
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      keys.length !== 1 ||
      keys[0] !== "rootDirectory" ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      descriptor.value.length === 0 ||
      descriptor.value.includes("\0") ||
      !path.isAbsolute(descriptor.value)
    ) {
      throw new BundleStoreError("INVALID_ROOT_DIRECTORY");
    }
    return path.resolve(descriptor.value);
  } catch (error) {
    if (error instanceof BundleStoreError) throw error;
    throw new BundleStoreError("INVALID_ROOT_DIRECTORY");
  }
}

async function initializeAuthority(
  options: OpenBundleStoreOptions,
  hooks: BundleStoreInternalHooks | undefined,
): Promise<StoreAuthority> {
  const requestedRoot = captureRootDirectory(options);
  try {
    const rootEntry = await optionalLstat(requestedRoot);
    if (rootEntry === undefined) {
      throw new BundleStoreError("INVALID_ROOT_DIRECTORY");
    }
    if (!rootEntry.isDirectory() || rootEntry.isSymbolicLink()) {
      throw new BundleStoreError("UNSAFE_STORAGE_PATH");
    }
    const canonicalRoot = await realpath(requestedRoot);
    const root = await captureDirectory(canonicalRoot);

    const bundlesPath = path.join(root.path, STORE_DIRECTORY_NAME);
    await createDirectoryIfMissing(bundlesPath);
    const bundles = await captureDirectory(bundlesPath);
    await syncDirectory(root);

    const algorithmPath = path.join(bundles.path, ALGORITHM_DIRECTORY_NAME);
    await createDirectoryIfMissing(algorithmPath);
    const algorithm = await captureDirectory(algorithmPath);
    await syncDirectory(bundles);

    await assertDirectoryIdentity(root);
    await assertDirectoryIdentity(bundles);
    return Object.freeze({ root, bundles, algorithm, hooks });
  } catch (error) {
    if (error instanceof BundleStoreError) throw error;
    throw new BundleStoreError("STORAGE_IO_FAILURE");
  }
}

function captureRevision(value: unknown): EntryLocation {
  if (!isSha256Digest(value)) throw new BundleStoreError("INVALID_REVISION");
  const hexadecimal = value.slice("sha256:".length);
  return Object.freeze({
    revision: value,
    shardName: hexadecimal.slice(0, 2),
    fileName: `${hexadecimal.slice(2)}${ENTRY_FILE_SUFFIX}`,
  });
}

function captureBytes(value: unknown): Buffer {
  try {
    if (
      !ArrayBuffer.isView(value) ||
      typedArrayBufferGetter === undefined ||
      typedArrayByteLengthGetter === undefined ||
      typedArrayByteOffsetGetter === undefined ||
      typedArrayTagGetter === undefined
    ) {
      throw new BundleStoreError("INVALID_ENTRY");
    }
    const tag = Reflect.apply(typedArrayTagGetter, value, []) as unknown;
    const buffer = Reflect.apply(typedArrayBufferGetter, value, []) as unknown;
    const byteLength = Reflect.apply(typedArrayByteLengthGetter, value, []) as unknown;
    const byteOffset = Reflect.apply(typedArrayByteOffsetGetter, value, []) as unknown;
    if (
      tag !== "Uint8Array" ||
      !(buffer instanceof ArrayBuffer) ||
      typeof byteLength !== "number" ||
      typeof byteOffset !== "number" ||
      !Number.isSafeInteger(byteLength) ||
      !Number.isSafeInteger(byteOffset) ||
      byteLength <= 0 ||
      byteLength > bufferConstants.MAX_LENGTH
    ) {
      throw new BundleStoreError("INVALID_ENTRY");
    }
    const exactView = new Uint8Array(buffer, byteOffset, byteLength);
    return Buffer.from(exactView);
  } catch (error) {
    if (error instanceof BundleStoreError) throw error;
    throw new BundleStoreError("INVALID_ENTRY");
  }
}

function captureEntry(value: unknown): Readonly<{ location: EntryLocation; bytes: Buffer }> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new BundleStoreError("INVALID_ENTRY");
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    const keys = Reflect.ownKeys(value);
    const revision = Object.getOwnPropertyDescriptor(value, "revision");
    const bytes = Object.getOwnPropertyDescriptor(value, "bytes");
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      keys.length !== 2 ||
      !keys.includes("revision") ||
      !keys.includes("bytes") ||
      revision === undefined ||
      !revision.enumerable ||
      !("value" in revision) ||
      bytes === undefined ||
      !bytes.enumerable ||
      !("value" in bytes)
    ) {
      throw new BundleStoreError("INVALID_ENTRY");
    }
    return Object.freeze({
      location: captureRevision(revision.value),
      bytes: captureBytes(bytes.value),
    });
  } catch (error) {
    if (error instanceof BundleStoreError) throw error;
    throw new BundleStoreError("INVALID_ENTRY");
  }
}

function locationPaths(
  authority: StoreAuthority,
  location: EntryLocation,
): Readonly<{ shardPath: string; finalPath: string }> {
  const shardPath = path.join(authority.algorithm.path, location.shardName);
  return Object.freeze({
    shardPath,
    finalPath: path.join(shardPath, location.fileName),
  });
}

async function existingShard(
  authority: StoreAuthority,
  location: EntryLocation,
): Promise<DirectoryIdentity | undefined> {
  await assertDirectoryIdentity(authority.root);
  await assertDirectoryIdentity(authority.bundles);
  await assertDirectoryIdentity(authority.algorithm);
  const { shardPath } = locationPaths(authority, location);
  const entry = await optionalLstat(shardPath);
  if (entry === undefined) {
    await assertDirectoryIdentity(authority.algorithm);
    return undefined;
  }
  return captureDirectory(shardPath);
}

async function ensureShard(
  authority: StoreAuthority,
  location: EntryLocation,
): Promise<DirectoryIdentity> {
  const current = await existingShard(authority, location);
  if (current !== undefined) {
    await establishShardParentDurability(authority, current);
    return current;
  }
  const { shardPath } = locationPaths(authority, location);
  try {
    await createDirectoryIfMissing(shardPath);
    const shard = await captureDirectory(shardPath);
    await establishShardParentDurability(authority, shard);
    return shard;
  } catch (error) {
    if (error instanceof BundleStoreError) throw error;
    throw new BundleStoreError("STORAGE_IO_FAILURE");
  }
}

async function establishShardParentDurability(
  authority: StoreAuthority,
  shard: DirectoryIdentity,
): Promise<void> {
  await assertDirectoryIdentity(authority.algorithm);
  await invokeHook(
    authority.hooks?.beforeShardParentSync,
    Object.freeze({ shardPath: shard.path }),
  );
  await syncDirectory(authority.algorithm);
  await assertDirectoryIdentity(shard);
}

function hasStoredMode(entry: BigIntStats): boolean {
  return (entry.mode & 0o777n) === 0o400n;
}

function isOwnedTemporaryName(fileName: string, candidateName: string): boolean {
  return candidateName.startsWith(`.${fileName}.`) && candidateName.endsWith(".tmp");
}

async function removeCommittedTemporaryAliases(
  filePath: string,
  parent: DirectoryIdentity,
  finalEntry: BigIntStats,
): Promise<BigIntStats> {
  if (finalEntry.nlink <= 1n) return finalEntry;
  const fileName = path.basename(filePath);
  const candidates = await readdir(parent.path, { withFileTypes: true });
  let removed = false;
  for (const candidate of candidates) {
    if (!isOwnedTemporaryName(fileName, candidate.name)) continue;
    const candidatePath = path.join(parent.path, candidate.name);
    const candidateEntry = await optionalLstat(candidatePath);
    if (
      candidateEntry === undefined ||
      !candidateEntry.isFile() ||
      candidateEntry.isSymbolicLink() ||
      !sameIdentity(candidateEntry, fileIdentity(finalEntry))
    ) {
      continue;
    }
    try {
      await unlink(candidatePath);
      removed = true;
    } catch (error) {
      if (systemErrorCode(error) !== "ENOENT") throw error;
    }
  }
  if (removed) await syncDirectory(parent);
  const refreshed = await optionalLstat(filePath);
  if (
    refreshed === undefined ||
    !refreshed.isFile() ||
    refreshed.isSymbolicLink() ||
    !sameIdentity(refreshed, fileIdentity(finalEntry))
  ) {
    throw new BundleStoreError("UNSAFE_STORAGE_PATH");
  }
  return refreshed;
}

async function readRegularFile(
  filePath: string,
  parent: DirectoryIdentity,
): Promise<Buffer | undefined> {
  await assertDirectoryIdentity(parent);
  const pathEntry = await optionalLstat(filePath);
  if (pathEntry === undefined) {
    await assertDirectoryIdentity(parent);
    return undefined;
  }
  if (!pathEntry.isFile() || pathEntry.isSymbolicLink()) {
    throw new BundleStoreError("UNSAFE_STORAGE_PATH");
  }
  const stablePathEntry = await removeCommittedTemporaryAliases(filePath, parent, pathEntry);
  if (!hasStoredMode(stablePathEntry) || stablePathEntry.nlink !== 1n) {
    throw new BundleStoreError("UNSAFE_STORAGE_PATH");
  }

  let handle: FileHandle;
  try {
    handle = await open(filePath, READ_FLAGS);
  } catch (error) {
    if (systemErrorCode(error) === "ENOENT") {
      await assertDirectoryIdentity(parent);
      return undefined;
    }
    if (systemErrorCode(error) === "ELOOP") {
      throw new BundleStoreError("UNSAFE_STORAGE_PATH");
    }
    throw error;
  }

  try {
    const before = await handle.stat({ bigint: true });
    const namedBefore = await optionalLstat(filePath);
    if (
      !before.isFile() ||
      namedBefore === undefined ||
      !namedBefore.isFile() ||
      namedBefore.isSymbolicLink() ||
      !sameIdentity(namedBefore, fileIdentity(before)) ||
      !hasStoredMode(before) ||
      !hasStoredMode(namedBefore) ||
      before.nlink !== 1n ||
      namedBefore.nlink !== 1n
    ) {
      throw new BundleStoreError("UNSAFE_STORAGE_PATH");
    }
    if (before.size < 0n || before.size > BigInt(bufferConstants.MAX_LENGTH)) {
      throw new BundleStoreError("STORAGE_IO_FAILURE");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    const namedAfter = await optionalLstat(filePath);
    if (
      namedAfter === undefined ||
      !namedAfter.isFile() ||
      namedAfter.isSymbolicLink() ||
      !sameLinkedFile(before, after) ||
      !sameLinkedFile(after, namedAfter) ||
      !hasStoredMode(after) ||
      !hasStoredMode(namedAfter) ||
      after.nlink !== 1n ||
      namedAfter.nlink !== 1n ||
      BigInt(bytes.byteLength) !== after.size
    ) {
      throw new BundleStoreError("UNSAFE_STORAGE_PATH");
    }
    await syncDirectory(parent);
    return Buffer.from(bytes);
  } finally {
    await handle.close();
  }
}

async function createTemporary(
  shard: DirectoryIdentity,
  location: EntryLocation,
): Promise<Readonly<{ handle: FileHandle; path: string }>> {
  for (let attempt = 0; attempt < MAX_TEMPORARY_CREATE_ATTEMPTS; attempt += 1) {
    const temporaryPath = path.join(
      shard.path,
      `.${location.fileName}.${randomBytes(TEMPORARY_RANDOM_BYTES).toString("hex")}.tmp`,
    );
    try {
      const handle = await open(temporaryPath, TEMPORARY_FLAGS, 0o600);
      return Object.freeze({ handle, path: temporaryPath });
    } catch (error) {
      if (systemErrorCode(error) !== "EEXIST") throw error;
    }
  }
  throw new BundleStoreError("STORAGE_IO_FAILURE");
}

async function writeAll(handle: FileHandle, bytes: Buffer): Promise<void> {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const result = await handle.write(bytes, offset, bytes.byteLength - offset, offset);
    if (result.bytesWritten <= 0) throw new BundleStoreError("STORAGE_IO_FAILURE");
    offset += result.bytesWritten;
  }
}

async function readExactHandle(
  handle: FileHandle,
  expected: Buffer,
): Promise<Readonly<{ identity: FileIdentity; stats: BigIntStats }>> {
  const before = await handle.stat({ bigint: true });
  if (!before.isFile() || before.size !== BigInt(expected.byteLength)) {
    throw new BundleStoreError("UNSAFE_STORAGE_PATH");
  }
  const observed = Buffer.alloc(expected.byteLength);
  let offset = 0;
  while (offset < observed.byteLength) {
    const result = await handle.read(observed, offset, observed.byteLength - offset, offset);
    if (result.bytesRead <= 0) throw new BundleStoreError("UNSAFE_STORAGE_PATH");
    offset += result.bytesRead;
  }
  const extra = Buffer.alloc(1);
  const trailing = await handle.read(extra, 0, 1, observed.byteLength);
  const after = await handle.stat({ bigint: true });
  if (trailing.bytesRead !== 0 || !sameStableFile(before, after) || !observed.equals(expected)) {
    throw new BundleStoreError("UNSAFE_STORAGE_PATH");
  }
  return Object.freeze({ identity: fileIdentity(after), stats: after });
}

async function assertNamedIdentity(
  entryPath: string,
  expected: FileIdentity,
): Promise<BigIntStats> {
  const entry = await optionalLstat(entryPath);
  if (
    entry === undefined ||
    !entry.isFile() ||
    entry.isSymbolicLink() ||
    !sameIdentity(entry, expected)
  ) {
    throw new BundleStoreError("UNSAFE_STORAGE_PATH");
  }
  return entry;
}

async function removeOwnedTemporary(temporaryPath: string, identity: FileIdentity): Promise<void> {
  const named = await optionalLstat(temporaryPath);
  if (named === undefined) return;
  if (!named.isFile() || named.isSymbolicLink() || !sameIdentity(named, identity)) {
    throw new BundleStoreError("UNSAFE_STORAGE_PATH");
  }
  try {
    await unlink(temporaryPath);
  } catch (error) {
    if (systemErrorCode(error) !== "ENOENT") throw error;
  }
}

async function invokeHook<Context>(
  hook: ((context: Context) => void | Promise<void>) | undefined,
  context: Context,
): Promise<void> {
  if (hook !== undefined) await hook(context);
}

function normalizeOperationError(error: unknown, committed: boolean): BundleStoreError {
  if (committed) return new BundleStoreError("COMMIT_OUTCOME_INDETERMINATE");
  return error instanceof BundleStoreError ? error : new BundleStoreError("STORAGE_IO_FAILURE");
}

async function cleanupTemporary(
  shard: DirectoryIdentity,
  hooks: BundleStoreInternalHooks | undefined,
  temporary: Readonly<{ handle: FileHandle; path: string }> | undefined,
  identity: FileIdentity | undefined,
  handleClosed: boolean,
  temporaryRemoved: boolean,
  committed: boolean,
): Promise<BundleStoreError | undefined> {
  let cleanupError: BundleStoreError | undefined;
  if (!handleClosed && temporary !== undefined) {
    try {
      await temporary.handle.close();
    } catch {
      cleanupError ??= normalizeOperationError(undefined, committed);
    }
  }
  if (!temporaryRemoved && temporary !== undefined && identity !== undefined) {
    try {
      await removeOwnedTemporary(temporary.path, identity);
    } catch {
      cleanupError ??= normalizeOperationError(undefined, committed);
    }
  }
  if (committed) {
    try {
      await syncDirectory(shard);
      await invokeHook(hooks?.afterCommittedCleanupSync, Object.freeze({ shardPath: shard.path }));
    } catch {
      cleanupError ??= new BundleStoreError("COMMIT_OUTCOME_INDETERMINATE");
    }
  }
  return cleanupError;
}

async function putNewEntry(
  authority: StoreAuthority,
  shard: DirectoryIdentity,
  location: EntryLocation,
  bytes: Buffer,
): Promise<BundleStorePutResult> {
  const finalPath = path.join(shard.path, location.fileName);
  let temporary: Readonly<{ handle: FileHandle; path: string }> | undefined;
  let temporaryIdentity: FileIdentity | undefined;
  let temporaryRemoved = false;
  let handleClosed = false;
  let committed = false;
  let outcome: BundleStorePutResult | undefined;

  try {
    temporary = await createTemporary(shard, location);
    const created = await temporary.handle.stat({ bigint: true });
    if (!created.isFile()) throw new BundleStoreError("UNSAFE_STORAGE_PATH");
    temporaryIdentity = fileIdentity(created);
    await assertNamedIdentity(temporary.path, temporaryIdentity);
    const context = Object.freeze({
      temporaryPath: temporary.path,
      finalPath,
    });
    await writeAll(temporary.handle, bytes);
    await invokeHook(authority.hooks?.afterTemporaryWrite, context);
    await temporary.handle.chmod(0o400);
    await temporary.handle.sync();

    const verified = await readExactHandle(temporary.handle, bytes);
    temporaryIdentity = verified.identity;
    const namedTemporary = await assertNamedIdentity(temporary.path, verified.identity);
    if (!sameStableFile(verified.stats, namedTemporary)) {
      throw new BundleStoreError("UNSAFE_STORAGE_PATH");
    }
    await assertDirectoryIdentity(shard);
    await invokeHook(authority.hooks?.beforeLink, context);
    await assertDirectoryIdentity(shard);
    await assertNamedIdentity(temporary.path, verified.identity);

    try {
      await link(temporary.path, finalPath);
      committed = true;
    } catch (error) {
      if (systemErrorCode(error) !== "EEXIST") throw error;
      const existing = await readRegularFile(finalPath, shard);
      if (existing === undefined) throw new BundleStoreError("STORAGE_IO_FAILURE");
      outcome = existing.equals(bytes) ? UNCHANGED_RESULT : CONFLICT_RESULT;
    }

    if (outcome === undefined) {
      const finalEntry = await assertNamedIdentity(finalPath, verified.identity);
      if (!sameLinkedFile(verified.stats, finalEntry)) {
        throw new BundleStoreError("UNSAFE_STORAGE_PATH");
      }
      await invokeHook(authority.hooks?.afterLink, context);
      await syncDirectory(shard);

      await removeOwnedTemporary(temporary.path, verified.identity);
      temporaryRemoved = true;
      await syncDirectory(shard);
      await temporary.handle.close();
      handleClosed = true;

      const committedBytes = await readRegularFile(finalPath, shard);
      if (committedBytes === undefined || !committedBytes.equals(bytes)) {
        throw new BundleStoreError("UNSAFE_STORAGE_PATH");
      }
      outcome = STORED_RESULT;
    }
  } catch (error) {
    const operationError = normalizeOperationError(error, committed);
    const cleanupError = await cleanupTemporary(
      shard,
      authority.hooks,
      temporary,
      temporaryIdentity,
      handleClosed,
      temporaryRemoved,
      committed,
    );
    throw cleanupError ?? operationError;
  }

  const cleanupError = await cleanupTemporary(
    shard,
    authority.hooks,
    temporary,
    temporaryIdentity,
    handleClosed,
    temporaryRemoved,
    committed,
  );
  if (cleanupError !== undefined) throw cleanupError;
  if (outcome === undefined) throw new BundleStoreError("STORAGE_IO_FAILURE");
  return outcome;
}

async function readCaptured(
  authority: StoreAuthority,
  location: EntryLocation,
): Promise<BundleStoreReadResult> {
  try {
    const shard = await existingShard(authority, location);
    if (shard === undefined) return MISSING_RESULT;
    const finalPath = path.join(shard.path, location.fileName);
    const bytes = await readRegularFile(finalPath, shard);
    if (bytes === undefined) return MISSING_RESULT;
    const entry = Object.freeze({
      revision: location.revision,
      bytes: new Uint8Array(bytes),
    });
    return Object.freeze({ status: "found", entry });
  } catch (error) {
    if (error instanceof BundleStoreError) throw error;
    throw new BundleStoreError("STORAGE_IO_FAILURE");
  }
}

async function putCaptured(
  authority: StoreAuthority,
  location: EntryLocation,
  bytes: Buffer,
): Promise<BundleStorePutResult> {
  try {
    const shard = await ensureShard(authority, location);
    const finalPath = path.join(shard.path, location.fileName);
    const existing = await readRegularFile(finalPath, shard);
    if (existing !== undefined) {
      return existing.equals(bytes) ? UNCHANGED_RESULT : CONFLICT_RESULT;
    }
    return await putNewEntry(authority, shard, location, bytes);
  } catch (error) {
    if (error instanceof BundleStoreError) throw error;
    throw new BundleStoreError("STORAGE_IO_FAILURE");
  }
}

/**
 * @internal Opens the production store with a task-local deterministic filesystem fault seam.
 */
export async function openBundleStoreInternal(
  options: OpenBundleStoreOptions,
  hooks?: BundleStoreInternalHooks,
): Promise<BundleStore> {
  const authority = await initializeAuthority(options, hooks);
  return Object.freeze({
    getBundle(revision: string): Promise<BundleStoreReadResult> {
      const location = captureRevision(revision);
      return readCaptured(authority, location);
    },
    putBundle(entry: BundleStoreEntry): Promise<BundleStorePutResult> {
      const captured = captureEntry(entry);
      return putCaptured(authority, captured.location, captured.bytes);
    },
  });
}
