import {
  DESIGN_TOKEN_PROFILE,
  admitDtcgTokenDocument,
  type DesignSystemJsonObject,
} from "@desen/design-system-core";
import {
  canonicalizeJson,
  canonicalizeJsonBytes,
  isSha256Digest,
  sha256Digest,
} from "@desen/protocol";

/** Exact discriminator for an immutable design-system release snapshot. */
export const DESIGN_SYSTEM_RELEASE_KIND = "desen.design-system-release" as const;

/** Exact discriminator for a host profile's proposed release reference. */
export const DESIGN_SYSTEM_RELEASE_REFERENCE_KIND =
  "desen.design-system-release-reference" as const;

/** Current and only admitted immutable release schema version. */
export const DESIGN_SYSTEM_RELEASE_SCHEMA_VERSION = 1 as const;

/** Finite release and dependency limits applied before any identity is created. */
export const DESIGN_SYSTEM_RELEASE_LIMITS = Object.freeze({
  maxIdentifierCodeUnits: 128,
  maxLabelCodeUnits: 512,
  maxTokenSources: DESIGN_TOKEN_PROFILE.limits.maxSources,
  maxAssets: 2_048,
  maxRecipes: 2_048,
  maxDependencyCount: 4_097,
  maxDependencyBytes: 16_777_216,
  maxAssetBytes: 8_388_608,
  maxRecipeJsonBytes: 1_048_576,
  maxRecipeJsonDepth: 64,
  maxRecipeJsonNodes: 50_000,
  maxRecipeJsonArrayItems: 8_192,
  maxRecipeJsonObjectProperties: 8_192,
  maxRecipeJsonStringCodeUnits: 262_144,
});

const IDENTIFIER = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
const MEDIA_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/u;
const RELEASE_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const FORBIDDEN_RELEASE_DATA_KEYS = new Set([
  "accesstoken",
  "apikey",
  "authorization",
  "callback",
  "credential",
  "credentials",
  "endpoint",
  "execute",
  "executable",
  "execution",
  "function",
  "handler",
  "import",
  "loader",
  "loaderpath",
  "load",
  "module",
  "modulename",
  "modulepath",
  "network",
  "networkdestination",
  "password",
  "refreshtoken",
  "require",
  "script",
  "secret",
  "uri",
  "url",
]);

function isAssetKind(value: unknown): value is DesignSystemReleaseAssetInput["kind"] {
  return value === "font" || value === "icon" || value === "image";
}

/** One token JSON source captured into an immutable release. */
export interface DesignSystemReleaseTokenSourceInput {
  /** Stable source identity. */
  readonly id: string;
  /** Complete admitted DTCG token document. */
  readonly document: DesignSystemJsonObject;
}

/** One binary production asset supplied to release construction. */
export interface DesignSystemReleaseAssetInput {
  /** Stable release-local asset identity. */
  readonly id: string;
  /** Non-executable production asset category. */
  readonly kind: "font" | "icon" | "image";
  /** Exact media type used by the trusted host profile. */
  readonly mediaType: string;
  /** Exact asset bytes. The input view is copied before validation returns. */
  readonly bytes: Uint8Array;
  /** Optional expected digest; when supplied it must match the captured bytes. */
  readonly digest?: string;
}

/** One inert recipe JSON snapshot supplied to release construction. */
export interface DesignSystemReleaseRecipeInput {
  /** Stable release-local recipe identity. */
  readonly id: string;
  /** Bounded JSON recipe data; executable members are not admitted. */
  readonly document: DesignSystemJsonObject;
}

/** Complete production dependency set from which one release identity is derived. */
export interface DesignSystemReleaseInput {
  /** Ordered token sources; order is production-significant for overlay resolution. */
  readonly tokenSources: readonly DesignSystemReleaseTokenSourceInput[];
  /** Asset bytes required by the release. */
  readonly assets: readonly DesignSystemReleaseAssetInput[];
  /** Inert recipe snapshots required by the release. */
  readonly recipes: readonly DesignSystemReleaseRecipeInput[];
}

/** Content-addressed dependency manifest member. */
export interface DesignSystemReleaseDependency {
  /** Production dependency category. */
  readonly kind: "token" | "font" | "icon" | "image" | "recipe";
  /** Stable dependency identity. */
  readonly id: string;
  /** Exact bytes represented by this dependency. */
  readonly bytes: number;
  /** Lowercase SHA-256 digest over the exact dependency bytes. */
  readonly digest: string;
  /** Asset media type; absent for JSON dependencies. */
  readonly mediaType?: string;
}

/** Immutable token source retained by a release. */
export interface DesignSystemReleaseTokenSourceSnapshot {
  readonly id: string;
  readonly document: DesignSystemJsonObject;
  readonly dependencyDigest: string;
}

