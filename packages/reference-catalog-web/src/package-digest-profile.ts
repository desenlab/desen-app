import { canonicalizeJsonBytes, isSha256Digest, sha256Digest } from "@desen/protocol";

import type { DesenCatalog } from "@desen/protocol";

const WEB_REACT_TARGET = "web-react";
const CATALOG_ENTRY_PATH = "catalog.json";
const PROFILE_ID = "desen.web-react.package-digest";
const PROFILE_VERSION = 1;
const MAX_ARTIFACTS = 1_024;
const MAX_PATH_BYTES = 240;
const MAX_ENTRY_BYTES = 16 * 1_024 * 1_024;
const MAX_PREIMAGE_BYTES = 64 * 1_024 * 1_024;
const MAX_CATALOG_DEPTH = 128;
const MAX_CATALOG_NODES = 100_000;
const PATH_SEGMENT_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/u;
const WINDOWS_DEVICE_SEGMENT_PATTERN = /^(?:aux|com[1-9]|con|lpt[1-9]|nul|prn)(?:\.|$)/u;
const FUNCTION_TO_STRING = Function.prototype.toString;
const NATIVE_OBJECT_CONSTRUCTOR_SOURCE = Reflect.apply(FUNCTION_TO_STRING, Object, []);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_TAG_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;
const TYPED_ARRAY_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "length",
)?.get;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)?.get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)?.get;
const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
)?.get;
const SHARED_ARRAY_BUFFER_BYTE_LENGTH_GETTER =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")?.get;
const UINT8_ARRAY_SET = Uint8Array.prototype.set;

/**
 * The fixed Catalog digest value used only while constructing the package-digest preimage.
 *
 * @remarks A Catalog cannot contain the digest of bytes that themselves already contain that
 * digest without a circular definition. The Web–React profile therefore fingerprints canonical
 * Catalog bytes carrying this reserved value. A published Catalog replaces it with the resulting
 * package digest; the placeholder is never a valid published package identity.
 */
export const WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000";

const PROFILE_LIMITS = Object.freeze({
  artifacts: MAX_ARTIFACTS,
  catalogDepth: MAX_CATALOG_DEPTH,
  catalogNodes: MAX_CATALOG_NODES,
  entryBytes: MAX_ENTRY_BYTES,
  pathBytes: MAX_PATH_BYTES,
  preimageBytes: MAX_PREIMAGE_BYTES,
});

/**
 * Machine-readable identity and resource limits for the DESEN Web–React package digest profile.
 *
 * @remarks This is a project reference profile, not a universal DESEN 0.1.0 archive format.
 * DESEN 0.1.0 deliberately leaves byte-level capability packaging to each package ecosystem.
 */
export const WEB_REACT_PACKAGE_DIGEST_PROFILE = Object.freeze({
  id: PROFILE_ID,
  version: PROFILE_VERSION,
  target: WEB_REACT_TARGET,
  catalogPath: CATALOG_ENTRY_PATH,
  catalogDigestPlaceholder: WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER,
  catalogDigestProjection: "replace-top-level-packageDigest-with-placeholder",
  pathOrdering: "lowercase-ascii-ascending",
  framing:
    "magic + uint32be(entry-count) + repeated uint16be(path-bytes), path, uint32be(content-bytes), content",
  limits: PROFILE_LIMITS,
});

/** One exact target artifact included in the Web–React package digest. */
export interface WebReactPackageArtifactInput {
  /**
   * Portable lowercase-ASCII relative path.
   *
   * @remarks Segments may contain lowercase letters, digits, `.`, `_`, and `-`, but must begin
   * and end with a letter or digit. Absolute paths, empty segments, traversal, backslashes,
   * Unicode normalization ambiguity, Windows device names, and the reserved `catalog.json` path
   * are rejected.
   */
  readonly path: string;
  /** Exact artifact bytes. No text, line-ending, source-map, or compression normalization occurs. */
  readonly bytes: Uint8Array;
}

/** Input used to calculate the deterministic Web–React package digest preimage. */
export interface WebReactPackageDigestCalculationInput {
  /**
   * Authoritative DESEN Catalog carrying the reserved package-digest placeholder.
   *
   * @remarks The Catalog is serialized with RFC 8785-compatible canonical JSON and automatically
   * occupies the reserved `catalog.json` entry. Structural and semantic Catalog validation remains
   * the validator's responsibility.
   */
  readonly catalog: DesenCatalog;
  /** Target adapter, host-binding, stylesheet, asset, or metadata bytes to fingerprint. */
  readonly artifacts: readonly WebReactPackageArtifactInput[];
}

