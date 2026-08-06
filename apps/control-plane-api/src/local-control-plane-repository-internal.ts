/* eslint-disable @typescript-eslint/no-invalid-void-type -- Repository callbacks are deliberately
 * receiver-independent at the package-private persistence boundary. */

/**
 * Package-private repository contracts and deterministic in-memory adapters for editable Source
 * bytes and mutable channel pointers.
 *
 * @remarks Immutable Bundle persistence deliberately remains in the separate M07-T01
 * `BundleStore`. These repositories grant no publication, staging, activation, or recovery
 * authority.
 *
 * @internal
 */

const LOCAL_METADATA_KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const BUNDLE_REVISION_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_GENERATION = Number.MAX_SAFE_INTEGER;

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

/** Stable package-private repository failure classifications. @internal */
export type LocalControlPlaneRepositoryErrorCode =
  | "DUPLICATE_INITIAL_RECORD"
  | "INVALID_CHANNEL_NAME"
  | "INVALID_CHANNEL_REVISION"
  | "INVALID_GENERATION"
  | "INVALID_INITIAL_RECORDS"
  | "INVALID_SOURCE_BYTES"
  | "INVALID_SOURCE_KEY";

const ERROR_MESSAGES: Readonly<Record<LocalControlPlaneRepositoryErrorCode, string>> =
  Object.freeze({
    DUPLICATE_INITIAL_RECORD: "The initial repository contains a duplicate record identity.",
    INVALID_CHANNEL_NAME: "The channel name is invalid.",
    INVALID_CHANNEL_REVISION: "The channel revision is invalid.",
    INVALID_GENERATION: "The repository generation is invalid.",
    INVALID_INITIAL_RECORDS: "The initial repository records are invalid.",
    INVALID_SOURCE_BYTES: "The Source byte snapshot is invalid.",
    INVALID_SOURCE_KEY: "The Source key is invalid.",
  });

/** Redacted package-private failure raised before repository state is observed or changed. @internal */
export class LocalControlPlaneRepositoryError extends Error {
  /** Stable reason for the rejected repository input. */
  readonly code: LocalControlPlaneRepositoryErrorCode;

  /** Creates one fixed-message repository failure. */
  constructor(code: LocalControlPlaneRepositoryErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "LocalControlPlaneRepositoryError";
    this.code = code;
  }
}

/** Exact editable Source snapshot stored under one local key and generation. @internal */
export interface SourceRecord {
  /** Local lowercase storage identity; it need not equal the Source document id. */
  readonly sourceKey: string;
  /** Positive safe compare-and-set generation. */
  readonly generation: number;
  /** Exact stored Source bytes returned as a fresh defensive copy. */
  readonly bytes: Readonly<Uint8Array>;
}

/** Mutable channel pointer stored separately from immutable Bundle bytes. @internal */
export interface ChannelRecord {
  /** Local lowercase channel identity. */
  readonly channelName: string;
  /** Exact existing immutable Bundle revision selected by the channel. */
  readonly revision: string;
  /** Positive safe compare-and-set generation. */
  readonly generation: number;
}

/** Controlled result of reading one repository record. @internal */
export type RepositoryReadResult<RecordType> =
  | Readonly<{ readonly status: "found"; readonly record: RecordType }>
  | Readonly<{ readonly status: "missing" }>;

/**
 * Controlled create/update result shared by Source and channel repositories.
 *
 * @remarks `precondition-failed` is returned before a proposed replacement value is observed when
 * the identity is absent or its generation is stale. `generation-exhausted` preserves the exact
 * current record. Every exposed record is detached from repository-owned state.
 *
 * @internal
 */
export type RepositoryWriteResult<RecordType> =
  | Readonly<{ readonly status: "created"; readonly record: RecordType }>
  | Readonly<{ readonly status: "updated"; readonly record: RecordType }>
  | Readonly<{ readonly status: "unchanged"; readonly record: RecordType }>
  | Readonly<{ readonly status: "precondition-failed"; readonly current: RecordType | null }>
  | Readonly<{ readonly status: "generation-exhausted"; readonly current: RecordType }>;

/** Package-private persistence port for exact editable Source byte snapshots. @internal */
export interface SourceRepository {
  /** Reads one Source key without returning repository-owned memory. */
  readonly get: (this: void, sourceKey: string) => RepositoryReadResult<SourceRecord>;
  /** Creates generation one only when the Source key is absent. */
  readonly create: (
    this: void,
    sourceKey: string,
    bytes: Readonly<Uint8Array>,
  ) => RepositoryWriteResult<SourceRecord>;
  /** Replaces exact bytes only when `expectedGeneration` equals the current generation. */
  readonly update: (
    this: void,
    sourceKey: string,
    expectedGeneration: number,
    bytes: Readonly<Uint8Array>,
  ) => RepositoryWriteResult<SourceRecord>;
}