/** Immutable binary asset retained by a release as a frozen byte list. */
export interface DesignSystemReleaseAssetSnapshot {
  readonly id: string;
  readonly kind: "font" | "icon" | "image";
  readonly mediaType: string;
  readonly bytes: readonly number[];
  readonly dependencyDigest: string;
}

/** Immutable inert recipe retained by a release. */
export interface DesignSystemReleaseRecipeSnapshot {
  readonly id: string;
  readonly document: DesignSystemJsonObject;
  readonly dependencyDigest: string;
}

/** Complete immutable release snapshot and its exact content identity. */
export interface DesignSystemReleaseSnapshot {
  readonly kind: typeof DESIGN_SYSTEM_RELEASE_KIND;
  readonly schemaVersion: typeof DESIGN_SYSTEM_RELEASE_SCHEMA_VERSION;
  readonly digest: string;
  readonly dependencyManifest: readonly DesignSystemReleaseDependency[];
  readonly tokenSources: readonly DesignSystemReleaseTokenSourceSnapshot[];
  readonly assets: readonly DesignSystemReleaseAssetSnapshot[];
  readonly recipes: readonly DesignSystemReleaseRecipeSnapshot[];
}

/** A host profile reference that names one exact release; it has no loader or latest semantics. */
export interface DesignSystemReleaseReference {
  readonly kind: typeof DESIGN_SYSTEM_RELEASE_REFERENCE_KIND;
  readonly schemaVersion: typeof DESIGN_SYSTEM_RELEASE_SCHEMA_VERSION;
  readonly hostProfileId: string;
  readonly releaseDigest: string;
}

/** Input used to propose an exact release reference for one trusted host profile. */
export interface HostProfileReleaseReferenceInput {
  readonly hostProfileId: string;
  readonly releaseDigest: string;
}

/** Successful release construction result. */
export interface DesignSystemReleaseResult {
  readonly ok: true;
  readonly release: DesignSystemReleaseSnapshot;
}

/** Verification result for one release snapshot. */
export interface DesignSystemReleaseVerification {
  readonly ok: true;
  readonly digest: string;
  readonly dependencyCount: number;
  readonly dependencyBytes: number;
}

/** Stable invalid-construction and verification error classifications. */
export type DesignSystemReleaseErrorCode =
  | "INVALID_INPUT"
  | "INVALID_TOKEN_SOURCE"
  | "INVALID_ASSET"
  | "INVALID_RECIPE"
  | "DUPLICATE_DEPENDENCY_ID"
  | "LIMIT_EXCEEDED"
  | "DIGEST_MISMATCH"
  | "RELEASE_DIGEST_MISMATCH"
  | "REFERENCE_INVALID"
  | "REFERENCE_MISMATCH"
  | "RELEASE_NOT_FOUND"
  | "STORE_CONFLICT"
  | "STORE_FAILURE";

/** Redacted deterministic error raised by the release boundary. */
export class DesignSystemReleaseError extends Error {
  /** Stable machine-readable failure code. */
  readonly code: DesignSystemReleaseErrorCode;

  constructor(code: DesignSystemReleaseErrorCode) {
    super(code);
    this.name = "DesignSystemReleaseError";
    this.code = code;
  }
}

/** Exact entry accepted by the atomic release-store port. */
export interface DesignSystemReleaseStoreEntry {
  readonly release: DesignSystemReleaseSnapshot;
}

/** Read result from an exact-digest release store. */
export type DesignSystemReleaseStoreReadResult =
  | Readonly<{ readonly status: "found"; readonly entry: DesignSystemReleaseStoreEntry }>
  | Readonly<{ readonly status: "missing" }>;

/** Put result from an atomic content-addressed release store. */
export type DesignSystemReleaseStorePutResult =
  | Readonly<{ readonly status: "stored" }>
  | Readonly<{ readonly status: "unchanged" }>
  | Readonly<{ readonly status: "conflict" }>;

/** Stable store-level failure exposed by the release port. */
export interface DesignSystemReleaseStoreError {
  readonly code: "STORE_FAILURE";
}

/** Atomic exact-digest release-store port. There is intentionally no mutable latest operation. */
export interface DesignSystemReleaseStore {
  readonly getRelease: (digest: string) => Promise<DesignSystemReleaseStoreReadResult>;
  readonly putRelease: (
    entry: DesignSystemReleaseStoreEntry,
  ) => Promise<DesignSystemReleaseStorePutResult>;
}

const STORED = Object.freeze({ status: "stored" } as const);
const UNCHANGED = Object.freeze({ status: "unchanged" } as const);
const CONFLICT = Object.freeze({ status: "conflict" } as const);
const MISSING = Object.freeze({ status: "missing" } as const);