/** Input used to verify a published Web–React package and its declared Catalog digest. */
export interface WebReactPackageDigestVerificationInput {
  /**
   * Published DESEN Catalog carrying the package digest that verification must reproduce.
   *
   * @remarks Verification snapshots the Catalog once, projects only its top-level self-digest
   * back to {@link WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER}, and compares the recalculated value with
   * the original declaration.
   */
  readonly catalog: DesenCatalog;
  /** Exact target artifacts expected to be covered by the declared package digest. */
  readonly artifacts: readonly WebReactPackageArtifactInput[];
}

/** Immutable audit metadata for one framed package entry. */
export interface WebReactPackageDigestEntry {
  /** Canonical package-relative path. */
  readonly path: string;
  /** Exact content byte length before framing. */
  readonly byteLength: number;
  /** SHA-256 of the exact entry content, supplied for auditing rather than tree construction. */
  readonly contentDigest: string;
}

/** Immutable result of one deterministic Web–React package digest calculation. */
export interface WebReactPackageDigest {
  /** Reference profile identifier. */
  readonly profile: typeof PROFILE_ID;
  /** Reference profile version. */
  readonly profileVersion: typeof PROFILE_VERSION;
  /** Exact implementation target separated by the profile framing. */
  readonly target: typeof WEB_REACT_TARGET;
  /** DESEN-formatted SHA-256 of the complete framed preimage. */
  readonly packageDigest: string;
  /** Complete framed preimage byte length. */
  readonly byteLength: number;
  /** Canonically ordered, detached, recursively frozen entry audit metadata. */
  readonly entries: readonly WebReactPackageDigestEntry[];
}

interface PackageEntry {
  readonly path: string;
  readonly pathBytes: Uint8Array;
  readonly contentBytes: Uint8Array;
}

interface PackageBuild {
  readonly bytes: Uint8Array;
  readonly entries: readonly PackageEntry[];
  readonly declaredDigest: string;
}

interface CatalogDigestSnapshot {
  readonly bytes: Uint8Array;
  readonly declaredDigest: string;
}

type CatalogDigestMode = "placeholder" | "published";
type CatalogSnapshotContainer = Record<string, unknown> | unknown[];

interface CatalogSnapshotValueTask {
  readonly kind: "value";
  readonly value: unknown;
  readonly destination: CatalogSnapshotContainer;
  readonly key: string;
  readonly depth: number;
}

interface CatalogSnapshotExitTask {
  readonly kind: "exit";
  readonly value: object;
}

type CatalogSnapshotTask = CatalogSnapshotValueTask | CatalogSnapshotExitTask;

interface BoundedCatalogSnapshot {
  readonly snapshot: unknown;
  readonly canonicalByteLength: number;
}

function asciiBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index);
  }
  return bytes;
}

const PROFILE_MAGIC = asciiBytes("DESEN-WEB-REACT-PACKAGE-DIGEST-V1\n");

function fail(path: string, message: string): never {
  throw new TypeError(`Invalid Web-React package digest input at ${path}: ${message}`);
}

function readExactDataObject(
  value: unknown,
  path: string,
  expectedKeys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "expected an object");
  }

  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    fail(path, `expected only ${expectedKeys.join(", ")}`);
  }

  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(`${path}/${key}`, "expected an enumerable data property");
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function readDataProperty(value: object, key: string, path: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    fail(path, "expected an enumerable data property");
  }
  return descriptor.value;
}

function assertPlainCatalogObject(value: object, path: string): void {
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null) return;

  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor");
  if (
    Object.getPrototypeOf(prototype) !== null ||
    constructor === undefined ||
    !("value" in constructor) ||
    typeof constructor.value !== "function" ||
    Reflect.apply(FUNCTION_TO_STRING, constructor.value, []) !== NATIVE_OBJECT_CONSTRUCTOR_SOURCE
  ) {
    fail(path, "expected a plain JSON object");
  }
}

