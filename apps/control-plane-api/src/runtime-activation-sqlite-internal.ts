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

import { isSha256Digest } from "@desen/protocol";
import Database from "better-sqlite3";

import {
  captureRuntimeActivationRecord,
  readRuntimeActivationStorageErrorCode,
  RuntimeActivationStorageError,
} from "./runtime-activation-repository-internal.js";

import type { RuntimeActivationRecord } from "./runtime-activation-contract.js";
import type {
  RuntimeActivationRepository,
  RuntimeActivationRepositoryCommitResult,
  RuntimeActivationRepositoryReadResult,
} from "./runtime-activation-repository-internal.js";

export { RuntimeActivationStorageError } from "./runtime-activation-repository-internal.js";
export type { RuntimeActivationStorageErrorCode } from "./runtime-activation-repository-internal.js";

const SCHEMA_VERSION = 1;
const BUSY_TIMEOUT_MILLISECONDS = 5_000;
const MAX_GENERATION = Number.MAX_SAFE_INTEGER;
const MAX_GENERATION_BIGINT = 9_007_199_254_740_991n;
const DATABASE_SIDECAR_SUFFIXES = Object.freeze(["-journal", "-shm", "-wal"] as const);

const ACTIVATION_TABLE_SQL = [
  "CREATE TABLE runtime_activation (",
  "singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1)",
  ", active_revision TEXT NOT NULL",
  "CHECK(length(active_revision) = 71)",
  "CHECK(substr(active_revision, 1, 7) = 'sha256:')",
  "CHECK(substr(active_revision, 8) NOT GLOB '*[^0-9a-f]*')",
  ", previous_good_revision TEXT",
  "CHECK(previous_good_revision IS NULL OR (",
  "length(previous_good_revision) = 71",
  "AND substr(previous_good_revision, 1, 7) = 'sha256:'",
  "AND substr(previous_good_revision, 8) NOT GLOB '*[^0-9a-f]*'",
  "AND previous_good_revision <> active_revision",
  "))",
  ", generation INTEGER NOT NULL",
  `CHECK(generation BETWEEN 0 AND ${String(MAX_GENERATION)})`,
  ") STRICT",
].join(" ");

/** Deterministic package-private transaction seams used only by focused activation proof tests. @internal */
export interface RuntimeActivationSqliteHooks {
  /** Runs after each statement is prepared during repository acquisition. */
  readonly afterPrepareStatement?: (statement: "read" | "insert" | "update") => void;
  /** Runs inside the write transaction immediately before COMMIT is attempted. */
  readonly beforeCommit?: () => void;
  /** Runs after COMMIT returned but before success authority may be published. */
  readonly afterCommit?: () => void;
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

interface ActivationDatabaseRow {
  readonly activeRevision: unknown;
  readonly previousGoodRevision: unknown;
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
    return error instanceof Database.SqliteError && typeof error.code === "string"
      ? error.code
      : undefined;
  } catch {
    return undefined;
  }
}

function authenticatedStorageError(error: unknown): RuntimeActivationStorageError | undefined {
  const authenticatedCode = readRuntimeActivationStorageErrorCode(error);
  return authenticatedCode === undefined
    ? undefined
    : new RuntimeActivationStorageError(authenticatedCode);
}

function translateStorageError(error: unknown): RuntimeActivationStorageError {
  const authenticated = authenticatedStorageError(error);
  if (authenticated !== undefined) return authenticated;
  const code = sqliteErrorCode(error);
  if (code?.startsWith("SQLITE_BUSY") === true || code?.startsWith("SQLITE_LOCKED") === true) {
    return new RuntimeActivationStorageError("ACTIVATION_BUSY");
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
    return new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
  }
  return new RuntimeActivationStorageError("STORAGE_IO_FAILURE");
}

function unsafeStoragePath(): never {
  throw new RuntimeActivationStorageError("UNSAFE_STORAGE_PATH");
}

function optionalLstat(entryPath: string): BigIntStats | undefined {
  try {
    return lstatSync(entryPath, { bigint: true });
  } catch (error) {
    if (systemErrorCode(error) === "ENOENT") return undefined;
    if (systemErrorCode(error) === "ELOOP" || systemErrorCode(error) === "ENOTDIR") {
      unsafeStoragePath();
    }
    throw new RuntimeActivationStorageError("STORAGE_IO_FAILURE");
  }
}

function assertCanonicalParent(databaseFilePath: string): void {
  const parentPath = path.dirname(databaseFilePath);
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
    const authenticated = authenticatedStorageError(error);
    if (authenticated !== undefined) throw authenticated;
    throw new RuntimeActivationStorageError("STORAGE_IO_FAILURE");
  }
}