function fail(code: DesignSystemReleaseErrorCode): never {
  throw new DesignSystemReleaseError(code);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactOwnDataShape(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) return false;
    const allowed = new Set([...requiredKeys, ...optionalKeys]);
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string" || !allowed.has(key))) return false;
    for (const requiredKey of requiredKeys) {
      if (!Object.hasOwn(value, requiredKey)) return false;
    }
    for (const key of keys) {
      if (typeof key !== "string") return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, "value")
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function isDenseDataArray<Value>(
  value: Value,
  maximumLength: number,
): value is Value & readonly unknown[] {
  if (!Array.isArray(value)) return false;
  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) return false;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !Object.hasOwn(lengthDescriptor, "value") ||
      typeof lengthDescriptor.value !== "number" ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximumLength
    ) {
      return false;
    }
    const length = lengthDescriptor.value;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1 || !keys.includes("length")) return false;
    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, "value")
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function deepFreeze<Value>(value: Value): Value {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function captureMediaType(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > DESIGN_SYSTEM_RELEASE_LIMITS.maxLabelCodeUnits ||
    !MEDIA_TYPE.test(value)
  ) {
    fail("INVALID_ASSET");
  }
  return value;
}

function captureAssetMediaType(
  kind: DesignSystemReleaseAssetInput["kind"],
  value: unknown,
): string {
  const mediaType = captureMediaType(value);
  if (
    (kind === "font" && !mediaType.startsWith("font/")) ||
    (kind !== "font" && !mediaType.startsWith("image/"))
  ) {
    fail("INVALID_ASSET");
  }
  return mediaType;
}

function reserveRecipeBytes(total: number, additional: number): number {
  const next = total + additional;
  if (next > DESIGN_SYSTEM_RELEASE_LIMITS.maxRecipeJsonBytes) fail("LIMIT_EXCEEDED");
  return next;
}

function jsonStringUtf8Bytes(value: string): number {
  let bytes = 2;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0x22 || codeUnit === 0x5c) {
      bytes += 2;
    } else if (codeUnit <= 0x1f) {
      bytes += 6;
    } else if (codeUnit <= 0x7f) {
      bytes += 1;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) fail("INVALID_RECIPE");
      bytes += 4;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      fail("INVALID_RECIPE");
    } else if (codeUnit <= 0x7ff) {
      bytes += 2;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function isForbiddenReleaseDataKey(value: string): boolean {
  const normalized = value.replaceAll(/[^A-Za-z0-9]/gu, "").toLowerCase();
  return FORBIDDEN_RELEASE_DATA_KEYS.has(normalized);
}

type TokenKeyScanFrame =
  | Readonly<{ readonly kind: "enter"; readonly value: unknown; readonly depth: number }>
  | Readonly<{ readonly kind: "leave"; readonly value: object }>;

/**
 * DTCG admission deliberately preserves inert extension metadata. A release cannot let that
 * metadata smuggle a credential, loader, endpoint, or executable selector into production.
 */
function assertNoAuthorityBearingTokenKeys(value: DesignSystemJsonObject): void {
  const active = new WeakSet<object>();
  const pending: TokenKeyScanFrame[] = [{ kind: "enter", value, depth: 0 }];
  let nodeCount = 0;

  while (pending.length > 0) {
    const frame = pending.pop();
    if (frame === undefined) break;
    if (frame.kind === "leave") {
      active.delete(frame.value);
      continue;
    }

    nodeCount += 1;
    if (
      nodeCount > DESIGN_TOKEN_PROFILE.limits.maxJsonNodes ||
      frame.depth > DESIGN_TOKEN_PROFILE.limits.maxJsonDepth
    ) {
      fail("INVALID_TOKEN_SOURCE");
    }
    if (
      frame.value === null ||
      typeof frame.value === "boolean" ||
      typeof frame.value === "string" ||
      typeof frame.value === "number"
    ) {
      continue;
    }
    if (typeof frame.value !== "object" || active.has(frame.value)) fail("INVALID_TOKEN_SOURCE");

    let isArray: boolean;
    let prototype: object | null;
    let keys: readonly PropertyKey[];
    let descriptors: PropertyDescriptorMap;
    try {
      isArray = Array.isArray(frame.value);
      prototype = Object.getPrototypeOf(frame.value) as object | null;
      keys = Reflect.ownKeys(frame.value);
      descriptors = Object.getOwnPropertyDescriptors(frame.value);
    } catch {
      fail("INVALID_TOKEN_SOURCE");
    }
    if (
      (isArray && prototype !== Array.prototype) ||
      (!isArray && prototype !== Object.prototype && prototype !== null) ||
      keys.some((key) => typeof key !== "string")
    ) {
      fail("INVALID_TOKEN_SOURCE");
    }

    active.add(frame.value);
    pending.push({ kind: "leave", value: frame.value });
    if (isArray) {
      const lengthDescriptor = descriptors.length;
      const length =
        lengthDescriptor !== undefined && Object.hasOwn(lengthDescriptor, "value")
          ? lengthDescriptor.value
          : undefined;
      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
        length > DESIGN_TOKEN_PROFILE.limits.maxArrayItems ||
        keys.length !== length + 1 ||
        !keys.includes("length")
      ) {
        fail("INVALID_TOKEN_SOURCE");
      }
      for (let index = length - 1; index >= 0; index -= 1) {
        const key = String(index);
        const descriptor = descriptors[key];
        if (
          descriptor === undefined ||
          !descriptor.enumerable ||
          !Object.hasOwn(descriptor, "value")
        ) {
          fail("INVALID_TOKEN_SOURCE");
        }
        pending.push({ kind: "enter", value: descriptor.value, depth: frame.depth + 1 });
      }
      continue;
    }

    if (keys.length > DESIGN_TOKEN_PROFILE.limits.maxJsonNodes) fail("INVALID_TOKEN_SOURCE");
    const sortedKeys = [...(keys as readonly string[])].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    for (let index = sortedKeys.length - 1; index >= 0; index -= 1) {
      const key = sortedKeys[index];
      if (key === undefined || isForbiddenReleaseDataKey(key)) fail("INVALID_TOKEN_SOURCE");
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, "value")
      ) {
        fail("INVALID_TOKEN_SOURCE");
      }
      pending.push({ kind: "enter", value: descriptor.value, depth: frame.depth + 1 });
    }
  }
}