function canonicalStringByteLength(value: string, remainingBytes: number, path: string): number {
  if (value.length + 2 > remainingBytes) {
    fail("/catalog", `canonical Catalog exceeds the ${String(MAX_ENTRY_BYTES)}-byte limit`);
  }

  let byteLength = 2;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0x22 || codeUnit === 0x5c) {
      byteLength += 2;
    } else if (
      codeUnit === 0x08 ||
      codeUnit === 0x09 ||
      codeUnit === 0x0a ||
      codeUnit === 0x0c ||
      codeUnit === 0x0d
    ) {
      byteLength += 2;
    } else if (codeUnit <= 0x1f) {
      byteLength += 6;
    } else if (codeUnit <= 0x7f) {
      byteLength += 1;
    } else if (codeUnit <= 0x7ff) {
      byteLength += 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (!(trailing >= 0xdc00 && trailing <= 0xdfff)) {
        fail(path, "string contains an unpaired high surrogate");
      }
      byteLength += 4;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      fail(path, "string contains an unpaired low surrogate");
    } else {
      byteLength += 3;
    }

    if (byteLength > remainingBytes) {
      fail("/catalog", `canonical Catalog exceeds the ${String(MAX_ENTRY_BYTES)}-byte limit`);
    }
  }
  return byteLength;
}