function assertSafeOptionalSidecar(sidecarPath: string): void {
  const entry = optionalLstat(sidecarPath);
  if (entry === undefined) return;
  if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1n) unsafeStoragePath();
  try {
    if (realpathSync.native(sidecarPath) !== sidecarPath) unsafeStoragePath();
  } catch (error) {
    const authenticated = authenticatedStorageError(error);
    if (authenticated !== undefined) throw authenticated;
    throw new RuntimeActivationStorageError("STORAGE_IO_FAILURE");
  }
}

function captureRegularFileIdentity(databaseFilePath: string): FileIdentity {
  const entry = optionalLstat(databaseFilePath);
  if (entry === undefined || !entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1n) {
    unsafeStoragePath();
  }
  try {
    if (realpathSync.native(databaseFilePath) !== databaseFilePath) unsafeStoragePath();
  } catch (error) {
    const authenticated = authenticatedStorageError(error);
    if (authenticated !== undefined) throw authenticated;
    throw new RuntimeActivationStorageError("STORAGE_IO_FAILURE");
  }
  return Object.freeze({ device: entry.dev, inode: entry.ino });
}

function syncParentDirectory(databaseFilePath: string): void {
  let descriptor: number | undefined;
  let failure: unknown;
  try {
    descriptor = openSync(
      path.dirname(databaseFilePath),
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
      throw new RuntimeActivationStorageError("STORAGE_IO_FAILURE");
    }
  }
  if (failure !== undefined) {
    const authenticated = authenticatedStorageError(failure);
    if (authenticated !== undefined) throw authenticated;
    throw new RuntimeActivationStorageError("STORAGE_IO_FAILURE");
  }
}

function createDatabaseFile(databaseFilePath: string): void {
  let descriptor: number | undefined;
  let failure: unknown;
  try {
    descriptor = openSync(
      databaseFilePath,
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
    failure = error;
  }
  if (descriptor !== undefined) {
    try {
      closeSync(descriptor);
    } catch {
      throw new RuntimeActivationStorageError("STORAGE_IO_FAILURE");
    }
  }
  if (failure !== undefined && systemErrorCode(failure) !== "EEXIST") {
    const authenticated = authenticatedStorageError(failure);
    if (authenticated !== undefined) throw authenticated;
    if (systemErrorCode(failure) === "ELOOP" || systemErrorCode(failure) === "ENOTDIR") {
      unsafeStoragePath();
    }
    throw new RuntimeActivationStorageError("STORAGE_IO_FAILURE");
  }
  if (failure === undefined) syncParentDirectory(databaseFilePath);
}

function prepareDatabaseFile(databaseFilePath: string): Readonly<{
  readonly path: string;
  readonly identity: FileIdentity;
}> {
  if (
    typeof databaseFilePath !== "string" ||
    !path.isAbsolute(databaseFilePath) ||
    path.normalize(databaseFilePath) !== databaseFilePath ||
    path.basename(databaseFilePath) === "." ||
    path.basename(databaseFilePath) === path.parse(databaseFilePath).root
  ) {
    unsafeStoragePath();
  }
  assertCanonicalParent(databaseFilePath);
  for (const suffix of DATABASE_SIDECAR_SUFFIXES) {
    assertSafeOptionalSidecar(`${databaseFilePath}${suffix}`);
  }
  if (optionalLstat(databaseFilePath) === undefined) createDatabaseFile(databaseFilePath);
  return Object.freeze({
    path: databaseFilePath,
    identity: captureRegularFileIdentity(databaseFilePath),
  });
}

function assertStorageIdentity(databaseFilePath: string, identity: FileIdentity): void {
  const entry = optionalLstat(databaseFilePath);
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
    if (realpathSync.native(databaseFilePath) !== databaseFilePath) unsafeStoragePath();
  } catch (error) {
    const authenticated = authenticatedStorageError(error);
    if (authenticated !== undefined) throw authenticated;
    throw new RuntimeActivationStorageError("STORAGE_IO_FAILURE");
  }
  for (const suffix of DATABASE_SIDECAR_SUFFIXES) {
    assertSafeOptionalSidecar(`${databaseFilePath}${suffix}`);
  }
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
    throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
  }
}

function assertExactSchema(database: Database.Database): void {
  if (pragmaInteger(database, "user_version") !== SCHEMA_VERSION) {
    throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
  }
  const rows = database
    .prepare<[], SchemaRow>(
      "SELECT type, name, tbl_name AS tableName, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
    )
    .all();
  if (rows.length !== 1) throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
  const row = rows[0];
  if (
    row?.type !== "table" ||
    row.name !== "runtime_activation" ||
    row.tableName !== row.name ||
    row.sql !== ACTIVATION_TABLE_SQL
  ) {
    throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
  }
}

