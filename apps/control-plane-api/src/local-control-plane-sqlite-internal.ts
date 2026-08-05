import { Buffer } from "node:buffer";
import { constants as fileConstants } from "node:fs";
import {
  closeSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  realpathSync,
  type BigIntStats,
} from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { LocalControlPlaneRepositoryError } from "./local-control-plane-repository-internal.js";

import type {
  ChannelRecord,
  ChannelRepository,
  RepositoryReadResult,
  RepositoryWriteResult,
  SourceRecord,
  SourceRepository,
} from "./local-control-plane-repository-internal.js";

const SCHEMA_VERSION = 1;
const BUSY_TIMEOUT_MILLISECONDS = 5_000;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_GENERATION = Number.MAX_SAFE_INTEGER;
const MAX_GENERATION_BIGINT = 9_007_199_254_740_991n;
const LOCAL_METADATA_KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const BUNDLE_REVISION_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DATABASE_SIDECAR_SUFFIXES = Object.freeze(["-journal", "-shm", "-wal"] as const);

const SOURCE_TABLE_SQL = [
  "CREATE TABLE sources (",
  "source_key TEXT PRIMARY KEY NOT NULL",
  "CHECK(length(source_key) BETWEEN 1 AND 64)",
  "CHECK(substr(source_key, 1, 1) GLOB '[a-z]')",
  "CHECK(source_key NOT GLOB '*[^a-z0-9-]*')",
  ", source_bytes BLOB NOT NULL",
  `CHECK(length(source_bytes) BETWEEN 1 AND ${String(MAX_SOURCE_BYTES)})`,
  ", generation INTEGER NOT NULL",
  `CHECK(generation BETWEEN 1 AND ${String(MAX_GENERATION)})`,
  ") STRICT",
].join(" ");

const CHANNEL_TABLE_SQL = [
  "CREATE TABLE channels (",
  "channel_name TEXT PRIMARY KEY NOT NULL",
  "CHECK(length(channel_name) BETWEEN 1 AND 64)",
  "CHECK(substr(channel_name, 1, 1) GLOB '[a-z]')",
  "CHECK(channel_name NOT GLOB '*[^a-z0-9-]*')",
  ", revision TEXT NOT NULL",
  "CHECK(length(revision) = 71)",
  "CHECK(substr(revision, 1, 7) = 'sha256:')",
  "CHECK(substr(revision, 8) NOT GLOB '*[^0-9a-f]*')",
  ", generation INTEGER NOT NULL",
  `CHECK(generation BETWEEN 1 AND ${String(MAX_GENERATION)})`,
  ") STRICT",
].join(" ");

const EXPECTED_SCHEMA = Object.freeze(
  new Map<string, string>([
    ["channels", CHANNEL_TABLE_SQL],
    ["sources", SOURCE_TABLE_SQL],
  ]),
);

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
const uint8ArraySet = Uint8Array.prototype.set;

/** Stable failures emitted by the package-private SQLite metadata composition. @internal */
export type LocalControlPlaneMetadataErrorCode =
  "METADATA_BUSY" | "METADATA_CORRUPT" | "STORAGE_IO_FAILURE" | "UNSAFE_STORAGE_PATH";

const METADATA_ERROR_MESSAGES: Readonly<Record<LocalControlPlaneMetadataErrorCode, string>> =
  Object.freeze({
    METADATA_BUSY: "The local metadata repository is busy.",
    METADATA_CORRUPT: "The local metadata repository is inconsistent.",
    STORAGE_IO_FAILURE: "The local control plane could not complete the storage operation.",
    UNSAFE_STORAGE_PATH: "The local control plane encountered an unsafe storage entry.",
  });

/** Redacted package-private failure raised by the SQLite metadata boundary. @internal */
export class LocalControlPlaneMetadataError extends Error {
  /** Stable reason for the rejected metadata operation. */
  readonly code: LocalControlPlaneMetadataErrorCode;

  /** Creates one fixed-message metadata failure without retaining its technical cause. */
  constructor(code: LocalControlPlaneMetadataErrorCode) {
    super(METADATA_ERROR_MESSAGES[code]);
    this.name = "LocalControlPlaneMetadataError";
    this.code = code;
  }
}