function defineSnapshotValue(
  destination: CatalogSnapshotContainer,
  key: string,
  value: unknown,
): void {
  Object.defineProperty(destination, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function snapshotBoundedCatalog(catalog: unknown): BoundedCatalogSnapshot {
  const root: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const activeContainers = new WeakSet<object>();
  const tasks: CatalogSnapshotTask[] = [
    {
      kind: "value",
      value: catalog,
      destination: root,
      key: "value",
      depth: 0,
    },
  ];
  let canonicalByteLength = 0;
  let nodeCount = 0;
  let scheduledNodeCount = 1;

  function consumeBytes(byteLength: number): void {
    if (byteLength > MAX_ENTRY_BYTES - canonicalByteLength) {
      fail("/catalog", `canonical Catalog exceeds the ${String(MAX_ENTRY_BYTES)}-byte limit`);
    }
    canonicalByteLength += byteLength;
  }

  function reserveChildNodes(childCount: number): void {
    if (childCount > MAX_CATALOG_NODES - scheduledNodeCount) {
      fail("/catalog", `exceeds the ${String(MAX_CATALOG_NODES)}-node limit`);
    }
    scheduledNodeCount += childCount;
  }

  while (tasks.length > 0) {
    const task = tasks.pop();
    if (task === undefined) {
      throw new Error("Catalog snapshot task stack underflow");
    }
    if (task.kind === "exit") {
      activeContainers.delete(task.value);
      continue;
    }
    if (task.depth > MAX_CATALOG_DEPTH) {
      fail("/catalog", `exceeds the ${String(MAX_CATALOG_DEPTH)}-level depth limit`);
    }

    nodeCount += 1;
    if (nodeCount > MAX_CATALOG_NODES) {
      fail("/catalog", `exceeds the ${String(MAX_CATALOG_NODES)}-node limit`);
    }

    if (task.value === null) {
      consumeBytes(4);
      defineSnapshotValue(task.destination, task.key, null);
      continue;
    }

    switch (typeof task.value) {
      case "boolean":
        consumeBytes(task.value ? 4 : 5);
        defineSnapshotValue(task.destination, task.key, task.value);
        continue;
      case "number": {
        if (!Number.isFinite(task.value)) {
          fail("/catalog", "contains NaN or infinity");
        }
        const serialized = JSON.stringify(task.value);
        if (serialized === undefined) {
          throw new Error("Finite JSON number serialization returned no text");
        }
        consumeBytes(serialized.length);
        defineSnapshotValue(task.destination, task.key, task.value);
        continue;
      }
      case "string":
        consumeBytes(
          canonicalStringByteLength(task.value, MAX_ENTRY_BYTES - canonicalByteLength, "/catalog"),
        );
        defineSnapshotValue(task.destination, task.key, task.value);
        continue;
      case "object": {
        if (activeContainers.has(task.value)) {
          fail("/catalog", "contains a cycle");
        }

        if (Array.isArray(task.value)) {
          const lengthDescriptor = Object.getOwnPropertyDescriptor(task.value, "length");
          if (
            lengthDescriptor === undefined ||
            !("value" in lengthDescriptor) ||
            typeof lengthDescriptor.value !== "number" ||
            !Number.isSafeInteger(lengthDescriptor.value) ||
            lengthDescriptor.value < 0
          ) {
            fail("/catalog", "contains an array without an intrinsic length");
          }
          const elementCount = lengthDescriptor.value;
          if (task.depth === MAX_CATALOG_DEPTH && elementCount > 0) {
            fail("/catalog", `exceeds the ${String(MAX_CATALOG_DEPTH)}-level depth limit`);
          }
          reserveChildNodes(elementCount);

          const keys = Reflect.ownKeys(task.value);
          if (
            keys.length !== elementCount + 1 ||
            keys.some(
              (key) =>
                typeof key !== "string" ||
                (key !== "length" &&
                  (!/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= elementCount)),
            )
          ) {
            fail("/catalog", "contains a sparse or decorated array");
          }

          consumeBytes(2 + Math.max(0, elementCount - 1));
          const snapshot = new Array<unknown>(elementCount);
          const children: CatalogSnapshotValueTask[] = [];
          for (let index = 0; index < elementCount; index += 1) {
            const key = String(index);
            const descriptor = Object.getOwnPropertyDescriptor(task.value, key);
            if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
              fail("/catalog", "contains a non-data array element");
            }
            children.push({
              kind: "value",
              value: descriptor.value,
              destination: snapshot,
              key,
              depth: task.depth + 1,
            });
          }

          defineSnapshotValue(task.destination, task.key, snapshot);
          activeContainers.add(task.value);
          tasks.push({ kind: "exit", value: task.value });
          for (let index = children.length - 1; index >= 0; index -= 1) {
            const child = children[index];
            if (child !== undefined) tasks.push(child);
          }
          continue;
        }

        assertPlainCatalogObject(task.value, "/catalog");
        const keys = Reflect.ownKeys(task.value);
        if (keys.some((key) => typeof key === "symbol")) {
          fail("/catalog", "contains a symbol property");
        }
        if (task.depth === MAX_CATALOG_DEPTH && keys.length > 0) {
          fail("/catalog", `exceeds the ${String(MAX_CATALOG_DEPTH)}-level depth limit`);
        }
        reserveChildNodes(keys.length);
        consumeBytes(2 + Math.max(0, keys.length - 1) + keys.length);

        const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
        const children: CatalogSnapshotValueTask[] = [];
        for (const key of keys) {
          if (typeof key !== "string") {
            fail("/catalog", "contains a symbol property");
          }
          consumeBytes(
            canonicalStringByteLength(key, MAX_ENTRY_BYTES - canonicalByteLength, "/catalog"),
          );
          const descriptor = Object.getOwnPropertyDescriptor(task.value, key);
          if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
            fail("/catalog", "contains a non-data object property");
          }
          children.push({
            kind: "value",
            value: descriptor.value,
            destination: snapshot,
            key,
            depth: task.depth + 1,
          });
        }

        defineSnapshotValue(task.destination, task.key, snapshot);
        activeContainers.add(task.value);
        tasks.push({ kind: "exit", value: task.value });
        for (let index = children.length - 1; index >= 0; index -= 1) {
          const child = children[index];
          if (child !== undefined) tasks.push(child);
        }
        continue;
      }
      default:
        fail("/catalog", `contains the non-JSON value type ${typeof task.value}`);
    }
  }

  if (nodeCount !== scheduledNodeCount) {
    throw new Error("Catalog snapshot node accounting mismatch");
  }
  return {
    snapshot: root.value,
    canonicalByteLength,
  };
}

function assertCatalogIdentity(
  catalog: unknown,
  digestMode: CatalogDigestMode,
): asserts catalog is DesenCatalog {
  if (catalog === null || typeof catalog !== "object" || Array.isArray(catalog)) {
    fail("/catalog", "expected a DESEN Catalog object");
  }

  const expectedFields = Object.freeze({
    kind: "desen.catalog",
    desen: "0.1.0",
    target: WEB_REACT_TARGET,
  });
  for (const [field, expected] of Object.entries(expectedFields)) {
    const actual = readDataProperty(catalog, field, `/catalog/${field}`);
    if (actual !== expected) {
      fail(`/catalog/${field}`, `expected ${JSON.stringify(expected)}`);
    }
  }

  const packageDigest = readDataProperty(catalog, "packageDigest", "/catalog/packageDigest");
  if (
    digestMode === "placeholder"
      ? packageDigest !== WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER
      : !isSha256Digest(packageDigest)
  ) {
    fail(
      "/catalog/packageDigest",
      digestMode === "placeholder"
        ? `expected ${JSON.stringify(WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER)}`
        : "expected a lowercase DESEN SHA-256 digest",
    );
  }
}

