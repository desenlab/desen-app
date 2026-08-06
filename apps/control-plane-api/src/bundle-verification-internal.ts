import { types as utilTypes } from "node:util";

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
import {
  canonicalJsonByteLengthWithin,
  parseStrictJsonBytes,
  strictJsonPathSegments,
} from "./strict-json-internal.js";

import type {
  BundleIntegrityAuthority,
  BundleIntegrityDiagnostic,
  BundleIntegrityDiagnosticCode,
  BundleIntegrityVerificationResult,
  BundleIntegrityVerificationStage,
  BundleSourceMaterial,
} from "./bundle-verification-contract.js";
import type { BundleStoreEntry } from "./bundle-store-contract.js";
import type { StrictJsonIssue, StrictJsonLimits, StrictJsonValue } from "./strict-json-internal.js";
import type { DesenBundle, JsonPointer } from "@desen/protocol";
import type { ImmutableJson } from "@desen/validator";

interface StructuralValidationPorts {
  readonly validateBundle: typeof validateDesenBundle;
  readonly validateSource: typeof validateDesenSource;
}

type ByteCaptureResult =
  | Readonly<{ readonly status: "captured"; readonly bytes: Uint8Array }>
  | Readonly<{ readonly status: "invalid" }>
  | Readonly<{ readonly status: "limit" }>;

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

const ROOT_POINTER = createJsonPointer();
const REVISION_POINTER = createJsonPointer(["revision"]);
const SOURCE_DIGEST_POINTER = createJsonPointer(["sourceDigest"]);
const PROTOCOL_POINTER = createJsonPointer(["desen"]);
const BUNDLE_STRICT_JSON_LIMITS: StrictJsonLimits = Object.freeze({
  maxDecodedStringCodeUnits: BUNDLE_INTEGRITY_LIMITS.maxDecodedStringCodeUnits,
  maxDepth: BUNDLE_INTEGRITY_LIMITS.maxJsonDepth,
  maxNumberTokenCodeUnits: BUNDLE_INTEGRITY_LIMITS.maxNumberTokenCodeUnits,
  maxValueOccurrences: BUNDLE_INTEGRITY_LIMITS.maxJsonValueOccurrences,
});
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

function pointerForPath(path: StrictJsonIssue["path"]): JsonPointer {
  return createJsonPointer(strictJsonPathSegments(path));
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
  issue: StrictJsonIssue,
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

function hasUnsupportedProtocol(value: StrictJsonValue): boolean {
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
  const parsedBundle = parseStrictJsonBytes(entry.bytes, BUNDLE_STRICT_JSON_LIMITS);
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
    validatedBundle.value as StrictJsonValue,
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

  const parsedSource = parseStrictJsonBytes(capturedSource.bytes, BUNDLE_STRICT_JSON_LIMITS);
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
    validatedSource.value as StrictJsonValue,
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