/** Package-private persistence port for mutable channel-to-revision pointers. @internal */
export interface ChannelRepository {
  /** Reads one channel without granting Bundle, staging, or activation authority. */
  readonly get: (this: void, channelName: string) => RepositoryReadResult<ChannelRecord>;
  /** Creates generation one only when the channel name is absent. */
  readonly create: (
    this: void,
    channelName: string,
    revision: string,
  ) => RepositoryWriteResult<ChannelRecord>;
  /** Replaces the revision only when `expectedGeneration` equals the current generation. */
  readonly update: (
    this: void,
    channelName: string,
    expectedGeneration: number,
    revision: string,
  ) => RepositoryWriteResult<ChannelRecord>;
}

/** Deterministic initial state accepted only by the package-private memory Source adapter. @internal */
export interface InMemorySourceRepositoryOptions {
  /** Detached initial records; primarily used to exercise finite-generation boundaries. */
  readonly initialRecords?: readonly SourceRecord[];
}

/** Deterministic initial state accepted only by the package-private memory channel adapter. @internal */
export interface InMemoryChannelRepositoryOptions {
  /** Detached initial records; primarily used to exercise finite-generation boundaries. */
  readonly initialRecords?: readonly ChannelRecord[];
}

interface StoredSourceRecord {
  readonly sourceKey: string;
  readonly generation: number;
  readonly bytes: Uint8Array;
}

interface StoredChannelRecord {
  readonly channelName: string;
  readonly revision: string;
  readonly generation: number;
}

const MISSING_RESULT: RepositoryReadResult<never> = Object.freeze({ status: "missing" });

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
    if (typedArrayBufferGetter === undefined || typedArrayByteLengthGetter === undefined) {
      throw new LocalControlPlaneRepositoryError("INVALID_SOURCE_BYTES");
    }
    if (typedArrayByteOffsetGetter === undefined || typedArrayTagGetter === undefined) {
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

function exactOwnDataValues(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      throw new LocalControlPlaneRepositoryError("INVALID_INITIAL_RECORDS");
    }
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      throw new LocalControlPlaneRepositoryError("INVALID_INITIAL_RECORDS");
    }
    const captured: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw new LocalControlPlaneRepositoryError("INVALID_INITIAL_RECORDS");
      }
      captured[key] = descriptor.value;
    }
    return Object.freeze(captured);
  } catch (error) {
    if (error instanceof LocalControlPlaneRepositoryError) throw error;
    throw new LocalControlPlaneRepositoryError("INVALID_INITIAL_RECORDS");
  }
}

function initialRecordCandidates(options: unknown): readonly unknown[] {
  if (options === undefined) return Object.freeze([]);
  const capturedOptions = exactOwnDataValues(options, ["initialRecords"]);
  const initialRecords = capturedOptions.initialRecords;
  if (initialRecords === undefined) return Object.freeze([]);
  try {
    if (
      !Array.isArray(initialRecords) ||
      Object.getPrototypeOf(initialRecords) !== Array.prototype
    ) {
      throw new LocalControlPlaneRepositoryError("INVALID_INITIAL_RECORDS");
    }
    const ownKeys = Reflect.ownKeys(initialRecords);
    if (
      ownKeys.length !== initialRecords.length + 1 ||
      ownKeys.at(-1) !== "length" ||
      ownKeys.slice(0, -1).some((key, index) => key !== String(index))
    ) {
      throw new LocalControlPlaneRepositoryError("INVALID_INITIAL_RECORDS");
    }
    const captured: unknown[] = [];
    for (let index = 0; index < initialRecords.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(initialRecords, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw new LocalControlPlaneRepositoryError("INVALID_INITIAL_RECORDS");
      }
      captured.push(descriptor.value);
    }
    return Object.freeze(captured);
  } catch (error) {
    if (error instanceof LocalControlPlaneRepositoryError) throw error;
    throw new LocalControlPlaneRepositoryError("INVALID_INITIAL_RECORDS");
  }
}

function sourceBytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let index = 0;
  while (index < left.byteLength) {
    if (left[index] !== right[index]) return false;
    index += 1;
  }
  return true;
}

function publicSourceRecord(record: StoredSourceRecord): SourceRecord {
  return Object.freeze({
    sourceKey: record.sourceKey,
    generation: record.generation,
    bytes: new Uint8Array(record.bytes),
  });
}

