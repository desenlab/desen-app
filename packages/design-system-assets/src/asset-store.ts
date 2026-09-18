import {
  DESIGN_SYSTEM_ASSET_HANDLE_PREFIX,
  DESIGN_SYSTEM_ASSET_LIMITS,
  isDesignSystemAssetHandle,
  type AdmittedDesignSystemAsset,
} from "./asset-admission.js";
import { sha256Digest } from "@desen/protocol";

/** Complete immutable record retained by a local content-addressed store. */
export interface DesignSystemAssetStoreRecord {
  readonly asset: AdmittedDesignSystemAsset;
  readonly bytes: readonly number[];
}

/** Missing/corrupt local asset diagnostics stay visible to the authoring surface. */
export type DesignSystemAssetStoreDiagnosticCode =
  "MISSING_ASSET" | "CORRUPT_ASSET" | "HANDLE_COLLISION";

export interface DesignSystemAssetStoreDiagnostic {
  readonly code: DesignSystemAssetStoreDiagnosticCode;
  readonly handle: string;
  readonly message: string;
}

export type DesignSystemAssetStoreReadResult =
  | Readonly<{ readonly ok: true; readonly record: DesignSystemAssetStoreRecord }>
  | Readonly<{ readonly ok: false; readonly diagnostic: DesignSystemAssetStoreDiagnostic }>;

export type DesignSystemAssetStorePutResult =
  | Readonly<{
      readonly ok: true;
      readonly record: DesignSystemAssetStoreRecord;
      readonly created: boolean;
    }>
  | Readonly<{ readonly ok: false; readonly diagnostic: DesignSystemAssetStoreDiagnostic }>;

/** App-owned storage port. Implementations must be content-addressed and immutable. */
export interface DesignSystemAssetStore {
  readonly put: (record: DesignSystemAssetStoreRecord) => Promise<DesignSystemAssetStorePutResult>;
  readonly get: (handle: string) => Promise<DesignSystemAssetStoreReadResult>;
}

function freezeRecord(record: DesignSystemAssetStoreRecord): DesignSystemAssetStoreRecord {
  if (
    !isDesignSystemAssetHandle(record.asset.handle) ||
    !record.asset.handle.startsWith(DESIGN_SYSTEM_ASSET_HANDLE_PREFIX)
  ) {
    throw new TypeError("Asset store records require an opaque admitted handle.");
  }
  if (
    !Array.isArray(record.bytes) ||
    record.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
  ) {
    throw new TypeError("Asset store records require bounded byte values.");
  }
  if (
    record.bytes.length === 0 ||
    record.bytes.length > DESIGN_SYSTEM_ASSET_LIMITS.maxImageEncodedBytes ||
    record.bytes.length !== record.asset.byteLength
  ) {
    throw new TypeError("Asset store records require a bounded byte length matching metadata.");
  }
  const digest = sha256Digest(Uint8Array.from(record.bytes));
  if (
    digest !== record.asset.digest ||
    `${DESIGN_SYSTEM_ASSET_HANDLE_PREFIX}${digest.slice("sha256:".length)}` !== record.asset.handle
  ) {
    throw new TypeError("Asset store records must retain the content-addressed digest and handle.");
  }
  return Object.freeze({
    asset: Object.freeze({ ...record.asset }),
    bytes: Object.freeze([...record.bytes]),
  });
}

/** Deterministic in-memory store used by pure authoring and unit tests. */
export function createMemoryDesignSystemAssetStore(): DesignSystemAssetStore {
  const records = new Map<string, DesignSystemAssetStoreRecord>();
  return {
    async put(input) {
      let record: DesignSystemAssetStoreRecord;
      try {
        record = freezeRecord(input);
      } catch {
        return Object.freeze({
          ok: false as const,
          diagnostic: Object.freeze({
            code: "CORRUPT_ASSET" as const,
            handle: input.asset?.handle ?? "",
            message: "The asset record is not safe to store.",
          }),
        });
      }
      const previous = records.get(record.asset.handle);
      if (previous !== undefined) {
        if (
          previous.asset.digest !== record.asset.digest ||
          previous.bytes.length !== record.bytes.length ||
          previous.bytes.some((byte, index) => byte !== record.bytes[index])
        ) {
          return Object.freeze({
            ok: false as const,
            diagnostic: Object.freeze({
              code: "HANDLE_COLLISION" as const,
              handle: record.asset.handle,
              message: "An opaque handle cannot be reused for different bytes.",
            }),
          });
        }
        return Object.freeze({ ok: true as const, record: previous, created: false });
      }
      records.set(record.asset.handle, record);
      return Object.freeze({ ok: true as const, record, created: true });
    },
    async get(handle) {
      if (!isDesignSystemAssetHandle(handle))
        return Object.freeze({
          ok: false as const,
          diagnostic: Object.freeze({
            code: "MISSING_ASSET" as const,
            handle,
            message: "The asset handle is unknown or malformed.",
          }),
        });
      const record = records.get(handle);
      return record === undefined
        ? Object.freeze({
            ok: false as const,
            diagnostic: Object.freeze({
              code: "MISSING_ASSET" as const,
              handle,
              message: "The local asset is missing; no fallback URL was selected.",
            }),
          })
        : Object.freeze({ ok: true as const, record });
    },
  };
}
