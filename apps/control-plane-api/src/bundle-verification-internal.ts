import { TextDecoder, types as utilTypes } from "node:util";

import {
  calculateDesenBundleRevision,
  calculateDesenSourceDigest,
  canonicalizeJsonBytes,
  createCoreDiagnostic,
  createJsonPointer,
  isSha256Digest,
} from "@desen/protocol";
import { validateDesenBundle, validateDesenSource } from "@desen/validator";

import {
  BUNDLE_INTEGRITY_LIMITS,
  SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE,
} from "./bundle-verification-contract.js";
import { guardBundleVerificationStructure } from "./bundle-verification-schema-guard.js";

import type {
  BundleIntegrityAuthority,
  BundleIntegrityDiagnostic,
  BundleIntegrityDiagnosticCode,
  BundleIntegrityVerificationResult,
  BundleIntegrityVerificationStage,
  BundleSourceMaterial,
} from "./bundle-verification-contract.js";
import type { BundleStoreEntry } from "./bundle-store-contract.js";
import type { DesenBundle, JsonPointer, JsonPointerSegment } from "@desen/protocol";
import type { ImmutableJson } from "@desen/validator";

interface JsonObject {
  readonly [key: string]: JsonValue;
}
type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;

interface StructuralValidationPorts {
  readonly validateBundle: typeof validateDesenBundle;
  readonly validateSource: typeof validateDesenSource;
}

interface ScanPath {
  readonly parent?: ScanPath;
  readonly segment?: JsonPointerSegment;
}

type ScanIssue =
  | Readonly<{ readonly kind: "duplicate" | "invalid"; readonly path: ScanPath }>
  | Readonly<{ readonly kind: "limit"; readonly path: ScanPath }>;

interface ScanState {
  readonly text: string;
  index: number;
  valueOccurrences: number;
  decodedStringCodeUnits: number;
}

interface ScannedString {
  readonly value: string;
  readonly issue?: ScanIssue;
}

type ByteCaptureResult =
  | Readonly<{ readonly status: "captured"; readonly bytes: Uint8Array }>
  | Readonly<{ readonly status: "invalid" }>
  | Readonly<{ readonly status: "limit" }>;

type DocumentParseResult =
  | Readonly<{ readonly status: "parsed"; readonly value: JsonValue }>
  | Readonly<{ readonly status: "rejected"; readonly issue: ScanIssue }>;

type EntryCaptureResult =
  | Readonly<{
      readonly status: "captured";
      readonly revision: unknown;
      readonly bytes: Uint8Array;
    }>
  | Readonly<{ readonly status: "invalid" }>
  | Readonly<{ readonly status: "limit" }>;

type SourceCaptureResult =
  | Readonly<{ readonly status: "not-available" }>
  | Readonly<{ readonly status: "available"; readonly bytes: Uint8Array }>
  | Readonly<{ readonly status: "invalid" }>
  | Readonly<{ readonly status: "limit" }>;

/** @internal Authenticated data retained for later M07 preflight stages. */
export interface BundleIntegrityAuthorityRecord {
  readonly bundle: ImmutableJson<DesenBundle>;
  readonly protocolVersion: "0.1.0";
  readonly revision: string;
  readonly sourceDigest: string;
  readonly sourceDigestVerification: "matched" | "not-available";
  readonly storedByteLength: number;
  readonly canonicalByteLength: number;
}

const ROOT_PATH = Object.freeze({}) as ScanPath;
const ROOT_POINTER = createJsonPointer();
const REVISION_POINTER = createJsonPointer(["revision"]);
const SOURCE_DIGEST_POINTER = createJsonPointer(["sourceDigest"]);
const PROTOCOL_POINTER = createJsonPointer(["desen"]);
const NUMBER_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)?.get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)?.get;
const AUTHORITIES = new WeakMap<BundleIntegrityAuthority, BundleIntegrityAuthorityRecord>();
const DEFAULT_STRUCTURAL_VALIDATION_PORTS: StructuralValidationPorts = Object.freeze({
  validateBundle: validateDesenBundle,
  validateSource: validateDesenSource,
});

function isWhitespace(character: string | undefined): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r";
}

function skipWhitespace(state: ScanState): void {
  while (isWhitespace(state.text[state.index])) state.index += 1;
}

function childPath(parent: ScanPath, segment: JsonPointerSegment): ScanPath {
  return { parent, segment };
}