/** One open SQLite composition over editable Source and mutable channel repositories. @internal */
export interface SqliteLocalControlPlaneRepositories {
  /** Exact-byte editable Source repository backed by the shared metadata database. */
  readonly sourceRepository: SourceRepository;
  /** Mutable channel-pointer repository backed by the shared metadata database. */
  readonly channelRepository: ChannelRepository;
  /** Idempotently closes prepared statements and the owned SQLite connection. */
  readonly close: () => void;
}

interface FileIdentity {
  readonly device: bigint;
  readonly inode: bigint;
}

interface SchemaRow {
  readonly name: unknown;
  readonly sql: unknown;
  readonly tableName: unknown;
  readonly type: unknown;
}

interface SourceDatabaseRow {
  readonly sourceKey: unknown;
  readonly sourceBytes: unknown;
  readonly generation: unknown;
}

interface ChannelDatabaseRow {
  readonly channelName: unknown;
  readonly revision: unknown;
  readonly generation: unknown;
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

function sqliteErrorCode(error: unknown): string | undefined {
  try {
    if (!(error instanceof Database.SqliteError)) return undefined;
    return typeof error.code === "string" ? error.code : undefined;
  } catch {
    return undefined;
  }
}

function translateStorageError(error: unknown): LocalControlPlaneMetadataError {
  const code = sqliteErrorCode(error);
  if (code?.startsWith("SQLITE_BUSY") === true || code?.startsWith("SQLITE_LOCKED") === true) {
    return new LocalControlPlaneMetadataError("METADATA_BUSY");
  }
  if (
    code === "SQLITE_AUTH" ||
    code === "SQLITE_CORRUPT" ||
    code === "SQLITE_ERROR" ||
    code === "SQLITE_FORMAT" ||
    code === "SQLITE_MISMATCH" ||
    code === "SQLITE_NOTADB" ||
    code === "SQLITE_RANGE" ||
    code === "SQLITE_SCHEMA" ||
    code?.startsWith("SQLITE_CONSTRAINT") === true
  ) {
    return new LocalControlPlaneMetadataError("METADATA_CORRUPT");
  }
  return new LocalControlPlaneMetadataError("STORAGE_IO_FAILURE");
}

function withMetadataErrors<Result>(operation: () => Result): Result {
  try {
    return operation();
  } catch (error) {
    if (
      error instanceof LocalControlPlaneMetadataError ||
      error instanceof LocalControlPlaneRepositoryError
    ) {
      throw error;
    }
    throw translateStorageError(error);
  }
}

function unsafeStoragePath(): never {
  throw new LocalControlPlaneMetadataError("UNSAFE_STORAGE_PATH");
}

function optionalLstat(entryPath: string): BigIntStats | undefined {
  try {
    return lstatSync(entryPath, { bigint: true });
  } catch (error) {
    if (systemErrorCode(error) === "ENOENT") return undefined;
    if (systemErrorCode(error) === "ELOOP" || systemErrorCode(error) === "ENOTDIR") {
      unsafeStoragePath();
    }
    throw new LocalControlPlaneMetadataError("STORAGE_IO_FAILURE");
  }
}

function assertCanonicalParent(metadataFilePath: string): void {
  const parentPath = path.dirname(metadataFilePath);
  const parent = optionalLstat(parentPath);
  if (
    parent === undefined ||
    !parent.isDirectory() ||
    parent.isSymbolicLink() ||
    parent.nlink < 1n
  ) {
    unsafeStoragePath();
  }
  try {
    if (realpathSync.native(parentPath) !== parentPath) unsafeStoragePath();
  } catch (error) {
    if (error instanceof LocalControlPlaneMetadataError) throw error;
    throw new LocalControlPlaneMetadataError("STORAGE_IO_FAILURE");
  }
}

function assertSafeOptionalSidecar(sidecarPath: string): void {
  const entry = optionalLstat(sidecarPath);
  if (entry === undefined) return;
  if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1n) unsafeStoragePath();
  try {
    if (realpathSync.native(sidecarPath) !== sidecarPath) unsafeStoragePath();
  } catch (error) {
    if (error instanceof LocalControlPlaneMetadataError) throw error;
    throw new LocalControlPlaneMetadataError("STORAGE_IO_FAILURE");
  }
}

