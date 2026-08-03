import { createHash } from "node:crypto";

import { canonicalizeJsonBytes } from "@desen/protocol";

import type { DesenCatalog } from "@desen/protocol";
import type { ImmutableJson } from "@desen/validator";

/** @internal Exact fixed self-digest projection for the Web–React v1 package profile. */
export const WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000";

/** @internal Private captured artifact consumed by the independent digest implementation. */
export interface CapturedWebReactPackageArtifact {
  readonly path: string;
  readonly bytes: Uint8Array;
}

/** @internal Byte-free description of one independently calculated Web–React package digest. */
export interface CalculatedWebReactPackageDigest {
  readonly packageDigest: string;
  readonly artifactCount: number;
  readonly framedByteLength: number;
}

interface FramedEntry {
  readonly path: string;
  readonly pathBytes: Uint8Array;
  readonly contentBytes: Uint8Array;
}

const PROFILE_MAGIC = asciiBytes("DESEN-WEB-REACT-PACKAGE-DIGEST-V1\n");
const CATALOG_PATH = "catalog.json";

function asciiBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index);
  return bytes;
}

function uint16BigEndian(value: number): Uint8Array {
  return Uint8Array.of(value >>> 8, value);
}

function uint32BigEndian(value: number): Uint8Array {
  return Uint8Array.of(value >>> 24, value >>> 16, value >>> 8, value);
}

function projectedCatalogBytes(catalog: ImmutableJson<DesenCatalog>): Uint8Array {
  const projection: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(catalog)) {
    Object.defineProperty(projection, key, {
      configurable: false,
      enumerable: true,
      value:
        key === "packageDigest"
          ? WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER
          : catalog[key as keyof DesenCatalog],
      writable: false,
    });
  }
  return canonicalizeJsonBytes(projection);
}

/** @internal Independently calculates the exact Web–React v1 framed package digest. */
export function calculateWebReactPackageDigest(
  catalog: ImmutableJson<DesenCatalog>,
  artifacts: readonly CapturedWebReactPackageArtifact[],
  maximumFramedBytes: number,
): CalculatedWebReactPackageDigest {
  const entries: FramedEntry[] = [
    {
      path: CATALOG_PATH,
      pathBytes: asciiBytes(CATALOG_PATH),
      contentBytes: projectedCatalogBytes(catalog),
    },
    ...artifacts.map((artifact) => ({
      path: artifact.path,
      pathBytes: asciiBytes(artifact.path),
      contentBytes: artifact.bytes,
    })),
  ];
  entries.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

  let framedByteLength = PROFILE_MAGIC.byteLength + 4;
  for (const entry of entries) {
    const framedEntryLength = 2 + entry.pathBytes.byteLength + 4 + entry.contentBytes.byteLength;
    if (framedEntryLength > maximumFramedBytes - framedByteLength) {
      throw new RangeError("Web–React package framing exceeded its fixed byte limit.");
    }
    framedByteLength += framedEntryLength;
  }

  const hash = createHash("sha256");
  hash.update(PROFILE_MAGIC);
  hash.update(uint32BigEndian(entries.length));
  for (const entry of entries) {
    hash.update(uint16BigEndian(entry.pathBytes.byteLength));
    hash.update(entry.pathBytes);
    hash.update(uint32BigEndian(entry.contentBytes.byteLength));
    hash.update(entry.contentBytes);
  }

  return Object.freeze({
    packageDigest: `sha256:${hash.digest("hex")}`,
    artifactCount: artifacts.length,
    framedByteLength,
  });
}