type RecipeCaptureFrame =
  | Readonly<{ readonly kind: "enter"; readonly value: unknown; readonly depth: number }>
  | Readonly<{ readonly kind: "leave"; readonly value: object }>;

function assertBoundedInertRecipeInput(value: unknown): void {
  const active = new WeakSet<object>();
  const pending: RecipeCaptureFrame[] = [{ kind: "enter", value, depth: 0 }];
  let nodeCount = 0;
  let canonicalBytes = 0;

  while (pending.length > 0) {
    const frame = pending.pop();
    if (frame === undefined) break;
    if (frame.kind === "leave") {
      active.delete(frame.value);
      continue;
    }

    nodeCount += 1;
    if (
      nodeCount > DESIGN_SYSTEM_RELEASE_LIMITS.maxRecipeJsonNodes ||
      frame.depth > DESIGN_SYSTEM_RELEASE_LIMITS.maxRecipeJsonDepth
    ) {
      fail("LIMIT_EXCEEDED");
    }
    if (frame.value === null || typeof frame.value === "boolean") {
      canonicalBytes = reserveRecipeBytes(
        canonicalBytes,
        frame.value === null ? 4 : frame.value ? 4 : 5,
      );
      continue;
    }
    if (typeof frame.value === "string") {
      if (frame.value.length > DESIGN_SYSTEM_RELEASE_LIMITS.maxRecipeJsonStringCodeUnits) {
        fail("LIMIT_EXCEEDED");
      }
      canonicalBytes = reserveRecipeBytes(canonicalBytes, jsonStringUtf8Bytes(frame.value));
      continue;
    }
    if (typeof frame.value === "number") {
      if (!Number.isFinite(frame.value)) fail("INVALID_RECIPE");
      const serialized = JSON.stringify(frame.value);
      if (serialized === undefined) fail("INVALID_RECIPE");
      canonicalBytes = reserveRecipeBytes(canonicalBytes, serialized.length);
      continue;
    }
    if (typeof frame.value !== "object") fail("INVALID_RECIPE");
    if (active.has(frame.value)) fail("INVALID_RECIPE");

    let isArray: boolean;
    let prototype: object | null;
    let keys: readonly PropertyKey[];
    let descriptors: PropertyDescriptorMap;
    try {
      isArray = Array.isArray(frame.value);
      prototype = Object.getPrototypeOf(frame.value) as object | null;
      keys = Reflect.ownKeys(frame.value);
      descriptors = Object.getOwnPropertyDescriptors(frame.value);
    } catch {
      fail("INVALID_RECIPE");
    }
    if (
      (isArray && prototype !== Array.prototype) ||
      (!isArray && prototype !== Object.prototype && prototype !== null) ||
      keys.some((key) => typeof key !== "string")
    ) {
      fail("INVALID_RECIPE");
    }

    active.add(frame.value);
    pending.push({ kind: "leave", value: frame.value });
    if (isArray) {
      const lengthDescriptor = descriptors.length;
      const length =
        lengthDescriptor !== undefined && Object.hasOwn(lengthDescriptor, "value")
          ? lengthDescriptor.value
          : undefined;
      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
        length > DESIGN_SYSTEM_RELEASE_LIMITS.maxRecipeJsonArrayItems ||
        keys.length !== length + 1 ||
        !keys.includes("length")
      ) {
        fail("LIMIT_EXCEEDED");
      }
      canonicalBytes = reserveRecipeBytes(canonicalBytes, 2 + Math.max(0, length - 1));
      for (let index = length - 1; index >= 0; index -= 1) {
        const key = String(index);
        const descriptor = descriptors[key];
        if (
          descriptor === undefined ||
          !descriptor.enumerable ||
          !Object.hasOwn(descriptor, "value")
        ) {
          fail("INVALID_RECIPE");
        }
        pending.push({ kind: "enter", value: descriptor.value, depth: frame.depth + 1 });
      }
      continue;
    }

    if (keys.length > DESIGN_SYSTEM_RELEASE_LIMITS.maxRecipeJsonObjectProperties) {
      fail("LIMIT_EXCEEDED");
    }
    const sortedKeys = [...(keys as readonly string[])].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    canonicalBytes = reserveRecipeBytes(canonicalBytes, 2 + Math.max(0, sortedKeys.length - 1));
    for (let index = sortedKeys.length - 1; index >= 0; index -= 1) {
      const key = sortedKeys[index];
      if (key === undefined) fail("INVALID_RECIPE");
      if (
        key.length > DESIGN_SYSTEM_RELEASE_LIMITS.maxRecipeJsonStringCodeUnits ||
        isForbiddenReleaseDataKey(key)
      ) {
        fail("INVALID_RECIPE");
      }
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, "value")
      ) {
        fail("INVALID_RECIPE");
      }
      canonicalBytes = reserveRecipeBytes(canonicalBytes, jsonStringUtf8Bytes(key) + 1);
      pending.push({ kind: "enter", value: descriptor.value, depth: frame.depth + 1 });
    }
  }
}