function captureRegularFileIdentity(metadataFilePath: string): FileIdentity {
  const entry = optionalLstat(metadataFilePath);
  if (entry === undefined || !entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1n) {
    unsafeStoragePath();
  }
  try {
    if (realpathSync.native(metadataFilePath) !== metadataFilePath) unsafeStoragePath();
  } catch (error) {
    if (error instanceof LocalControlPlaneMetadataError) throw error;
    throw new LocalControlPlaneMetadataError("STORAGE_IO_FAILURE");
  }
  return Object.freeze({ device: entry.dev, inode: entry.ino });
}

function syncParentDirectory(metadataFilePath: string): void {
  let descriptor: number | undefined;
  let failure: unknown;
  try {
    descriptor = openSync(
      path.dirname(metadataFilePath),
      fileConstants.O_RDONLY | fileConstants.O_DIRECTORY | fileConstants.O_NOFOLLOW,
    );
    const entry = fstatSync(descriptor, { bigint: true });
    if (!entry.isDirectory() || entry.nlink < 1n) unsafeStoragePath();
    fsyncSync(descriptor);
  } catch (error) {
    failure = error;
  }
  if (descriptor !== undefined) {
    try {
      closeSync(descriptor);
    } catch {
      throw new LocalControlPlaneMetadataError("STORAGE_IO_FAILURE");
    }
  }
  if (failure !== undefined) {
    if (failure instanceof LocalControlPlaneMetadataError) throw failure;
    throw new LocalControlPlaneMetadataError("STORAGE_IO_FAILURE");
  }
}

function createMetadataFile(metadataFilePath: string): void {
  let descriptor: number | undefined;
  let operationFailed = false;
  let operationError: unknown;
  try {
    descriptor = openSync(
      metadataFilePath,
      fileConstants.O_CREAT |
        fileConstants.O_EXCL |
        fileConstants.O_NOFOLLOW |
        fileConstants.O_RDWR,
      0o600,
    );
    const entry = fstatSync(descriptor, { bigint: true });
    if (!entry.isFile() || entry.nlink !== 1n) unsafeStoragePath();
    fsyncSync(descriptor);
  } catch (error) {
    operationFailed = true;
    operationError = error;
  }

  if (descriptor !== undefined) {
    try {
      closeSync(descriptor);
    } catch {
      throw new LocalControlPlaneMetadataError("STORAGE_IO_FAILURE");
    }
  }
  if (operationFailed) {
    if (operationError instanceof LocalControlPlaneMetadataError) throw operationError;
    if (systemErrorCode(operationError) === "EEXIST") return;
    if (
      systemErrorCode(operationError) === "ELOOP" ||
      systemErrorCode(operationError) === "ENOTDIR"
    ) {
      unsafeStoragePath();
    }
    throw new LocalControlPlaneMetadataError("STORAGE_IO_FAILURE");
  }
  syncParentDirectory(metadataFilePath);
}

function prepareMetadataFile(input: unknown): Readonly<{
  readonly path: string;
  readonly identity: FileIdentity;
}> {
  if (
    typeof input !== "string" ||
    !path.isAbsolute(input) ||
    path.normalize(input) !== input ||
    path.basename(input) === "." ||
    path.basename(input) === path.parse(input).root
  ) {
    unsafeStoragePath();
  }
  assertCanonicalParent(input);
  for (const suffix of DATABASE_SIDECAR_SUFFIXES) {
    assertSafeOptionalSidecar(`${input}${suffix}`);
  }
  if (optionalLstat(input) === undefined) createMetadataFile(input);
  return Object.freeze({ path: input, identity: captureRegularFileIdentity(input) });
}

