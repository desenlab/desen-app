const SHA256_INITIAL_STATE = Uint32Array.of(
  0x6a09e667,
  0xbb67ae85,
  0x3c6ef372,
  0xa54ff53a,
  0x510e527f,
  0x9b05688c,
  0x1f83d9ab,
  0x5be0cd19,
);

const SHA256_ROUND_CONSTANTS = Uint32Array.of(
  0x428a2f98,
  0x71374491,
  0xb5c0fbcf,
  0xe9b5dba5,
  0x3956c25b,
  0x59f111f1,
  0x923f82a4,
  0xab1c5ed5,
  0xd807aa98,
  0x12835b01,
  0x243185be,
  0x550c7dc3,
  0x72be5d74,
  0x80deb1fe,
  0x9bdc06a7,
  0xc19bf174,
  0xe49b69c1,
  0xefbe4786,
  0x0fc19dc6,
  0x240ca1cc,
  0x2de92c6f,
  0x4a7484aa,
  0x5cb0a9dc,
  0x76f988da,
  0x983e5152,
  0xa831c66d,
  0xb00327c8,
  0xbf597fc7,
  0xc6e00bf3,
  0xd5a79147,
  0x06ca6351,
  0x14292967,
  0x27b70a85,
  0x2e1b2138,
  0x4d2c6dfc,
  0x53380d13,
  0x650a7354,
  0x766a0abb,
  0x81c2c92e,
  0x92722c85,
  0xa2bfe8a1,
  0xa81a664b,
  0xc24b8b70,
  0xc76c51a3,
  0xd192e819,
  0xd6990624,
  0xf40e3585,
  0x106aa070,
  0x19a4c116,
  0x1e376c08,
  0x2748774c,
  0x34b0bcb5,
  0x391c0cb3,
  0x4ed8aa4a,
  0x5b9cca4f,
  0x682e6ff3,
  0x748f82ee,
  0x78a5636f,
  0x84c87814,
  0x8cc70208,
  0x90befffa,
  0xa4506ceb,
  0xbef9a3f7,
  0xc67178f2,
);

const NO_OMITTED_ROOT_KEYS: ReadonlySet<string> = new Set();
const SOURCE_OMITTED_ROOT_KEYS: ReadonlySet<string> = new Set(["authoring"]);
const BUNDLE_OMITTED_ROOT_KEYS: ReadonlySet<string> = new Set(["revision", "publication"]);
const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
// The intrinsic source form recognizes ordinary Object prototypes across realms without reading a
// caller-controlled constructor name or invoking the constructor.
const FUNCTION_TO_STRING = Function.prototype.toString;
const NATIVE_OBJECT_CONSTRUCTOR_SOURCE = Reflect.apply(FUNCTION_TO_STRING, Object, []);
// Intrinsic typed-array accessors bypass user-defined tag, length, and method hooks so hashing an
// authentic byte view cannot execute caller code or silently change the byte range.
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_TAG_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;
const TYPED_ARRAY_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "length",
)?.get;

function canonicalizationFailure(message: string): never {
  throw new TypeError(`Cannot canonicalize JSON: ${message}`);
}

function assertUnicodeScalarSequence(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (!(trailing >= 0xdc00 && trailing <= 0xdfff)) {
        canonicalizationFailure("a string contains an unpaired high surrogate");
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      canonicalizationFailure("a string contains an unpaired low surrogate");
    }
  }
}

function serializeString(value: string): string {
  assertUnicodeScalarSequence(value);
  return JSON.stringify(value);
}

function assertDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
  propertyDescription: string,
): asserts descriptor is PropertyDescriptor & { value: unknown } {
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    canonicalizationFailure(`${propertyDescription} is not an enumerable data property`);
  }
}

function assertJsonObject(value: object): void {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null) {
    const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor");
    if (
      Object.getPrototypeOf(prototype) !== null ||
      constructor === undefined ||
      !("value" in constructor) ||
      typeof constructor.value !== "function" ||
      Reflect.apply(FUNCTION_TO_STRING, constructor.value, []) !== NATIVE_OBJECT_CONSTRUCTOR_SOURCE
    ) {
      canonicalizationFailure("an object uses a non-JSON prototype");
    }
  }
}

function isUint8Array(value: unknown): value is Uint8Array {
  return (
    ArrayBuffer.isView(value) &&
    TYPED_ARRAY_TAG_GETTER !== undefined &&
    Reflect.apply(TYPED_ARRAY_TAG_GETTER, value, []) === "Uint8Array"
  );
}