function captureRecipeDocument(value: unknown): DesignSystemJsonObject {
  if (!isObject(value)) fail("INVALID_RECIPE");
  let canonical: string;
  try {
    assertBoundedInertRecipeInput(value);
    canonical = canonicalizeJson(value);
  } catch (error) {
    if (error instanceof DesignSystemReleaseError) throw error;
    fail("INVALID_RECIPE");
  }
  let captured: unknown;
  try {
    captured = JSON.parse(canonical);
  } catch {
    fail("INVALID_RECIPE");
  }
  if (!isObject(captured)) fail("INVALID_RECIPE");
  return deepFreeze(captured as DesignSystemJsonObject);
}

function captureIdentifier(value: unknown): string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) fail("INVALID_INPUT");
  return value;
}

function captureBytes(value: unknown, maxBytes: number): Uint8Array {
  if (!(value instanceof Uint8Array)) fail("INVALID_ASSET");
  if (value.byteLength === 0 || value.byteLength > maxBytes) fail("LIMIT_EXCEEDED");
  return new Uint8Array(value);
}

function captureDigest(value: unknown): string {
  if (typeof value !== "string" || !RELEASE_DIGEST_PATTERN.test(value) || !isSha256Digest(value)) {
    fail("DIGEST_MISMATCH");
  }
  return value;
}

function dependencyPayload(
  dependencies: readonly DesignSystemReleaseDependency[],
): Record<string, unknown> {
  return {
    kind: DESIGN_SYSTEM_RELEASE_KIND,
    schemaVersion: DESIGN_SYSTEM_RELEASE_SCHEMA_VERSION,
    dependencies,
  };
}

function releaseDigest(dependencies: readonly DesignSystemReleaseDependency[]): string {
  return sha256Digest(canonicalizeJsonBytes(dependencyPayload(dependencies)));
}

function duplicateIds(values: readonly { readonly id: string }[]): boolean {
  return new Set(values.map((value) => value.id)).size !== values.length;
}

function ensureLimit(totalBytes: number, count: number): void {
  if (
    count > DESIGN_SYSTEM_RELEASE_LIMITS.maxDependencyCount ||
    totalBytes > DESIGN_SYSTEM_RELEASE_LIMITS.maxDependencyBytes
  ) {
    fail("LIMIT_EXCEEDED");
  }
}

function freezeAssetBytes(bytes: Uint8Array): readonly number[] {
  return Object.freeze(Array.from(bytes));
}

function hasValidSnapshotBytes(value: unknown): value is readonly number[] {
  if (!isDenseDataArray(value, DESIGN_SYSTEM_RELEASE_LIMITS.maxAssetBytes) || value.length === 0) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
    const byte = value[index];
    if (typeof byte !== "number" || !Number.isSafeInteger(byte) || byte < 0 || byte > 255) {
      return false;
    }
  }
  return true;
}

function dependencyKind(kind: DesignSystemReleaseAssetInput["kind"]): "font" | "icon" | "image" {
  return kind;
}