function assertStorageIdentity(metadataFilePath: string, identity: FileIdentity): void {
  const entry = optionalLstat(metadataFilePath);
  if (
    entry === undefined ||
    !entry.isFile() ||
    entry.isSymbolicLink() ||
    entry.nlink !== 1n ||
    entry.dev !== identity.device ||
    entry.ino !== identity.inode
  ) {
    unsafeStoragePath();
  }
  try {
    if (realpathSync.native(metadataFilePath) !== metadataFilePath) unsafeStoragePath();
  } catch (error) {
    if (error instanceof LocalControlPlaneMetadataError) throw error;
    throw new LocalControlPlaneMetadataError("STORAGE_IO_FAILURE");
  }
  for (const suffix of DATABASE_SIDECAR_SUFFIXES) {
    assertSafeOptionalSidecar(`${metadataFilePath}${suffix}`);
  }
}

function assertLocalKey(
  value: unknown,
  code: "INVALID_CHANNEL_NAME" | "INVALID_SOURCE_KEY",
): asserts value is string {
  if (typeof value !== "string" || !LOCAL_METADATA_KEY_PATTERN.test(value)) {
    throw new LocalControlPlaneRepositoryError(code);
  }
}

function assertRevision(value: unknown): asserts value is string {
  if (typeof value !== "string" || !BUNDLE_REVISION_PATTERN.test(value)) {
    throw new LocalControlPlaneRepositoryError("INVALID_CHANNEL_REVISION");
  }
}

function assertGeneration(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new LocalControlPlaneRepositoryError("INVALID_GENERATION");
  }
}

function captureSourceBytes(value: unknown): Uint8Array {
  try {
    if (
      typedArrayBufferGetter === undefined ||
      typedArrayByteLengthGetter === undefined ||
      typedArrayByteOffsetGetter === undefined ||
      typedArrayTagGetter === undefined
    ) {
      throw new LocalControlPlaneRepositoryError("INVALID_SOURCE_BYTES");
    }
    const buffer = Reflect.apply(typedArrayBufferGetter, value, []) as unknown;
    const byteLength = Reflect.apply(typedArrayByteLengthGetter, value, []) as unknown;
    const byteOffset = Reflect.apply(typedArrayByteOffsetGetter, value, []) as unknown;
    const tag = Reflect.apply(typedArrayTagGetter, value, []) as unknown;
    if (
      tag !== "Uint8Array" ||
      !(buffer instanceof ArrayBuffer) ||
      typeof byteLength !== "number" ||
      typeof byteOffset !== "number" ||
      !Number.isSafeInteger(byteLength) ||
      !Number.isSafeInteger(byteOffset) ||
      byteLength <= 0 ||
      byteLength > MAX_SOURCE_BYTES ||
      byteOffset < 0
    ) {
      throw new LocalControlPlaneRepositoryError("INVALID_SOURCE_BYTES");
    }
    const exactView = new Uint8Array(buffer, byteOffset, byteLength);
    const copy = new Uint8Array(byteLength);
    Reflect.apply(uint8ArraySet, copy, [exactView]);
    return copy;
  } catch (error) {
    if (error instanceof LocalControlPlaneRepositoryError) throw error;
    throw new LocalControlPlaneRepositoryError("INVALID_SOURCE_BYTES");
  }
}

function sourceBytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function databaseGeneration(value: unknown): number {
  if (typeof value !== "bigint" || value < 1n || value > MAX_GENERATION_BIGINT) {
    throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
  }
  return Number(value);
}

function databaseSourceRecord(row: SourceDatabaseRow): SourceRecord {
  if (
    typeof row.sourceKey !== "string" ||
    !LOCAL_METADATA_KEY_PATTERN.test(row.sourceKey) ||
    !Buffer.isBuffer(row.sourceBytes) ||
    row.sourceBytes.byteLength <= 0 ||
    row.sourceBytes.byteLength > MAX_SOURCE_BYTES
  ) {
    throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
  }
  return Object.freeze({
    sourceKey: row.sourceKey,
    generation: databaseGeneration(row.generation),
    bytes: new Uint8Array(row.sourceBytes),
  });
}