function pointerForPath(path: ScanPath): JsonPointer {
  const segments: JsonPointerSegment[] = [];
  let current: ScanPath | undefined = path;
  while (current?.parent !== undefined) {
    segments.push(current.segment as JsonPointerSegment);
    current = current.parent;
  }
  segments.reverse();
  return createJsonPointer(segments);
}

function hasUnicodeScalarSequence(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (!(trailing >= 0xdc00 && trailing <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function scanString(state: ScanState, path: ScanPath): ScannedString {
  const start = state.index;
  state.index += 1;
  while (state.index < state.text.length) {
    const character = state.text[state.index];
    if (character === '"') {
      state.index += 1;
      let value: unknown;
      try {
        value = JSON.parse(state.text.slice(start, state.index)) as unknown;
      } catch {
        return { value: "", issue: { kind: "invalid", path } };
      }
      if (typeof value !== "string" || !hasUnicodeScalarSequence(value)) {
        return { value: "", issue: { kind: "invalid", path } };
      }
      state.decodedStringCodeUnits += value.length;
      if (state.decodedStringCodeUnits > BUNDLE_INTEGRITY_LIMITS.maxDecodedStringCodeUnits) {
        return { value: "", issue: { kind: "limit", path } };
      }
      return { value };
    }
    if (character === "\\") {
      state.index += 1;
      if (state.text[state.index] === "u") state.index += 4;
    }
    state.index += 1;
  }
  return { value: "", issue: { kind: "invalid", path } };
}

function scanNumber(state: ScanState, path: ScanPath): ScanIssue | undefined {
  const start = state.index;
  while (state.index < state.text.length) {
    const character = state.text[state.index];
    if (isWhitespace(character) || character === "," || character === "]" || character === "}") {
      break;
    }
    state.index += 1;
    if (state.index - start > BUNDLE_INTEGRITY_LIMITS.maxNumberTokenCodeUnits) {
      return { kind: "limit", path };
    }
  }
  const token = state.text.slice(start, state.index);
  return NUMBER_PATTERN.test(token) && Number.isFinite(Number(token))
    ? undefined
    : { kind: "invalid", path };
}

function scanLiteral(
  state: ScanState,
  literal: "false" | "null" | "true",
  path: ScanPath,
): ScanIssue | undefined {
  if (state.text.slice(state.index, state.index + literal.length) !== literal) {
    return { kind: "invalid", path };
  }
  state.index += literal.length;
  return undefined;
}

function scanArray(state: ScanState, path: ScanPath, depth: number): ScanIssue | undefined {
  if (depth > BUNDLE_INTEGRITY_LIMITS.maxJsonDepth) return { kind: "limit", path };
  state.index += 1;
  skipWhitespace(state);
  if (state.text[state.index] === "]") {
    state.index += 1;
    return undefined;
  }

  let itemIndex = 0;
  while (state.index < state.text.length) {
    const issue = scanValue(state, childPath(path, itemIndex), depth);
    if (issue !== undefined) return issue;
    itemIndex += 1;
    skipWhitespace(state);
    if (state.text[state.index] === "]") {
      state.index += 1;
      return undefined;
    }
    if (state.text[state.index] !== ",") return { kind: "invalid", path };
    state.index += 1;
    skipWhitespace(state);
  }
  return { kind: "invalid", path };
}

function scanObject(state: ScanState, path: ScanPath, depth: number): ScanIssue | undefined {
  if (depth > BUNDLE_INTEGRITY_LIMITS.maxJsonDepth) return { kind: "limit", path };
  state.index += 1;
  skipWhitespace(state);
  if (state.text[state.index] === "}") {
    state.index += 1;
    return undefined;
  }

  const keys = new Set<string>();
  while (state.index < state.text.length) {
    if (state.text[state.index] !== '"') return { kind: "invalid", path };
    const key = scanString(state, path);
    if (key.issue !== undefined) return key.issue;
    const memberPath = childPath(path, key.value);
    if (keys.has(key.value)) return { kind: "duplicate", path: memberPath };
    keys.add(key.value);
    skipWhitespace(state);
    if (state.text[state.index] !== ":") return { kind: "invalid", path };
    state.index += 1;
    skipWhitespace(state);
    const issue = scanValue(state, memberPath, depth);
    if (issue !== undefined) return issue;
    skipWhitespace(state);
    if (state.text[state.index] === "}") {
      state.index += 1;
      return undefined;
    }
    if (state.text[state.index] !== ",") return { kind: "invalid", path };
    state.index += 1;
    skipWhitespace(state);
  }
  return { kind: "invalid", path };
}

function scanValue(state: ScanState, path: ScanPath, parentDepth: number): ScanIssue | undefined {
  state.valueOccurrences += 1;
  if (state.valueOccurrences > BUNDLE_INTEGRITY_LIMITS.maxJsonValueOccurrences) {
    return { kind: "limit", path };
  }
  skipWhitespace(state);
  const character = state.text[state.index];
  if (character === "{") return scanObject(state, path, parentDepth + 1);
  if (character === "[") return scanArray(state, path, parentDepth + 1);
  if (character === '"') return scanString(state, path).issue;
  if (character === "t") return scanLiteral(state, "true", path);
  if (character === "f") return scanLiteral(state, "false", path);
  if (character === "n") return scanLiteral(state, "null", path);
  if (character === "-" || (character !== undefined && character >= "0" && character <= "9")) {
    return scanNumber(state, path);
  }
  return { kind: "invalid", path };
}

function scanJson(text: string): ScanIssue | undefined {
  const state: ScanState = {
    text,
    index: 0,
    valueOccurrences: 0,
    decodedStringCodeUnits: 0,
  };
  skipWhitespace(state);
  const issue = scanValue(state, ROOT_PATH, 0);
  if (issue !== undefined) return issue;
  skipWhitespace(state);
  return state.index === text.length ? undefined : { kind: "invalid", path: ROOT_PATH };
}

function deepFreezeJson(value: JsonValue): JsonValue {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreezeJson(item));
  } else {
    const object = value as JsonObject;
    Object.keys(object).forEach((key) => deepFreezeJson(object[key] as JsonValue));
  }
  return Object.freeze(value) as JsonValue;
}

function canonicalStringByteLength(value: string): number {
  let bytes = 2;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0x22 || codeUnit === 0x5c) {
      bytes += 2;
    } else if (
      codeUnit === 0x08 ||
      codeUnit === 0x09 ||
      codeUnit === 0x0a ||
      codeUnit === 0x0c ||
      codeUnit === 0x0d
    ) {
      bytes += 2;
    } else if (codeUnit <= 0x1f) {
      bytes += 6;
    } else if (codeUnit <= 0x7f) {
      bytes += 1;
    } else if (codeUnit <= 0x7ff) {
      bytes += 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/**
 * Measures canonical output before allocation so exponent expansion cannot bypass the 2 MiB
 * canonical byte-allocation ceiling. Structural validation already guarantees an inert acyclic
 * JSON graph.
 */
function canonicalJsonByteLengthWithin(value: JsonValue, maximum: number): number | undefined {
  let bytes = 0;
  const charge = (amount: number): boolean => {
    bytes += amount;
    return bytes <= maximum;
  };
  const visit = (current: JsonValue): boolean => {
    if (current === null) return charge(4);
    if (typeof current === "boolean") return charge(current ? 4 : 5);
    if (typeof current === "number") return charge(JSON.stringify(current).length);
    if (typeof current === "string") return charge(canonicalStringByteLength(current));
    if (Array.isArray(current)) {
      if (!charge(2 + Math.max(0, current.length - 1))) return false;
      return current.every((item) => visit(item));
    }
    const object = current as JsonObject;
    const keys = Object.keys(object);
    if (!charge(2 + Math.max(0, keys.length - 1))) return false;
    return keys.every(
      (key) => charge(canonicalStringByteLength(key) + 1) && visit(object[key] as JsonValue),
    );
  };
  return visit(value) ? bytes : undefined;
}

function hasLeadingBom(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function parseDocumentBytes(bytes: Uint8Array): DocumentParseResult {
  if (hasLeadingBom(bytes)) {
    return { status: "rejected", issue: { kind: "invalid", path: ROOT_PATH } };
  }
  let text: string;
  try {
    text = UTF8_DECODER.decode(bytes);
  } catch {
    return { status: "rejected", issue: { kind: "invalid", path: ROOT_PATH } };
  }
  const issue = scanJson(text);
  if (issue !== undefined) return { status: "rejected", issue };

  try {
    return {
      status: "parsed",
      value: deepFreezeJson(JSON.parse(text) as JsonValue),
    };
  } catch {
    return { status: "rejected", issue: { kind: "invalid", path: ROOT_PATH } };
  }
}

function exactDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  try {
    // Proxy brand detection precedes every reflective operation because even Array.isArray throws
    // for a revoked proxy; malformed caller authority must remain an entry-stage rejection.
    if (utilTypes.isProxy(value) || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key)) ||
      expectedKeys.some((key) => !keys.includes(key))
    ) {
      return undefined;
    }
    const captured: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      captured[key] = descriptor.value;
    }
    return Object.freeze(captured);
  } catch {
    return undefined;
  }
}