function initializeSchema(database: Database.Database): void {
  const initialize = database.transaction(() => {
    const version = pragmaInteger(database, "user_version");
    if (version === 0) {
      const existing = database
        .prepare<[], Readonly<{ readonly count: unknown }>>(
          "SELECT count(*) AS count FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'",
        )
        .get();
      if (existing?.count !== 0) {
        throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
      }
      database.exec(ACTIVATION_TABLE_SQL);
      database.pragma(`user_version = ${String(SCHEMA_VERSION)}`);
    } else if (version !== SCHEMA_VERSION) {
      throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
    }
    assertExactSchema(database);
  });
  initialize.immediate();
  if (database.pragma("quick_check", { simple: true }) !== "ok") {
    throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
  }
}

function databaseGeneration(value: unknown): number {
  if (typeof value !== "bigint" || value < 0n || value > MAX_GENERATION_BIGINT) {
    throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
  }
  return Number(value);
}

function databaseRecord(row: ActivationDatabaseRow): RuntimeActivationRecord {
  const generation = databaseGeneration(row.generation);
  if (
    !isSha256Digest(row.activeRevision) ||
    (row.previousGoodRevision !== null && !isSha256Digest(row.previousGoodRevision)) ||
    row.previousGoodRevision === row.activeRevision ||
    (generation === 0 && row.previousGoodRevision !== null)
  ) {
    throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
  }
  return Object.freeze({
    activeRevision: row.activeRevision,
    previousGoodRevision: row.previousGoodRevision,
    generation,
  });
}

function nextRecord(
  current: RuntimeActivationRecord | null,
  candidateRevision: string,
): RuntimeActivationRecord {
  return Object.freeze({
    activeRevision: candidateRevision,
    previousGoodRevision:
      current === null
        ? null
        : current.activeRevision === candidateRevision
          ? current.previousGoodRevision
          : current.activeRevision,
    generation: current === null ? 0 : current.generation + 1,
  });
}

function sameRecord(
  left: RuntimeActivationRecord | null,
  right: RuntimeActivationRecord | null,
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.activeRevision === right.activeRevision &&
      left.previousGoodRevision === right.previousGoodRevision &&
      left.generation === right.generation)
  );
}

function captureAuthenticatedCurrent(
  value: RuntimeActivationRecord | null,
): RuntimeActivationRecord | null {
  if (value === null) return null;
  try {
    return captureRuntimeActivationRecord(value);
  } catch {
    throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
  }
}

/**
 * Opens the separate fixed-profile SQLite repository for one atomic activation record.
 *
 * @remarks COMMIT is issued manually so a post-COMMIT failure can return `recovery-required`
 * without publishing in-process activation authority. Such an outcome revokes this repository;
 * only the later restart-recovery boundary may determine the durable winner.
 *
 * @internal
 */