function databaseChannelRecord(row: ChannelDatabaseRow): ChannelRecord {
  if (
    typeof row.channelName !== "string" ||
    !LOCAL_METADATA_KEY_PATTERN.test(row.channelName) ||
    typeof row.revision !== "string" ||
    !BUNDLE_REVISION_PATTERN.test(row.revision)
  ) {
    throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
  }
  return Object.freeze({
    channelName: row.channelName,
    revision: row.revision,
    generation: databaseGeneration(row.generation),
  });
}

function missing<RecordType>(): RepositoryReadResult<RecordType> {
  return Object.freeze({ status: "missing" });
}

function found<RecordType>(record: RecordType): RepositoryReadResult<RecordType> {
  return Object.freeze({ status: "found", record });
}

function created<RecordType>(record: RecordType): RepositoryWriteResult<RecordType> {
  return Object.freeze({ status: "created", record });
}

function updated<RecordType>(record: RecordType): RepositoryWriteResult<RecordType> {
  return Object.freeze({ status: "updated", record });
}

function unchanged<RecordType>(record: RecordType): RepositoryWriteResult<RecordType> {
  return Object.freeze({ status: "unchanged", record });
}

function preconditionFailed<RecordType>(
  current: RecordType | null,
): RepositoryWriteResult<RecordType> {
  return Object.freeze({ status: "precondition-failed", current });
}

function generationExhausted<RecordType>(current: RecordType): RepositoryWriteResult<RecordType> {
  return Object.freeze({ status: "generation-exhausted", current });
}

function pragmaInteger(database: Database.Database, name: string): number | undefined {
  const value = database.pragma(name, { simple: true });
  return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
}

function assertConnectionProfile(database: Database.Database): void {
  if (
    database.pragma("journal_mode", { simple: true }) !== "wal" ||
    pragmaInteger(database, "synchronous") !== 2 ||
    pragmaInteger(database, "foreign_keys") !== 1 ||
    pragmaInteger(database, "trusted_schema") !== 0 ||
    pragmaInteger(database, "busy_timeout") !== BUSY_TIMEOUT_MILLISECONDS
  ) {
    throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
  }
}

function readSchemaVersion(database: Database.Database): number {
  const version = pragmaInteger(database, "user_version");
  if (version === undefined || version < 0) {
    throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
  }
  return version;
}

function assertExactSchema(database: Database.Database): void {
  const rows = database
    .prepare<[], SchemaRow>(
      "SELECT type, name, tbl_name AS tableName, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
    )
    .all();
  if (rows.length !== EXPECTED_SCHEMA.size) {
    throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
  }
  for (const row of rows) {
    if (
      typeof row.name !== "string" ||
      typeof row.sql !== "string" ||
      row.type !== "table" ||
      row.tableName !== row.name ||
      EXPECTED_SCHEMA.get(row.name) !== row.sql
    ) {
      throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
    }
  }
}

function initializeSchema(database: Database.Database): void {
  const initialize = database.transaction(() => {
    const version = readSchemaVersion(database);
    if (version === 0) {
      const existing = database
        .prepare<[], Readonly<{ readonly count: unknown }>>(
          "SELECT count(*) AS count FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'",
        )
        .get();
      if (existing?.count !== 0) {
        throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
      }
      database.exec(`${SOURCE_TABLE_SQL}; ${CHANNEL_TABLE_SQL}`);
      database.pragma(`user_version = ${String(SCHEMA_VERSION)}`);
    } else if (version !== SCHEMA_VERSION) {
      throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
    }
    assertExactSchema(database);
  });
  initialize.immediate();
  if (database.pragma("quick_check", { simple: true }) !== "ok") {
    throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
  }
}

/**
 * Opens one fixed-profile SQLite metadata database and its two package-private repositories.
 *
 * @remarks `metadataFilePath` must be an absolute canonical path beneath a pre-existing canonical
 * directory. The database stores only editable Source bytes and channel discovery pointers;
 * immutable Bundle bytes remain in the independent M07-T01 store. Writes use `BEGIN IMMEDIATE`
 * compare-and-set transactions, and `close` is idempotent.
 *
 * @internal
 */