function publicChannelRecord(record: StoredChannelRecord): ChannelRecord {
  return Object.freeze({
    channelName: record.channelName,
    revision: record.revision,
    generation: record.generation,
  });
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

function captureInitialSourceRecords(
  options: InMemorySourceRepositoryOptions | undefined,
): Map<string, StoredSourceRecord> {
  const records = new Map<string, StoredSourceRecord>();
  for (const candidate of initialRecordCandidates(options)) {
    const captured = exactOwnDataValues(candidate, ["sourceKey", "generation", "bytes"]);
    assertLocalKey(captured.sourceKey, "INVALID_SOURCE_KEY");
    assertGeneration(captured.generation);
    if (records.has(captured.sourceKey)) {
      throw new LocalControlPlaneRepositoryError("DUPLICATE_INITIAL_RECORD");
    }
    records.set(
      captured.sourceKey,
      Object.freeze({
        sourceKey: captured.sourceKey,
        generation: captured.generation,
        bytes: captureSourceBytes(captured.bytes),
      }),
    );
  }
  return records;
}

function captureInitialChannelRecords(
  options: InMemoryChannelRepositoryOptions | undefined,
): Map<string, StoredChannelRecord> {
  const records = new Map<string, StoredChannelRecord>();
  for (const candidate of initialRecordCandidates(options)) {
    const captured = exactOwnDataValues(candidate, ["channelName", "revision", "generation"]);
    assertLocalKey(captured.channelName, "INVALID_CHANNEL_NAME");
    assertRevision(captured.revision);
    assertGeneration(captured.generation);
    if (records.has(captured.channelName)) {
      throw new LocalControlPlaneRepositoryError("DUPLICATE_INITIAL_RECORD");
    }
    records.set(
      captured.channelName,
      Object.freeze({
        channelName: captured.channelName,
        revision: captured.revision,
        generation: captured.generation,
      }),
    );
  }
  return records;
}

/**
 * Creates one deterministic, synchronous in-memory editable-Source repository.
 *
 * @remarks The returned methods are receiver-independent. Every accepted input is copied before
 * storage, every exposed record is frozen, and every exposed byte view is a fresh copy.
 *
 * @internal
 */
export function createInMemorySourceRepository(
  options?: InMemorySourceRepositoryOptions,
): SourceRepository {
  const records = captureInitialSourceRecords(options);

  const get: SourceRepository["get"] = (sourceKey) => {
    assertLocalKey(sourceKey, "INVALID_SOURCE_KEY");
    const current = records.get(sourceKey);
    return current === undefined ? MISSING_RESULT : found(publicSourceRecord(current));
  };

  const create: SourceRepository["create"] = (sourceKey, bytes) => {
    assertLocalKey(sourceKey, "INVALID_SOURCE_KEY");
    const current = records.get(sourceKey);
    if (current !== undefined) return preconditionFailed(publicSourceRecord(current));
    const next = Object.freeze({
      sourceKey,
      generation: 1,
      bytes: captureSourceBytes(bytes),
    });
    records.set(sourceKey, next);
    return created(publicSourceRecord(next));
  };

  const update: SourceRepository["update"] = (sourceKey, expectedGeneration, bytes) => {
    assertLocalKey(sourceKey, "INVALID_SOURCE_KEY");
    assertGeneration(expectedGeneration);
    const current = records.get(sourceKey);
    if (current === undefined) return preconditionFailed<SourceRecord>(null);
    if (current.generation !== expectedGeneration) {
      return preconditionFailed(publicSourceRecord(current));
    }
    const candidateBytes = captureSourceBytes(bytes);
    if (sourceBytesEqual(current.bytes, candidateBytes)) {
      return unchanged(publicSourceRecord(current));
    }
    if (current.generation === MAX_GENERATION) {
      return generationExhausted(publicSourceRecord(current));
    }
    const next = Object.freeze({
      sourceKey,
      generation: current.generation + 1,
      bytes: candidateBytes,
    });
    records.set(sourceKey, next);
    return updated(publicSourceRecord(next));
  };

  return Object.freeze({ get, create, update });
}

/**
 * Creates one deterministic, synchronous in-memory channel repository.
 *
 * @remarks A channel record carries only discovery metadata. This adapter never reads, writes, or
 * authenticates immutable Bundle bytes and cannot create an activation record.
 *
 * @internal
 */
export function createInMemoryChannelRepository(
  options?: InMemoryChannelRepositoryOptions,
): ChannelRepository {
  const records = captureInitialChannelRecords(options);

  const get: ChannelRepository["get"] = (channelName) => {
    assertLocalKey(channelName, "INVALID_CHANNEL_NAME");
    const current = records.get(channelName);
    return current === undefined ? MISSING_RESULT : found(publicChannelRecord(current));
  };

  const create: ChannelRepository["create"] = (channelName, revision) => {
    assertLocalKey(channelName, "INVALID_CHANNEL_NAME");
    const current = records.get(channelName);
    if (current !== undefined) return preconditionFailed(publicChannelRecord(current));
    assertRevision(revision);
    const next = Object.freeze({ channelName, revision, generation: 1 });
    records.set(channelName, next);
    return created(publicChannelRecord(next));
  };

  const update: ChannelRepository["update"] = (channelName, expectedGeneration, revision) => {
    assertLocalKey(channelName, "INVALID_CHANNEL_NAME");
    assertGeneration(expectedGeneration);
    const current = records.get(channelName);
    if (current === undefined) return preconditionFailed<ChannelRecord>(null);
    if (current.generation !== expectedGeneration) {
      return preconditionFailed(publicChannelRecord(current));
    }
    assertRevision(revision);
    if (current.revision === revision) return unchanged(publicChannelRecord(current));
    if (current.generation === MAX_GENERATION) {
      return generationExhausted(publicChannelRecord(current));
    }
    const next = Object.freeze({
      channelName,
      revision,
      generation: current.generation + 1,
    });
    records.set(channelName, next);
    return updated(publicChannelRecord(next));
  };

  return Object.freeze({ get, create, update });
}