function captureBytes(value: unknown, maximum: number): ByteCaptureResult {
  try {
    if (
      utilTypes.isProxy(value) ||
      !utilTypes.isUint8Array(value) ||
      TYPED_ARRAY_BUFFER_GETTER === undefined ||
      TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined ||
      TYPED_ARRAY_BYTE_OFFSET_GETTER === undefined
    ) {
      return { status: "invalid" };
    }
    const buffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []) as unknown;
    const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []) as unknown;
    const byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []) as unknown;
    if (
      !utilTypes.isArrayBuffer(buffer) ||
      utilTypes.isSharedArrayBuffer(buffer) ||
      typeof byteLength !== "number" ||
      typeof byteOffset !== "number" ||
      !Number.isSafeInteger(byteLength) ||
      !Number.isSafeInteger(byteOffset) ||
      byteLength <= 0 ||
      byteOffset < 0
    ) {
      return { status: "invalid" };
    }
    if (byteLength > maximum) return { status: "limit" };
    const exactView = new Uint8Array(buffer as ArrayBuffer, byteOffset, byteLength);
    const snapshot = new Uint8Array(byteLength);
    Reflect.apply(Uint8Array.prototype.set, snapshot, [exactView]);
    return { status: "captured", bytes: snapshot };
  } catch {
    return { status: "invalid" };
  }
}