function serializeArray(
  value: unknown[],
  activeContainers: WeakSet<object>,
  omittedRootKeys: ReadonlySet<string>,
): string {
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== value.length + 1 ||
    ownKeys.some((key) => typeof key === "symbol") ||
    !ownKeys.includes("length")
  ) {
    canonicalizationFailure("an array is sparse or has non-JSON properties");
  }

  const elements: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const property = String(index);
    const descriptor = Object.getOwnPropertyDescriptor(value, property);
    assertDataDescriptor(descriptor, `array element ${property}`);
    elements.push(serializeValue(descriptor.value, activeContainers, omittedRootKeys, false));
  }
  return `[${elements.join(",")}]`;
}

function serializeObject(
  value: object,
  activeContainers: WeakSet<object>,
  omittedRootKeys: ReadonlySet<string>,
  isRoot: boolean,
): string {
  assertJsonObject(value);
  const properties: { key: string; value: unknown }[] = [];

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      canonicalizationFailure("an object has a symbol property");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assertDataDescriptor(descriptor, `object property ${serializeString(key)}`);
    if (!isRoot || !omittedRootKeys.has(key)) {
      properties.push({ key, value: descriptor.value });
    }
  }

  properties.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  return `{${properties
    .map(
      ({ key, value: propertyValue }) =>
        `${serializeString(key)}:${serializeValue(
          propertyValue,
          activeContainers,
          omittedRootKeys,
          false,
        )}`,
    )
    .join(",")}}`;
}

function serializeValue(
  value: unknown,
  activeContainers: WeakSet<object>,
  omittedRootKeys: ReadonlySet<string>,
  isRoot: boolean,
): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number": {
      if (!Number.isFinite(value)) {
        canonicalizationFailure("NaN and infinity are not JSON numbers");
      }
      return JSON.stringify(value);
    }
    case "string":
      return serializeString(value);
    case "object": {
      if (activeContainers.has(value)) {
        canonicalizationFailure("the value contains a cycle");
      }
      activeContainers.add(value);
      try {
        return Array.isArray(value)
          ? serializeArray(value, activeContainers, omittedRootKeys)
          : serializeObject(value, activeContainers, omittedRootKeys, isRoot);
      } finally {
        activeContainers.delete(value);
      }
    }
    default:
      return canonicalizationFailure(`the value type ${typeof value} is not part of JSON`);
  }
}

function canonicalizeWithProjection(value: unknown, omittedRootKeys: ReadonlySet<string>): string {
  return serializeValue(value, new WeakSet(), omittedRootKeys, true);
}

function assertDocumentRoot(value: unknown, documentName: string): asserts value is object {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    canonicalizationFailure(`${documentName} must have a JSON object root`);
  }
  assertJsonObject(value);
}

function encodeUtf8(value: string): Uint8Array {
  let byteLength = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x7f) byteLength += 1;
    else if (codeUnit <= 0x7ff) byteLength += 2;
    else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      byteLength += 4;
      index += 1;
    } else byteLength += 3;
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index);
    if (codePoint <= 0x7f) {
      bytes[offset] = codePoint;
      offset += 1;
    } else if (codePoint <= 0x7ff) {
      bytes[offset] = 0xc0 | (codePoint >>> 6);
      bytes[offset + 1] = 0x80 | (codePoint & 0x3f);
      offset += 2;
    } else if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (trailing - 0xdc00);
      bytes[offset] = 0xf0 | (codePoint >>> 18);
      bytes[offset + 1] = 0x80 | ((codePoint >>> 12) & 0x3f);
      bytes[offset + 2] = 0x80 | ((codePoint >>> 6) & 0x3f);
      bytes[offset + 3] = 0x80 | (codePoint & 0x3f);
      offset += 4;
      index += 1;
    } else {
      bytes[offset] = 0xe0 | (codePoint >>> 12);
      bytes[offset + 1] = 0x80 | ((codePoint >>> 6) & 0x3f);
      bytes[offset + 2] = 0x80 | (codePoint & 0x3f);
      offset += 3;
    }
  }
  return bytes;
}

function rotateRight(value: number, distance: number): number {
  return (value >>> distance) | (value << (32 - distance));
}