function buildRelease(input: DesignSystemReleaseInput): DesignSystemReleaseSnapshot {
  if (!hasExactOwnDataShape(input, ["tokenSources", "assets", "recipes"])) fail("INVALID_INPUT");
  if (
    !isDenseDataArray(input.tokenSources, DESIGN_SYSTEM_RELEASE_LIMITS.maxTokenSources) ||
    !isDenseDataArray(input.assets, DESIGN_SYSTEM_RELEASE_LIMITS.maxAssets) ||
    !isDenseDataArray(input.recipes, DESIGN_SYSTEM_RELEASE_LIMITS.maxRecipes) ||
    input.tokenSources.length === 0 ||
    input.tokenSources.length > DESIGN_SYSTEM_RELEASE_LIMITS.maxTokenSources
  ) {
    fail("LIMIT_EXCEEDED");
  }

  const tokenSources: DesignSystemReleaseTokenSourceSnapshot[] = [];
  const assets: DesignSystemReleaseAssetSnapshot[] = [];
  const recipes: DesignSystemReleaseRecipeSnapshot[] = [];
  const dependencies: DesignSystemReleaseDependency[] = [];
  let totalBytes = 0;

  for (const source of input.tokenSources) {
    if (!hasExactOwnDataShape(source, ["id", "document"])) fail("INVALID_TOKEN_SOURCE");
    const id = captureIdentifier(source.id);
    const admission = admitDtcgTokenDocument(source.document);
    if (!admission.ok) fail("INVALID_TOKEN_SOURCE");
    assertNoAuthorityBearingTokenKeys(admission.document);
    const documentBytes = canonicalizeJsonBytes(admission.document);
    totalBytes += documentBytes.byteLength;
    const digest = sha256Digest(documentBytes);
    tokenSources.push({ id, document: admission.document, dependencyDigest: digest });
    dependencies.push({ kind: "token", id, bytes: documentBytes.byteLength, digest });
    ensureLimit(totalBytes, dependencies.length);
  }

  for (const asset of input.assets) {
    if (!hasExactOwnDataShape(asset, ["id", "kind", "mediaType", "bytes"], ["digest"])) {
      fail("INVALID_ASSET");
    }
    const id = captureIdentifier(asset.id);
    const kind = asset.kind;
    if (!isAssetKind(kind)) fail("INVALID_ASSET");
    const mediaType = captureAssetMediaType(kind, asset.mediaType);
    const bytes = captureBytes(asset.bytes, DESIGN_SYSTEM_RELEASE_LIMITS.maxAssetBytes);
    const digest = sha256Digest(bytes);
    const expectedDigest = Object.hasOwn(asset, "digest") ? captureDigest(asset.digest) : undefined;
    if (expectedDigest !== undefined && expectedDigest !== digest) {
      fail("DIGEST_MISMATCH");
    }
    totalBytes += bytes.byteLength;
    assets.push({
      id,
      kind,
      mediaType,
      bytes: freezeAssetBytes(bytes),
      dependencyDigest: digest,
    });
    dependencies.push({
      kind: dependencyKind(kind),
      id,
      bytes: bytes.byteLength,
      digest,
      mediaType,
    });
    ensureLimit(totalBytes, dependencies.length);
  }

  for (const recipe of input.recipes) {
    if (!hasExactOwnDataShape(recipe, ["id", "document"])) fail("INVALID_RECIPE");
    const id = captureIdentifier(recipe.id);
    const document = captureRecipeDocument(recipe.document);
    const documentBytes = canonicalizeJsonBytes(document);
    const digest = sha256Digest(documentBytes);
    totalBytes += documentBytes.byteLength;
    recipes.push({ id, document, dependencyDigest: digest });
    dependencies.push({ kind: "recipe", id, bytes: documentBytes.byteLength, digest });
    ensureLimit(totalBytes, dependencies.length);
  }

  if (duplicateIds([...tokenSources, ...assets, ...recipes])) fail("DUPLICATE_DEPENDENCY_ID");

  const frozenDependencies = Object.freeze(
    dependencies.map((dependency) => deepFreeze(dependency)),
  );
  const digest = releaseDigest(frozenDependencies);
  return deepFreeze({
    kind: DESIGN_SYSTEM_RELEASE_KIND,
    schemaVersion: DESIGN_SYSTEM_RELEASE_SCHEMA_VERSION,
    digest,
    dependencyManifest: frozenDependencies,
    tokenSources,
    assets,
    recipes,
  });
}

/** Constructs one detached immutable release from exact production dependencies. */
export function createDesignSystemRelease(
  input: DesignSystemReleaseInput,
): DesignSystemReleaseResult {
  return Object.freeze({ ok: true as const, release: buildRelease(input) });
}

function isReleaseSnapshot(value: unknown): value is DesignSystemReleaseSnapshot {
  return hasExactOwnDataShape(value, [
    "kind",
    "schemaVersion",
    "digest",
    "dependencyManifest",
    "tokenSources",
    "assets",
    "recipes",
  ]);
}