export function openRuntimeActivationSqliteRepository(
  databaseFilePath: string,
  hooks: RuntimeActivationSqliteHooks = {},
): RuntimeActivationRepository {
  const storage = prepareDatabaseFile(databaseFilePath);
  let database: Database.Database | undefined;
  let readStatement!: Database.Statement<[], ActivationDatabaseRow>;
  let insertStatement!: Database.Statement<[string, string | null]>;
  let updateStatement!: Database.Statement<[string, string | null, number, number]>;
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
    readStatement = database
      .prepare<[], ActivationDatabaseRow>(
        "SELECT active_revision AS activeRevision, previous_good_revision AS previousGoodRevision, generation FROM runtime_activation WHERE singleton = 1",
      )
      .safeIntegers();
    hooks.afterPrepareStatement?.("read");
    insertStatement = database.prepare<[string, string | null]>(
      "INSERT INTO runtime_activation (singleton, active_revision, previous_good_revision, generation) VALUES (1, ?, ?, 0)",
    );
    hooks.afterPrepareStatement?.("insert");
    updateStatement = database.prepare<[string, string | null, number, number]>(
      "UPDATE runtime_activation SET active_revision = ?, previous_good_revision = ?, generation = ? WHERE singleton = 1 AND generation = ?",
    );
    hooks.afterPrepareStatement?.("update");
  } catch (error) {
    if (database?.open === true) {
      try {
        database.close();
      } catch {
        // Preserve the first redacted open failure.
      }
    }
    throw translateStorageError(error);
  }

  const openDatabase = database;
  let closed = false;

  const revoke = (): void => {
    if (closed) return;
    closed = true;
    if (openDatabase.open) {
      try {
        openDatabase.close();
      } catch {
        // Recovery is already required; no second outcome can improve that classification.
      }
    }
  };

  const assertOpen = (): void => {
    if (closed || !openDatabase.open) {
      throw new RuntimeActivationStorageError("ACTIVATION_CLOSED");
    }
  };

  const readCurrent = (): RuntimeActivationRecord | null => {
    const row = readStatement.get();
    return row === undefined ? null : databaseRecord(row);
  };

  const rollback = (): void => {
    if (openDatabase.inTransaction) openDatabase.exec("ROLLBACK");
  };

  const get = (): RuntimeActivationRepositoryReadResult => {
    assertOpen();
    try {
      assertStorageIdentity(storage.path, storage.identity);
      openDatabase.exec("BEGIN");
      // Reauthenticate the complete connection profile inside the transaction. The profile is
      // established at open, but the transaction boundary is the authority used for this read;
      // accepting a later PRAGMA drift here would create a time-of-check/time-of-use gap.
      assertConnectionProfile(openDatabase);
      assertExactSchema(openDatabase);
      const current = readCurrent();
      assertExactSchema(openDatabase);
      assertStorageIdentity(storage.path, storage.identity);
      openDatabase.exec("COMMIT");
      return current === null
        ? Object.freeze({ status: "missing" as const })
        : Object.freeze({ status: "found" as const, record: current });
    } catch (error) {
      if (openDatabase.open && openDatabase.inTransaction) {
        try {
          rollback();
        } catch {
          revoke();
          throw new RuntimeActivationStorageError("STORAGE_IO_FAILURE");
        }
      }
      throw translateStorageError(error);
    }
  };

  const commit = (
    expectedGeneration: number | null,
    authenticatedCurrent: RuntimeActivationRecord | null,
    candidateRevision: string,
  ): RuntimeActivationRepositoryCommitResult => {
    assertOpen();
    const capturedAuthenticatedCurrent = captureAuthenticatedCurrent(authenticatedCurrent);
    if (
      (expectedGeneration !== null &&
        (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0)) ||
      !isSha256Digest(candidateRevision)
    ) {
      throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
    }

    let commitAttempted = false;
    let committed = false;
    try {
      assertStorageIdentity(storage.path, storage.identity);
      openDatabase.exec("BEGIN IMMEDIATE");
      // The writer lock is the last safe point before durable authority is observed or changed.
      // Recheck every profile field here and fail closed rather than silently repairing drift.
      assertConnectionProfile(openDatabase);
      assertExactSchema(openDatabase);
      const current = readCurrent();
      if (
        (current === null && expectedGeneration !== null) ||
        (current !== null && current.generation !== expectedGeneration)
      ) {
        rollback();
        assertStorageIdentity(storage.path, storage.identity);
        return Object.freeze({ status: "precondition-failed", current });
      }
      if (!sameRecord(current, capturedAuthenticatedCurrent)) {
        rollback();
        assertStorageIdentity(storage.path, storage.identity);
        return Object.freeze({ status: "recovery-required" });
      }
      if (current?.generation === MAX_GENERATION) {
        rollback();
        assertStorageIdentity(storage.path, storage.identity);
        return Object.freeze({ status: "generation-exhausted", current });
      }

      const record = nextRecord(current, candidateRevision);
      const changes =
        current === null
          ? insertStatement.run(record.activeRevision, record.previousGoodRevision).changes
          : updateStatement.run(
              record.activeRevision,
              record.previousGoodRevision,
              record.generation,
              current.generation,
            ).changes;
      if (changes !== 1) throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
      hooks.beforeCommit?.();
      commitAttempted = true;
      try {
        openDatabase.exec("COMMIT");
        committed = true;
      } catch (error) {
        if (openDatabase.inTransaction) {
          rollback();
          throw error;
        }
        revoke();
        return Object.freeze({ status: "recovery-required" });
      }

      try {
        hooks.afterCommit?.();
        assertConnectionProfile(openDatabase);
        assertExactSchema(openDatabase);
        if (!sameRecord(readCurrent(), record)) {
          throw new RuntimeActivationStorageError("ACTIVATION_CORRUPT");
        }
        assertStorageIdentity(storage.path, storage.identity);
      } catch {
        revoke();
        return Object.freeze({ status: "recovery-required" });
      }
      return Object.freeze({ status: "activated", record });
    } catch (error) {
      if (!committed && openDatabase.open && openDatabase.inTransaction) {
        try {
          rollback();
        } catch {
          revoke();
          if (commitAttempted) return Object.freeze({ status: "recovery-required" });
          throw new RuntimeActivationStorageError("STORAGE_IO_FAILURE");
        }
      }
      if (commitAttempted && !openDatabase.open) {
        return Object.freeze({ status: "recovery-required" });
      }
      throw translateStorageError(error);
    }
  };

  const close = (): void => {
    if (closed) return;
    try {
      openDatabase.close();
      closed = true;
    } catch (error) {
      throw translateStorageError(error);
    }
  };

  return Object.freeze({ get, commit, close });
}