function captureEntry(value: unknown): EntryCaptureResult {
  const record = exactDataRecord(value, ["revision", "bytes"]);
  if (record === undefined) return { status: "invalid" };
  const bytes = captureBytes(record.bytes, BUNDLE_INTEGRITY_LIMITS.maxBundleUtf8Bytes);
  return bytes.status === "captured"
    ? { status: "captured", revision: record.revision, bytes: bytes.bytes }
    : bytes;
}

function captureSourceMaterial(value: unknown): SourceCaptureResult {
  const unavailable = exactDataRecord(value, ["status"]);
  if (unavailable?.status === "not-available") return { status: "not-available" };

  const available = exactDataRecord(value, ["status", "sourceBytes"]);
  if (available?.status !== "available") return { status: "invalid" };
  const bytes = captureBytes(available.sourceBytes, BUNDLE_INTEGRITY_LIMITS.maxSourceUtf8Bytes);
  return bytes.status === "captured" ? { status: "available", bytes: bytes.bytes } : bytes;
}

function diagnostic(
  code: Exclude<BundleIntegrityDiagnosticCode, typeof SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE>,
  message: string,
  pointer: JsonPointer,
): BundleIntegrityDiagnostic {
  return createCoreDiagnostic({ code, message, pointer });
}

function rejection(
  stage: BundleIntegrityVerificationStage,
  diagnostics: readonly BundleIntegrityDiagnostic[],
): BundleIntegrityVerificationResult {
  return Object.freeze({
    status: "rejected",
    stage,
    diagnostics: Object.freeze([...diagnostics]),
  });
}

function malformedInputRejection(
  stage: BundleIntegrityVerificationStage,
  pointer: JsonPointer = ROOT_POINTER,
): BundleIntegrityVerificationResult {
  return rejection(stage, [
    diagnostic("SCHEMA_INVALID", "Integrity input must be exact interoperable JSON data.", pointer),
  ]);
}

function structuralGuardRejection(
  stage: "bundle-schema" | "source-schema",
  failure: Readonly<{
    readonly code: "SCHEMA_INVALID" | "UNKNOWN_CORE_FIELD";
    readonly pointer: JsonPointer;
  }>,
): BundleIntegrityVerificationResult {
  return rejection(stage, [
    diagnostic(
      failure.code,
      failure.code === "UNKNOWN_CORE_FIELD"
        ? "A closed DESEN core object contains an unknown field."
        : "Integrity input violates the frozen DESEN 0.1.0 structural profile.",
      failure.pointer,
    ),
  ]);
}

function bundleLimitRejection(
  pointer: JsonPointer = ROOT_POINTER,
): BundleIntegrityVerificationResult {
  return rejection("bundle-size", [
    diagnostic(
      "BUNDLE_LIMIT_EXCEEDED",
      "Bundle integrity verification exceeded its finite ingress profile.",
      pointer,
    ),
  ]);
}