function compressSha256Block(
  block: Uint8Array,
  offset: number,
  state: Uint32Array,
  schedule: Uint32Array,
): void {
  for (let index = 0; index < 16; index += 1) {
    const byteOffset = offset + index * 4;
    schedule[index] =
      ((block[byteOffset] ?? 0) << 24) |
      ((block[byteOffset + 1] ?? 0) << 16) |
      ((block[byteOffset + 2] ?? 0) << 8) |
      (block[byteOffset + 3] ?? 0);
  }
  for (let index = 16; index < 64; index += 1) {
    const value15 = schedule[index - 15] ?? 0;
    const value2 = schedule[index - 2] ?? 0;
    const sigma0 = rotateRight(value15, 7) ^ rotateRight(value15, 18) ^ (value15 >>> 3);
    const sigma1 = rotateRight(value2, 17) ^ rotateRight(value2, 19) ^ (value2 >>> 10);
    schedule[index] =
      (sigma1 + (schedule[index - 7] ?? 0) + sigma0 + (schedule[index - 16] ?? 0)) >>> 0;
  }

  let a = state[0] ?? 0;
  let b = state[1] ?? 0;
  let c = state[2] ?? 0;
  let d = state[3] ?? 0;
  let e = state[4] ?? 0;
  let f = state[5] ?? 0;
  let g = state[6] ?? 0;
  let h = state[7] ?? 0;

  for (let index = 0; index < 64; index += 1) {
    const upperSigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
    const choice = (e & f) ^ (~e & g);
    const temporary1 =
      (h + upperSigma1 + choice + (SHA256_ROUND_CONSTANTS[index] ?? 0) + (schedule[index] ?? 0)) >>>
      0;
    const upperSigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
    const majority = (a & b) ^ (a & c) ^ (b & c);
    const temporary2 = (upperSigma0 + majority) >>> 0;

    h = g;
    g = f;
    f = e;
    e = (d + temporary1) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (temporary1 + temporary2) >>> 0;
  }

  state[0] = ((state[0] ?? 0) + a) >>> 0;
  state[1] = ((state[1] ?? 0) + b) >>> 0;
  state[2] = ((state[2] ?? 0) + c) >>> 0;
  state[3] = ((state[3] ?? 0) + d) >>> 0;
  state[4] = ((state[4] ?? 0) + e) >>> 0;
  state[5] = ((state[5] ?? 0) + f) >>> 0;
  state[6] = ((state[6] ?? 0) + g) >>> 0;
  state[7] = ((state[7] ?? 0) + h) >>> 0;
}

function bytesToHex(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
  return result;
}

/**
 * Serializes a JSON data tree to RFC 8785 JSON Canonicalization Scheme text.
 *
 * @remarks Input must already be represented as plain JSON data. Serialization hooks, accessors,
 * sparse arrays, symbol properties, cycles, non-finite numbers, and invalid Unicode are rejected.
 * Runtime DESEN schema validation remains a separate validator-package responsibility. This is a
 * one-shot, side-effect-free operation and never changes the supplied data tree.
 *
 * @throws TypeError when the input cannot be represented as RFC 8785-compatible I-JSON.
 */
export function canonicalizeJson(value: unknown): string {
  return canonicalizeWithProjection(value, NO_OMITTED_ROOT_KEYS);
}

/**
 * Serializes a JSON data tree to the canonical UTF-8 bytes required by RFC 8785.
 *
 * @remarks Returns a new byte array on every call and never changes the supplied data tree.
 *
 * @throws TypeError when the input cannot be represented as RFC 8785-compatible I-JSON.
 */
export function canonicalizeJsonBytes(value: unknown): Uint8Array {
  return encodeUtf8(canonicalizeJson(value));
}

/**
 * Calculates the SHA-256 message digest of a byte sequence without platform-specific APIs.
 *
 * @remarks This one-shot operation reads the supplied view from its first byte through its exact
 * length, does not retain it, and returns an independently mutable result.
 *
 * @returns A new 32-byte digest.
 *
 * @throws TypeError when the runtime input is not a `Uint8Array` view.
 */