function createCatalogDigestSnapshot(
  catalog: unknown,
  digestMode: CatalogDigestMode,
): CatalogDigestSnapshot {
  // The bounded descriptor walk turns even cross-realm or Proxy-backed inputs into one inert
  // observation before the recursive canonicalizer runs. Identity checks, the declared digest,
  // and projection therefore never reread live input or expand an unbounded caller graph.
  const { snapshot, canonicalByteLength } = snapshotBoundedCatalog(catalog);
  assertCatalogIdentity(snapshot, digestMode);
  const declaredDigest = readDataProperty(
    snapshot,
    "packageDigest",
    "/catalog/packageDigest",
  ) as string;
  if (digestMode === "published") {
    (snapshot as Record<string, unknown>).packageDigest = WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER;
  }
  const bytes = canonicalizeJsonBytes(snapshot);
  if (bytes.length !== canonicalByteLength) {
    throw new Error("Web-React Catalog canonical byte-length accounting mismatch");
  }
  return {
    bytes,
    declaredDigest,
  };
}

function isSharedArrayBuffer(value: unknown): boolean {
  if (SHARED_ARRAY_BUFFER_BYTE_LENGTH_GETTER === undefined) return false;
  try {
    Reflect.apply(SHARED_ARRAY_BUFFER_BYTE_LENGTH_GETTER, value, []);
    return true;
  } catch {
    return false;
  }
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  if (ARRAY_BUFFER_BYTE_LENGTH_GETTER === undefined) return false;
  try {
    Reflect.apply(ARRAY_BUFFER_BYTE_LENGTH_GETTER, value, []);
    return true;
  } catch {
    return false;
  }
}

function copyArtifactBytes(
  value: unknown,
  path: string,
  remainingPreimageBytes: number,
): Uint8Array {
  if (
    !ArrayBuffer.isView(value) ||
    TYPED_ARRAY_TAG_GETTER === undefined ||
    TYPED_ARRAY_LENGTH_GETTER === undefined ||
    TYPED_ARRAY_BUFFER_GETTER === undefined ||
    TYPED_ARRAY_BYTE_OFFSET_GETTER === undefined
  ) {
    fail(path, "expected a Uint8Array");
  }

  let tag: unknown;
  let length: unknown;
  let buffer: unknown;
  let byteOffset: unknown;
  try {
    tag = Reflect.apply(TYPED_ARRAY_TAG_GETTER, value, []);
    length = Reflect.apply(TYPED_ARRAY_LENGTH_GETTER, value, []);
    buffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch {
    return fail(path, "expected an attached Uint8Array");
  }

  if (tag !== "Uint8Array" || typeof length !== "number" || typeof byteOffset !== "number") {
    fail(path, "expected a Uint8Array");
  }
  if (isSharedArrayBuffer(buffer)) {
    fail(path, "SharedArrayBuffer-backed bytes are not an immutable snapshot source");
  }
  if (!isArrayBuffer(buffer)) {
    fail(path, "expected ArrayBuffer-backed bytes");
  }
  if (length > MAX_ENTRY_BYTES) {
    fail(path, `entry exceeds the ${String(MAX_ENTRY_BYTES)}-byte limit`);
  }
  if (length > remainingPreimageBytes) {
    fail("/", `framed preimage exceeds the ${String(MAX_PREIMAGE_BYTES)}-byte limit`);
  }

  const source = new Uint8Array(buffer, byteOffset, length);
  const copy = new Uint8Array(length);
  Reflect.apply(UINT8_ARRAY_SET, copy, [source]);
  return copy;
}

function readDenseArtifacts(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) fail("/artifacts", "expected a dense array");
  const keys = Reflect.ownKeys(value);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    fail("/artifacts/length", "expected an intrinsic array length");
  }
  const artifactCount = lengthDescriptor.value;
  if (artifactCount > MAX_ARTIFACTS) {
    fail("/artifacts", `exceeds the ${String(MAX_ARTIFACTS)}-artifact limit`);
  }

  if (
    keys.length !== artifactCount + 1 ||
    keys.some(
      (key) =>
        typeof key !== "string" ||
        (key !== "length" && (!/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= artifactCount)),
    )
  ) {
    fail("/artifacts", "expected a dense array with no extra properties");
  }
  const artifacts: unknown[] = [];
  for (let index = 0; index < artifactCount; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(`/artifacts/${String(index)}`, "expected an enumerable data property");
    }
    artifacts.push(descriptor.value);
  }
  return artifacts;
}