function sourceLimitRejection(
  stage: "source-json" | "source-material",
  pointer: JsonPointer = ROOT_POINTER,
): BundleIntegrityVerificationResult {
  return rejection(stage, [
    Object.freeze({
      code: SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE,
      message: "Available Source exceeded the finite integrity parsing profile.",
      pointer,
    }),
  ]);
}

function parseRejection(
  issue: ScanIssue,
  target: "bundle" | "source",
): BundleIntegrityVerificationResult {
  if (issue.kind === "limit") {
    return target === "bundle"
      ? bundleLimitRejection(pointerForPath(issue.path))
      : sourceLimitRejection("source-json", pointerForPath(issue.path));
  }
  return rejection(target === "bundle" ? "bundle-json" : "source-json", [
    diagnostic(
      "SCHEMA_INVALID",
      issue.kind === "duplicate"
        ? "JSON contains a duplicate decoded object member name."
        : "Integrity input is not interoperable JSON.",
      pointerForPath(issue.path),
    ),
  ]);
}

function unsupportedProtocolRejection(
  stage: "bundle-protocol" | "source-protocol",
): BundleIntegrityVerificationResult {
  return rejection(stage, [
    diagnostic(
      "UNSUPPORTED_PROTOCOL",
      "This control-plane verifier supports DESEN protocol version 0.1.0.",
      PROTOCOL_POINTER,
    ),
  ]);
}

function revisionRejection(): BundleIntegrityVerificationResult {
  return rejection("bundle-revision", [
    diagnostic(
      "REVISION_MISMATCH",
      "The stored key, embedded revision, and canonical Bundle revision must match.",
      REVISION_POINTER,
    ),
  ]);
}

function sourceDigestRejection(): BundleIntegrityVerificationResult {
  return rejection("source-digest", [
    diagnostic(
      "SOURCE_DIGEST_MISMATCH",
      "The available Source does not match the Bundle source digest.",
      SOURCE_DIGEST_POINTER,
    ),
  ]);
}

function hasUnsupportedProtocol(value: JsonValue): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const descriptor = Object.getOwnPropertyDescriptor(value, "desen");
  return descriptor !== undefined && "value" in descriptor && typeof descriptor.value === "string"
    ? descriptor.value !== "0.1.0"
    : false;
}

function createAuthority(
  record: BundleIntegrityAuthorityRecord,
): BundleIntegrityVerificationResult {
  const authority = Object.freeze({ ...record }) as BundleIntegrityAuthority;
  AUTHORITIES.set(authority, Object.freeze(record));
  return Object.freeze({ status: "verified", authority });
}