function validateManifestDependencies(value: readonly unknown[]): void {
  const ids = new Set<string>();
  let totalBytes = 0;
  for (const dependency of value) {
    if (!hasExactOwnDataShape(dependency, ["kind", "id", "bytes", "digest"], ["mediaType"])) {
      fail("INVALID_INPUT");
    }
    const kind = dependency.kind;
    if (
      kind !== "token" &&
      kind !== "font" &&
      kind !== "icon" &&
      kind !== "image" &&
      kind !== "recipe"
    ) {
      fail("INVALID_INPUT");
    }
    const assetDependency = isAssetKind(kind);
    if (
      (assetDependency &&
        !hasExactOwnDataShape(dependency, ["kind", "id", "bytes", "digest", "mediaType"])) ||
      (!assetDependency && !hasExactOwnDataShape(dependency, ["kind", "id", "bytes", "digest"]))
    ) {
      fail("INVALID_INPUT");
    }
    const id = captureIdentifier(dependency.id);
    captureDigest(dependency.digest);
    const bytes = dependency.bytes;
    if (typeof bytes !== "number" || !Number.isSafeInteger(bytes) || bytes <= 0) {
      fail("INVALID_INPUT");
    }
    if (assetDependency) captureAssetMediaType(kind, dependency.mediaType);
    if (ids.has(id)) fail("DUPLICATE_DEPENDENCY_ID");
    ids.add(id);
    totalBytes += bytes;
  }
  ensureLimit(totalBytes, value.length);
}

function snapshotInputFromRelease(release: unknown): DesignSystemReleaseInput {
  if (!isReleaseSnapshot(release) || release.kind !== DESIGN_SYSTEM_RELEASE_KIND) {
    fail("INVALID_INPUT");
  }
  if (release.schemaVersion !== DESIGN_SYSTEM_RELEASE_SCHEMA_VERSION) fail("INVALID_INPUT");
  if (
    typeof release.digest !== "string" ||
    !RELEASE_DIGEST_PATTERN.test(release.digest) ||
    !isSha256Digest(release.digest)
  ) {
    fail("RELEASE_DIGEST_MISMATCH");
  }
  if (
    !isDenseDataArray(
      release.dependencyManifest,
      DESIGN_SYSTEM_RELEASE_LIMITS.maxDependencyCount,
    ) ||
    !isDenseDataArray(release.tokenSources, DESIGN_SYSTEM_RELEASE_LIMITS.maxTokenSources) ||
    !isDenseDataArray(release.assets, DESIGN_SYSTEM_RELEASE_LIMITS.maxAssets) ||
    !isDenseDataArray(release.recipes, DESIGN_SYSTEM_RELEASE_LIMITS.maxRecipes) ||
    release.dependencyManifest.length === 0 ||
    release.tokenSources.length === 0
  ) {
    fail("LIMIT_EXCEEDED");
  }
  validateManifestDependencies(release.dependencyManifest);

  const tokenSources = release.tokenSources.map((source) => {
    if (!hasExactOwnDataShape(source, ["id", "document", "dependencyDigest"])) {
      fail("INVALID_TOKEN_SOURCE");
    }
    captureIdentifier(source.id);
    captureDigest(source.dependencyDigest);
    return { id: source.id, document: source.document };
  });
  const assets = release.assets.map((asset) => {
    if (!hasExactOwnDataShape(asset, ["id", "kind", "mediaType", "bytes", "dependencyDigest"])) {
      fail("INVALID_ASSET");
    }
    captureIdentifier(asset.id);
    if (!isAssetKind(asset.kind)) fail("INVALID_ASSET");
    captureMediaType(asset.mediaType);
    if (!hasValidSnapshotBytes(asset.bytes)) fail("INVALID_ASSET");
    captureDigest(asset.dependencyDigest);
    return {
      id: asset.id,
      kind: asset.kind,
      mediaType: asset.mediaType,
      bytes: Uint8Array.from(asset.bytes),
    };
  });
  const recipes = release.recipes.map((recipe) => {
    if (!hasExactOwnDataShape(recipe, ["id", "document", "dependencyDigest"])) {
      fail("INVALID_RECIPE");
    }
    captureIdentifier(recipe.id);
    captureDigest(recipe.dependencyDigest);
    return { id: recipe.id, document: recipe.document };
  });
  return { tokenSources, assets, recipes };
}