function validateArtifactPath(value: unknown, index: number): string {
  const path = `/artifacts/${String(index)}/path`;
  if (typeof value !== "string") fail(path, "expected a string");
  if (value.length === 0 || value.length > MAX_PATH_BYTES) {
    fail(path, `expected 1 to ${String(MAX_PATH_BYTES)} lowercase ASCII bytes`);
  }
  if (value === CATALOG_ENTRY_PATH) {
    fail(path, `${CATALOG_ENTRY_PATH} is reserved for the canonical Catalog`);
  }
  if (!value.split("/").every((segment) => PATH_SEGMENT_PATTERN.test(segment))) {
    fail(path, "expected a portable lowercase-ASCII relative path");
  }
  if (value.split("/").some((segment) => WINDOWS_DEVICE_SEGMENT_PATTERN.test(segment))) {
    fail(path, "Windows device names are not portable path segments");
  }
  return value;
}

function readArtifacts(value: unknown, initialPreimageBytes: number): PackageEntry[] {
  const artifacts = readDenseArtifacts(value);
  const entries: PackageEntry[] = [];
  const seenPaths = new Set<string>([CATALOG_ENTRY_PATH]);
  let preimageBytes = initialPreimageBytes;

  for (let index = 0; index < artifacts.length; index += 1) {
    const artifact = artifacts[index];
    const artifactPath = `/artifacts/${String(index)}`;
    const artifactSnapshot = readExactDataObject(artifact, artifactPath, ["path", "bytes"]);
    const path = validateArtifactPath(artifactSnapshot.path, index);
    if (seenPaths.has(path)) fail(`${artifactPath}/path`, `duplicate path ${JSON.stringify(path)}`);
    seenPaths.add(path);

    const pathBytes = asciiBytes(path);
    const framingBytes = 2 + pathBytes.length + 4;
    if (framingBytes > MAX_PREIMAGE_BYTES - preimageBytes) {
      fail("/", `framed preimage exceeds the ${String(MAX_PREIMAGE_BYTES)}-byte limit`);
    }
    const contentBytes = copyArtifactBytes(
      artifactSnapshot.bytes,
      `${artifactPath}/bytes`,
      MAX_PREIMAGE_BYTES - preimageBytes - framingBytes,
    );
    preimageBytes += framingBytes + contentBytes.length;

    entries.push({
      path,
      pathBytes,
      contentBytes,
    });
  }

  return entries;
}

function writeUint16BigEndian(bytes: Uint8Array, offset: number, value: number): number {
  bytes[offset] = value >>> 8;
  bytes[offset + 1] = value;
  return offset + 2;
}

function writeUint32BigEndian(bytes: Uint8Array, offset: number, value: number): number {
  bytes[offset] = value >>> 24;
  bytes[offset + 1] = value >>> 16;
  bytes[offset + 2] = value >>> 8;
  bytes[offset + 3] = value;
  return offset + 4;
}

function copyInto(target: Uint8Array, offset: number, source: Uint8Array): number {
  Reflect.apply(UINT8_ARRAY_SET, target, [source, offset]);
  return offset + source.length;
}

function calculatePreimageByteLength(entries: readonly PackageEntry[]): number {
  let byteLength = PROFILE_MAGIC.length + 4;
  for (const entry of entries) {
    const framedLength = 2 + entry.pathBytes.length + 4 + entry.contentBytes.length;
    if (framedLength > MAX_PREIMAGE_BYTES - byteLength) {
      fail("/", `framed preimage exceeds the ${String(MAX_PREIMAGE_BYTES)}-byte limit`);
    }
    byteLength += framedLength;
  }
  return byteLength;
}