function verifyCapturedEntry(
  entry: Readonly<{ readonly revision: unknown; readonly bytes: Uint8Array }>,
  sourceMaterial: unknown,
  structuralValidation: StructuralValidationPorts,
): BundleIntegrityVerificationResult {
  const parsedBundle = parseDocumentBytes(entry.bytes);
  if (parsedBundle.status === "rejected") return parseRejection(parsedBundle.issue, "bundle");
  if (hasUnsupportedProtocol(parsedBundle.value)) {
    return unsupportedProtocolRejection("bundle-protocol");
  }

  // The structural validator creates an inert snapshot through canonical JSON. Bound that
  // allocation before entering the validator, then repeat the measurement on the accepted
  // snapshot below so this early resource guard never substitutes for schema authority.
  const parsedCanonicalByteLength = canonicalJsonByteLengthWithin(
    parsedBundle.value,
    BUNDLE_INTEGRITY_LIMITS.maxBundleCanonicalUtf8Bytes,
  );
  if (parsedCanonicalByteLength === undefined) {
    return bundleLimitRejection();
  }

  const bundleGuard = guardBundleVerificationStructure("bundle", parsedBundle.value);
  if (!bundleGuard.valid) return structuralGuardRejection("bundle-schema", bundleGuard);

  const validatedBundle = structuralValidation.validateBundle(parsedBundle.value);
  if (!validatedBundle.valid) throw new TypeError("Bundle structural guard drift.");

  const canonicalByteLength = canonicalJsonByteLengthWithin(
    validatedBundle.value as JsonValue,
    BUNDLE_INTEGRITY_LIMITS.maxBundleCanonicalUtf8Bytes,
  );
  if (canonicalByteLength === undefined) {
    return bundleLimitRejection();
  }
  if (canonicalByteLength !== parsedCanonicalByteLength) throw new TypeError("Snapshot drift.");
  const canonicalBytes = canonicalizeJsonBytes(validatedBundle.value);
  if (canonicalBytes.byteLength !== canonicalByteLength) throw new TypeError("Canonical drift.");
  const calculatedRevision = calculateDesenBundleRevision(validatedBundle.value);
  if (
    !isSha256Digest(entry.revision) ||
    entry.revision !== validatedBundle.value.revision ||
    entry.revision !== calculatedRevision
  ) {
    return revisionRejection();
  }

  const capturedSource = captureSourceMaterial(sourceMaterial);
  if (capturedSource.status === "invalid") return malformedInputRejection("source-material");
  if (capturedSource.status === "limit") return sourceLimitRejection("source-material");
  if (capturedSource.status === "not-available") {
    return createAuthority({
      bundle: validatedBundle.value,
      protocolVersion: "0.1.0",
      revision: calculatedRevision,
      sourceDigest: validatedBundle.value.sourceDigest,
      sourceDigestVerification: "not-available",
      storedByteLength: entry.bytes.byteLength,
      canonicalByteLength,
    });
  }

  const parsedSource = parseDocumentBytes(capturedSource.bytes);
  if (parsedSource.status === "rejected") return parseRejection(parsedSource.issue, "source");
  if (hasUnsupportedProtocol(parsedSource.value)) {
    return unsupportedProtocolRejection("source-protocol");
  }
  const parsedSourceCanonicalByteLength = canonicalJsonByteLengthWithin(
    parsedSource.value,
    BUNDLE_INTEGRITY_LIMITS.maxSourceCanonicalUtf8Bytes,
  );
  if (parsedSourceCanonicalByteLength === undefined) {
    return sourceLimitRejection("source-json");
  }

  const sourceGuard = guardBundleVerificationStructure("source", parsedSource.value);
  if (!sourceGuard.valid) return structuralGuardRejection("source-schema", sourceGuard);

  const validatedSource = structuralValidation.validateSource(parsedSource.value);
  if (!validatedSource.valid) throw new TypeError("Source structural guard drift.");
  const sourceCanonicalByteLength = canonicalJsonByteLengthWithin(
    validatedSource.value as JsonValue,
    BUNDLE_INTEGRITY_LIMITS.maxSourceCanonicalUtf8Bytes,
  );
  if (
    sourceCanonicalByteLength === undefined ||
    sourceCanonicalByteLength !== parsedSourceCanonicalByteLength
  ) {
    throw new TypeError("Source snapshot drift.");
  }
  const sourceCanonicalBytes = canonicalizeJsonBytes(validatedSource.value);
  if (sourceCanonicalBytes.byteLength !== sourceCanonicalByteLength) {
    throw new TypeError("Source canonical drift.");
  }
  const sourceDigest = calculateDesenSourceDigest(validatedSource.value);
  if (sourceDigest !== validatedBundle.value.sourceDigest) return sourceDigestRejection();

  return createAuthority({
    bundle: validatedBundle.value,
    protocolVersion: "0.1.0",
    revision: calculatedRevision,
    sourceDigest,
    sourceDigestVerification: "matched",
    storedByteLength: entry.bytes.byteLength,
    canonicalByteLength,
  });
}

/** @internal Authenticates an opaque success handle and reads its immutable Bundle record. */
export function readBundleIntegrityAuthority(
  authority: unknown,
): BundleIntegrityAuthorityRecord | undefined {
  return typeof authority === "object" && authority !== null
    ? AUTHORITIES.get(authority as BundleIntegrityAuthority)
    : undefined;
}

/** @internal Returns whether an unknown value is an exact live M07-T02 integrity authority. */
export function isBundleIntegrityAuthority(value: unknown): value is BundleIntegrityAuthority {
  return readBundleIntegrityAuthority(value) !== undefined;
}

/** @internal Package-private implementation behind the public synchronous verifier. */
export function verifyBundleStoreEntryInternal(
  entry: BundleStoreEntry,
  sourceMaterial: BundleSourceMaterial,
  structuralValidation: StructuralValidationPorts = DEFAULT_STRUCTURAL_VALIDATION_PORTS,
): BundleIntegrityVerificationResult {
  try {
    const capturedEntry = captureEntry(entry);
    if (capturedEntry.status === "invalid") return malformedInputRejection("entry-capture");
    if (capturedEntry.status === "limit") return bundleLimitRejection();
    return verifyCapturedEntry(capturedEntry, sourceMaterial, structuralValidation);
  } catch {
    return malformedInputRejection("internal");
  }
}