function captureVerifiedRelease(value: unknown): DesignSystemReleaseSnapshot {
  const release = value as DesignSystemReleaseSnapshot;
  const rebuilt = buildRelease(snapshotInputFromRelease(release));
  if (release.digest !== rebuilt.digest) fail("DIGEST_MISMATCH");
  let suppliedCanonical: string;
  let rebuiltCanonical: string;
  try {
    suppliedCanonical = canonicalizeJson(release);
    rebuiltCanonical = canonicalizeJson(rebuilt);
  } catch {
    fail("INVALID_INPUT");
  }
  if (suppliedCanonical !== rebuiltCanonical) fail("DIGEST_MISMATCH");
  return rebuilt;
}

/** Verifies every captured dependency and the release's aggregate content identity. */
export function verifyDesignSystemRelease(
  release: DesignSystemReleaseSnapshot,
): DesignSystemReleaseVerification {
  const captured = captureVerifiedRelease(release);
  return Object.freeze({
    ok: true as const,
    digest: captured.digest,
    dependencyCount: captured.dependencyManifest.length,
    dependencyBytes: captured.dependencyManifest.reduce(
      (total, dependency) => total + dependency.bytes,
      0,
    ),
  });
}

/** Creates an exact host-profile reference without mutable latest or loader semantics. */
export function createHostProfileReleaseReference(
  input: HostProfileReleaseReferenceInput,
): DesignSystemReleaseReference {
  if (
    !hasExactOwnDataShape(input, ["hostProfileId", "releaseDigest"]) ||
    typeof input.hostProfileId !== "string" ||
    !IDENTIFIER.test(input.hostProfileId)
  ) {
    fail("REFERENCE_INVALID");
  }
  const releaseDigestValue = captureDigest(input.releaseDigest);
  return deepFreeze({
    kind: DESIGN_SYSTEM_RELEASE_REFERENCE_KIND,
    schemaVersion: DESIGN_SYSTEM_RELEASE_SCHEMA_VERSION,
    hostProfileId: input.hostProfileId,
    releaseDigest: releaseDigestValue,
  });
}

/** Reads and verifies one exact release named by a host-profile reference. */
export async function readDesignSystemRelease(
  store: DesignSystemReleaseStore,
  reference: DesignSystemReleaseReference,
): Promise<DesignSystemReleaseSnapshot> {
  if (
    !hasExactOwnDataShape(reference, ["kind", "schemaVersion", "hostProfileId", "releaseDigest"]) ||
    reference.kind !== DESIGN_SYSTEM_RELEASE_REFERENCE_KIND ||
    reference.schemaVersion !== DESIGN_SYSTEM_RELEASE_SCHEMA_VERSION ||
    typeof reference.hostProfileId !== "string" ||
    !IDENTIFIER.test(reference.hostProfileId) ||
    typeof reference.releaseDigest !== "string" ||
    !RELEASE_DIGEST_PATTERN.test(reference.releaseDigest)
  ) {
    fail("REFERENCE_INVALID");
  }
  let result: DesignSystemReleaseStoreReadResult;
  try {
    result = await store.getRelease(reference.releaseDigest);
  } catch {
    fail("STORE_FAILURE");
  }
  if (!isObject(result) || !hasExactOwnDataShape(result, ["status"], ["entry"])) {
    fail("STORE_FAILURE");
  }
  const status = result.status;
  if (status !== "missing" && status !== "found") fail("STORE_FAILURE");
  if (status === "missing") {
    if (!hasExactOwnDataShape(result, ["status"])) fail("STORE_FAILURE");
    fail("RELEASE_NOT_FOUND");
  }
  if (!hasExactOwnDataShape(result, ["status", "entry"])) fail("STORE_FAILURE");
  if (!hasExactOwnDataShape(result.entry, ["release"])) fail("STORE_FAILURE");
  const release = result.entry.release;
  if (!isReleaseSnapshot(release)) fail("INVALID_INPUT");
  if (release.digest !== reference.releaseDigest) fail("REFERENCE_MISMATCH");
  return captureVerifiedRelease(release);
}

/** Creates an in-memory atomic exact-digest store for local hosts and focused tests. */
export function createDesignSystemReleaseStore(): DesignSystemReleaseStore {
  const releases = new Map<string, DesignSystemReleaseSnapshot>();
  return {
    async getRelease(digest) {
      if (typeof digest !== "string" || !RELEASE_DIGEST_PATTERN.test(digest)) {
        fail("REFERENCE_INVALID");
      }
      const release = releases.get(digest);
      return release === undefined
        ? MISSING
        : Object.freeze({ status: "found" as const, entry: Object.freeze({ release }) });
    },
    async putRelease(entry) {
      if (!hasExactOwnDataShape(entry, ["release"])) fail("STORE_FAILURE");
      const captured = captureVerifiedRelease(entry.release);
      const digest = captured.digest;
      const existing = releases.get(digest);
      if (existing === undefined) {
        releases.set(digest, captured);
        return STORED;
      }
      return canonicalizeJson(existing) === canonicalizeJson(captured) ? UNCHANGED : CONFLICT;
    },
  };
}