function buildPackage(input: unknown, digestMode: CatalogDigestMode): PackageBuild {
  const inputSnapshot = readExactDataObject(input, "/", ["catalog", "artifacts"]);
  const catalogSnapshot = createCatalogDigestSnapshot(inputSnapshot.catalog, digestMode);
  const catalogBytes = catalogSnapshot.bytes;
  if (catalogBytes.length > MAX_ENTRY_BYTES) {
    fail("/catalog", `canonical Catalog exceeds the ${String(MAX_ENTRY_BYTES)}-byte limit`);
  }

  const catalogEntry = {
    path: CATALOG_ENTRY_PATH,
    pathBytes: asciiBytes(CATALOG_ENTRY_PATH),
    contentBytes: catalogBytes,
  };
  const entries: PackageEntry[] = [
    catalogEntry,
    ...readArtifacts(inputSnapshot.artifacts, calculatePreimageByteLength([catalogEntry])),
  ];
  entries.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

  const preimage = new Uint8Array(calculatePreimageByteLength(entries));
  let offset = copyInto(preimage, 0, PROFILE_MAGIC);
  offset = writeUint32BigEndian(preimage, offset, entries.length);
  for (const entry of entries) {
    offset = writeUint16BigEndian(preimage, offset, entry.pathBytes.length);
    offset = copyInto(preimage, offset, entry.pathBytes);
    offset = writeUint32BigEndian(preimage, offset, entry.contentBytes.length);
    offset = copyInto(preimage, offset, entry.contentBytes);
  }
  if (offset !== preimage.length) {
    throw new Error("Web-React package digest framing length mismatch");
  }

  return { bytes: preimage, entries, declaredDigest: catalogSnapshot.declaredDigest };
}

/**
 * Encodes the exact byte sequence hashed by the deterministic Web–React package digest profile.
 *
 * @remarks The result is a digest preimage, not an npm tarball or remotely executable archive.
 * It starts with a versioned domain-separation magic value, then frames a canonically ordered
 * `catalog.json` entry and every exact target artifact with unambiguous big-endian lengths.
 * Catalog object-key order and artifact-list order do not affect the result; path names and every
 * artifact byte do. A fresh `Uint8Array` is returned on every call and no caller-owned byte view is
 * retained.
 *
 * @throws TypeError when the wrapper, Catalog identity, artifact paths, byte views, or resource
 * limits violate the profile.
 */
export function encodeWebReactPackageDigestPreimage(
  input: WebReactPackageDigestCalculationInput,
): Uint8Array {
  return buildPackage(input, "placeholder").bytes;
}

function describePackage(built: PackageBuild): WebReactPackageDigest {
  const entries = Object.freeze(
    built.entries.map((entry) =>
      Object.freeze({
        path: entry.path,
        byteLength: entry.contentBytes.length,
        contentDigest: sha256Digest(entry.contentBytes),
      }),
    ),
  );
  return Object.freeze({
    profile: PROFILE_ID,
    profileVersion: PROFILE_VERSION,
    target: WEB_REACT_TARGET,
    packageDigest: sha256Digest(built.bytes),
    byteLength: built.bytes.length,
    entries,
  });
}

/**
 * Calculates and describes one deterministic Web–React capability-package digest.
 *
 * @remarks The returned audit description contains no executable values or mutable byte views. It
 * is detached and recursively frozen. Per-entry content digests help explain drift but the package
 * identity is always SHA-256 of the complete versioned framing returned by
 * {@link encodeWebReactPackageDigestPreimage}.
 */
export function createWebReactPackageDigest(
  input: WebReactPackageDigestCalculationInput,
): WebReactPackageDigest {
  return describePackage(buildPackage(input, "placeholder"));
}

/**
 * Verifies a published Catalog's declared digest against the exact Web–React package contents.
 *
 * @remarks Verification snapshots and canonicalizes the supplied Catalog, replaces only its
 * top-level `packageDigest` with the reserved placeholder, rebuilds the complete framed preimage,
 * and requires the declared value to equal the calculated result. The caller's Catalog and bytes
 * are never changed or retained. A changed self-field therefore fails verification instead of
 * creating a second valid package with the same logical content.
 *
 * @returns The same detached, deeply frozen audit description produced during calculation.
 *
 * @throws TypeError when the input violates the profile or the declared digest does not match.
 */
export function verifyWebReactPackageDigest(
  input: WebReactPackageDigestVerificationInput,
): WebReactPackageDigest {
  const built = buildPackage(input, "published");
  const description = describePackage(built);
  if (built.declaredDigest !== description.packageDigest) {
    fail(
      "/catalog/packageDigest",
      `declared ${JSON.stringify(built.declaredDigest)} but calculated ${JSON.stringify(description.packageDigest)}`,
    );
  }
  return description;
}