export function sha256Bytes(value: Uint8Array): Uint8Array {
  if (!isUint8Array(value) || TYPED_ARRAY_LENGTH_GETTER === undefined) {
    throw new TypeError("SHA-256 input must be a Uint8Array");
  }

  const byteLength = Reflect.apply(TYPED_ARRAY_LENGTH_GETTER, value, []);
  const state = new Uint32Array(SHA256_INITIAL_STATE);
  const schedule = new Uint32Array(64);
  let offset = 0;
  while (offset + 64 <= byteLength) {
    compressSha256Block(value, offset, state, schedule);
    offset += 64;
  }

  const remainderLength = byteLength - offset;
  const finalBlock = new Uint8Array(remainderLength < 56 ? 64 : 128);
  for (let index = 0; index < remainderLength; index += 1) {
    finalBlock[index] = value[offset + index] ?? 0;
  }
  finalBlock[remainderLength] = 0x80;

  // A Uint8Array cannot approach the 2^64-bit SHA-256 message limit in ECMAScript. Splitting the
  // exactly representable byte length avoids BigInt while still writing the full 64-bit field.
  const bitLengthHigh = Math.floor(byteLength / 0x20000000);
  const bitLengthLow = (byteLength << 3) >>> 0;
  const lengthOffset = finalBlock.length - 8;
  finalBlock[lengthOffset] = bitLengthHigh >>> 24;
  finalBlock[lengthOffset + 1] = bitLengthHigh >>> 16;
  finalBlock[lengthOffset + 2] = bitLengthHigh >>> 8;
  finalBlock[lengthOffset + 3] = bitLengthHigh;
  finalBlock[lengthOffset + 4] = bitLengthLow >>> 24;
  finalBlock[lengthOffset + 5] = bitLengthLow >>> 16;
  finalBlock[lengthOffset + 6] = bitLengthLow >>> 8;
  finalBlock[lengthOffset + 7] = bitLengthLow;

  for (let finalOffset = 0; finalOffset < finalBlock.length; finalOffset += 64) {
    compressSha256Block(finalBlock, finalOffset, state, schedule);
  }

  const digest = new Uint8Array(32);
  for (let index = 0; index < state.length; index += 1) {
    const word = state[index] ?? 0;
    const digestOffset = index * 4;
    digest[digestOffset] = word >>> 24;
    digest[digestOffset + 1] = word >>> 16;
    digest[digestOffset + 2] = word >>> 8;
    digest[digestOffset + 3] = word;
  }
  return digest;
}

/**
 * Calculates a lowercase, 64-character hexadecimal SHA-256 digest without an algorithm prefix.
 *
 * @remarks This is a one-shot operation and does not change or retain the supplied bytes.
 *
 * @throws TypeError when the runtime input is not a `Uint8Array` view.
 */
export function sha256Hex(value: Uint8Array): string {
  return bytesToHex(sha256Bytes(value));
}

/**
 * Calculates a DESEN-formatted `sha256:<64 lowercase hex>` digest for exact bytes.
 *
 * @remarks This is a one-shot operation and does not change or retain the supplied bytes.
 *
 * @throws TypeError when the runtime input is not a `Uint8Array` view.
 */
export function sha256Digest(value: Uint8Array): string {
  return `sha256:${sha256Hex(value)}`;
}

/**
 * Calculates a DESEN-formatted SHA-256 digest over RFC 8785 canonical JSON bytes.
 *
 * @remarks This composes canonicalization and hashing as one side-effect-free operation. It does
 * not perform DESEN schema or semantic validation.
 *
 * @throws TypeError when the input cannot be represented as RFC 8785-compatible I-JSON.
 */
export function digestCanonicalJson(value: unknown): string {
  return sha256Digest(canonicalizeJsonBytes(value));
}

/**
 * Calculates the DESEN 0.1.0 source digest after omitting only the top-level `authoring` member.
 *
 * @remarks This function implements the digest projection only; it does not validate that the
 * object is a structurally or semantically valid DESEN Source document. It is a one-shot
 * operation and does not remove or otherwise mutate the caller's `authoring` value.
 *
 * @throws TypeError when the input root is not a plain JSON object or contains non-I-JSON data.
 */
export function calculateDesenSourceDigest(source: unknown): string {
  assertDocumentRoot(source, "a DESEN Source document");
  return sha256Digest(encodeUtf8(canonicalizeWithProjection(source, SOURCE_OMITTED_ROOT_KEYS)));
}

/**
 * Calculates the DESEN 0.1.0 bundle revision after omitting the top-level `revision` and
 * `publication` members.
 *
 * @remarks This function implements the revision projection only; it does not validate that the
 * object is a structurally or semantically valid DESEN Bundle document. It is a one-shot
 * operation and does not remove or otherwise mutate the caller's metadata.
 *
 * @throws TypeError when the input root is not a plain JSON object or contains non-I-JSON data.
 */
export function calculateDesenBundleRevision(bundle: unknown): string {
  assertDocumentRoot(bundle, "a DESEN Bundle document");
  return sha256Digest(encodeUtf8(canonicalizeWithProjection(bundle, BUNDLE_OMITTED_ROOT_KEYS)));
}

/**
 * Returns whether a value uses the exact DESEN lowercase `sha256:<64 hex>` digest format.
 *
 * @remarks This lexical guard has no lifecycle and does not verify that the digest matches any
 * bytes or document.
 */
export function isSha256Digest(value: unknown): value is string {
  return typeof value === "string" && SHA256_DIGEST_PATTERN.test(value);
}