export function openLocalControlPlaneSqliteRepositories(
  metadataFilePath: string,
): SqliteLocalControlPlaneRepositories {
  const storage = prepareMetadataFile(metadataFilePath);
  let database: Database.Database | undefined;
  try {
    database = new Database(storage.path, { timeout: BUSY_TIMEOUT_MILLISECONDS });
    database.pragma(`busy_timeout = ${String(BUSY_TIMEOUT_MILLISECONDS)}`);
    database.pragma("foreign_keys = ON");
    database.pragma("trusted_schema = OFF");
    database.pragma("journal_mode = WAL");
    database.pragma("synchronous = FULL");
    assertConnectionProfile(database);
    initializeSchema(database);
    assertStorageIdentity(storage.path, storage.identity);
  } catch (error) {
    if (database?.open === true) {
      try {
        database.close();
      } catch {
        // Preserve the original redacted open failure.
      }
    }
    if (error instanceof LocalControlPlaneMetadataError) throw error;
    throw translateStorageError(error);
  }

  const openDatabase = database;
  const getSourceStatement = openDatabase
    .prepare<[string], SourceDatabaseRow>(
      "SELECT source_key AS sourceKey, source_bytes AS sourceBytes, generation FROM sources WHERE source_key = ?",
    )
    .safeIntegers();
  const insertSourceStatement = openDatabase.prepare<[string, Buffer]>(
    "INSERT INTO sources (source_key, source_bytes, generation) VALUES (?, ?, 1)",
  );
  const updateSourceStatement = openDatabase.prepare<[Buffer, number, string, number]>(
    "UPDATE sources SET source_bytes = ?, generation = ? WHERE source_key = ? AND generation = ?",
  );
  const getChannelStatement = openDatabase
    .prepare<[string], ChannelDatabaseRow>(
      "SELECT channel_name AS channelName, revision, generation FROM channels WHERE channel_name = ?",
    )
    .safeIntegers();
  const insertChannelStatement = openDatabase.prepare<[string, string]>(
    "INSERT INTO channels (channel_name, revision, generation) VALUES (?, ?, 1)",
  );
  const updateChannelStatement = openDatabase.prepare<[string, number, string, number]>(
    "UPDATE channels SET revision = ?, generation = ? WHERE channel_name = ? AND generation = ?",
  );

  let closed = false;

  const operate = <Result>(operation: () => Result): Result =>
    withMetadataErrors(() => {
      if (closed || !openDatabase.open) {
        throw new LocalControlPlaneMetadataError("STORAGE_IO_FAILURE");
      }
      assertStorageIdentity(storage.path, storage.identity);
      const result = operation();
      assertStorageIdentity(storage.path, storage.identity);
      return result;
    });

  const sourceGet: SourceRepository["get"] = (sourceKey) => {
    assertLocalKey(sourceKey, "INVALID_SOURCE_KEY");
    return operate(() => {
      const row = getSourceStatement.get(sourceKey);
      return row === undefined ? missing<SourceRecord>() : found(databaseSourceRecord(row));
    });
  };

  const sourceCreateTransaction = openDatabase.transaction(
    (sourceKey: string, proposedBytes: Readonly<Uint8Array>) => {
      const currentRow = getSourceStatement.get(sourceKey);
      if (currentRow !== undefined) {
        return preconditionFailed(databaseSourceRecord(currentRow));
      }
      const bytes = captureSourceBytes(proposedBytes);
      if (insertSourceStatement.run(sourceKey, Buffer.from(bytes)).changes !== 1) {
        throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
      }
      return created<SourceRecord>(
        Object.freeze({ sourceKey, generation: 1, bytes: new Uint8Array(bytes) }),
      );
    },
  );

  const sourceCreate: SourceRepository["create"] = (sourceKey, bytes) => {
    assertLocalKey(sourceKey, "INVALID_SOURCE_KEY");
    return operate(() => sourceCreateTransaction.immediate(sourceKey, bytes));
  };

  const sourceUpdateTransaction = openDatabase.transaction(
    (sourceKey: string, expectedGeneration: number, proposedBytes: Readonly<Uint8Array>) => {
      const currentRow = getSourceStatement.get(sourceKey);
      if (currentRow === undefined) return preconditionFailed<SourceRecord>(null);
      const current = databaseSourceRecord(currentRow);
      if (current.generation !== expectedGeneration) return preconditionFailed(current);
      const bytes = captureSourceBytes(proposedBytes);
      if (sourceBytesEqual(current.bytes, bytes)) return unchanged(current);
      if (current.generation === MAX_GENERATION) return generationExhausted(current);
      const generation = current.generation + 1;
      const result = updateSourceStatement.run(
        Buffer.from(bytes),
        generation,
        sourceKey,
        expectedGeneration,
      );
      if (result.changes !== 1) {
        throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
      }
      return updated<SourceRecord>(
        Object.freeze({ sourceKey, generation, bytes: new Uint8Array(bytes) }),
      );
    },
  );

  const sourceUpdate: SourceRepository["update"] = (sourceKey, expectedGeneration, bytes) => {
    assertLocalKey(sourceKey, "INVALID_SOURCE_KEY");
    assertGeneration(expectedGeneration);
    return operate(() => sourceUpdateTransaction.immediate(sourceKey, expectedGeneration, bytes));
  };

  const channelGet: ChannelRepository["get"] = (channelName) => {
    assertLocalKey(channelName, "INVALID_CHANNEL_NAME");
    return operate(() => {
      const row = getChannelStatement.get(channelName);
      return row === undefined ? missing<ChannelRecord>() : found(databaseChannelRecord(row));
    });
  };

  const channelCreateTransaction = openDatabase.transaction(
    (channelName: string, proposedRevision: string) => {
      const currentRow = getChannelStatement.get(channelName);
      if (currentRow !== undefined) {
        return preconditionFailed(databaseChannelRecord(currentRow));
      }
      assertRevision(proposedRevision);
      if (insertChannelStatement.run(channelName, proposedRevision).changes !== 1) {
        throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
      }
      return created<ChannelRecord>(
        Object.freeze({ channelName, revision: proposedRevision, generation: 1 }),
      );
    },
  );

  const channelCreate: ChannelRepository["create"] = (channelName, revision) => {
    assertLocalKey(channelName, "INVALID_CHANNEL_NAME");
    return operate(() => channelCreateTransaction.immediate(channelName, revision));
  };

  const channelUpdateTransaction = openDatabase.transaction(
    (channelName: string, expectedGeneration: number, proposedRevision: string) => {
      const currentRow = getChannelStatement.get(channelName);
      if (currentRow === undefined) return preconditionFailed<ChannelRecord>(null);
      const current = databaseChannelRecord(currentRow);
      if (current.generation !== expectedGeneration) return preconditionFailed(current);
      assertRevision(proposedRevision);
      if (current.revision === proposedRevision) return unchanged(current);
      if (current.generation === MAX_GENERATION) return generationExhausted(current);
      const generation = current.generation + 1;
      const result = updateChannelStatement.run(
        proposedRevision,
        generation,
        channelName,
        expectedGeneration,
      );
      if (result.changes !== 1) {
        throw new LocalControlPlaneMetadataError("METADATA_CORRUPT");
      }
      return updated<ChannelRecord>(
        Object.freeze({ channelName, revision: proposedRevision, generation }),
      );
    },
  );

  const channelUpdate: ChannelRepository["update"] = (
    channelName,
    expectedGeneration,
    revision,
  ) => {
    assertLocalKey(channelName, "INVALID_CHANNEL_NAME");
    assertGeneration(expectedGeneration);
    return operate(() =>
      channelUpdateTransaction.immediate(channelName, expectedGeneration, revision),
    );
  };

  const close = (): void => {
    if (closed) return;
    withMetadataErrors(() => openDatabase.close());
    closed = true;
  };

  return Object.freeze({
    sourceRepository: Object.freeze({
      get: sourceGet,
      create: sourceCreate,
      update: sourceUpdate,
    }),
    channelRepository: Object.freeze({
      get: channelGet,
      create: channelCreate,
      update: channelUpdate,
    }),
    close,
  });
}
