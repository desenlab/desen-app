import {
  DESIGN_SYSTEM_ASSET_HANDLE_PREFIX,
  DESIGN_SYSTEM_ASSET_LIMITS,
  isDesignSystemAssetHandle,
  type DesignSystemAssetStore,
  type DesignSystemAssetStoreRecord,
} from "@desen/design-system-assets";
import { sha256Digest } from "@desen/protocol";

/** Fixed local-only IndexedDB identity for immutable authoring assets. */
export const DESEN_APP_ASSET_DATABASE_NAME = "desen.design-system-assets.v1" as const;
export const DESEN_APP_ASSET_STORE_NAME = "assets" as const;

interface PersistedAssetRecord {
  readonly handle: string;
  readonly asset: DesignSystemAssetStoreRecord["asset"];
  readonly bytes: readonly number[];
}

function missing(handle: string) {
  return Object.freeze({
    ok: false as const,
    diagnostic: Object.freeze({
      code: "MISSING_ASSET" as const,
      handle,
      message: "The local asset is missing; no remote fallback was selected.",
    }),
  });
}

function corrupt(handle: string) {
  return Object.freeze({
    ok: false as const,
    diagnostic: Object.freeze({
      code: "CORRUPT_ASSET" as const,
      handle,
      message: "The local asset record is malformed and was not returned to the renderer.",
    }),
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function openDatabase(databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DESEN_APP_ASSET_STORE_NAME)) {
        request.result.createObjectStore(DESEN_APP_ASSET_STORE_NAME, { keyPath: "handle" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
  });
}

function persistedRecord(value: unknown): DesignSystemAssetStoreRecord | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Partial<PersistedAssetRecord>;
  if (
    !isDesignSystemAssetHandle(candidate.handle) ||
    candidate.asset === undefined ||
    !Array.isArray(candidate.bytes)
  )
    return undefined;
  if (
    candidate.asset.handle !== candidate.handle ||
    candidate.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
  )
    return undefined;
  return Object.freeze({
    asset: Object.freeze({ ...candidate.asset }),
    bytes: Object.freeze([...candidate.bytes]),
  });
}

/** Creates the App-only IndexedDB CAS adapter; it never performs a network request. */
export function createIndexedDbDesignSystemAssetStore(
  options: { readonly databaseName?: string } = {},
): DesignSystemAssetStore {
  const databaseName = options.databaseName ?? DESEN_APP_ASSET_DATABASE_NAME;
  let databasePromise: Promise<IDBDatabase> | undefined;
  const database = () => (databasePromise ??= openDatabase(databaseName));

  return {
    async put(record) {
      if (!isDesignSystemAssetHandle(record.asset.handle)) return corrupt(record.asset.handle);
      if (
        record.bytes.length === 0 ||
        record.bytes.length > DESIGN_SYSTEM_ASSET_LIMITS.maxImageEncodedBytes ||
        record.bytes.length !== record.asset.byteLength ||
        record.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
      ) {
        return corrupt(record.asset.handle);
      }
      const digest = sha256Digest(Uint8Array.from(record.bytes));
      if (
        digest !== record.asset.digest ||
        `${DESIGN_SYSTEM_ASSET_HANDLE_PREFIX}${digest.slice("sha256:".length)}` !==
          record.asset.handle
      ) {
        return corrupt(record.asset.handle);
      }
      const db = await database();
      const existing = (await requestResult(
        db
          .transaction(DESEN_APP_ASSET_STORE_NAME, "readonly")
          .objectStore(DESEN_APP_ASSET_STORE_NAME)
          .get(record.asset.handle),
      )) as unknown;
      const previous = persistedRecord(existing);
      if (existing !== undefined && previous === undefined) return corrupt(record.asset.handle);
      if (previous !== undefined) {
        const same =
          previous.asset.digest === record.asset.digest &&
          previous.bytes.length === record.bytes.length &&
          previous.bytes.every((byte, index) => byte === record.bytes[index]);
        return same
          ? Object.freeze({ ok: true as const, record: previous, created: false })
          : Object.freeze({
              ok: false as const,
              diagnostic: Object.freeze({
                code: "HANDLE_COLLISION" as const,
                handle: record.asset.handle,
                message: "An opaque handle cannot be reused for different bytes.",
              }),
            });
      }
      const persisted: PersistedAssetRecord = {
        handle: record.asset.handle,
        asset: record.asset,
        bytes: [...record.bytes],
      };
      await requestResult(
        db
          .transaction(DESEN_APP_ASSET_STORE_NAME, "readwrite")
          .objectStore(DESEN_APP_ASSET_STORE_NAME)
          .put(persisted),
      );
      return Object.freeze({
        ok: true as const,
        record: Object.freeze({
          asset: Object.freeze({ ...record.asset }),
          bytes: Object.freeze([...record.bytes]),
        }),
        created: true,
      });
    },
    async get(handle) {
      if (!isDesignSystemAssetHandle(handle)) return missing(handle);
      const db = await database();
      const value = (await requestResult(
        db
          .transaction(DESEN_APP_ASSET_STORE_NAME, "readonly")
          .objectStore(DESEN_APP_ASSET_STORE_NAME)
          .get(handle),
      )) as unknown;
      if (value === undefined) return missing(handle);
      const record = persistedRecord(value);
      return record === undefined ? corrupt(handle) : Object.freeze({ ok: true as const, record });
    },
  };
}
