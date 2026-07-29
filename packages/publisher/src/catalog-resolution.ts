import {
  canonicalizeJson,
  createCoreDiagnostic,
  createJsonPointer,
  parseJsonPointer,
} from "@desen/protocol";
import {
  isExactSemanticVersion,
  validateDesenCatalogSet,
  validateDesenStructure,
} from "@desen/validator";

import { annotatePublishErrorDiagnostic, createPublishFailure } from "./publish-diagnostics.js";

import type { DesenCatalog, DesenDiagnostic, JsonPointer } from "@desen/protocol";
import type {
  DesenSemanticDiagnostic,
  DesenValidatedCatalogSet,
  ImmutableJson,
} from "@desen/validator";
import type {
  PublishErrorDiagnostic,
  PublishFailure,
  PublishPipelineStage,
} from "./publish-result.js";

type CatalogSnapshot = ImmutableJson<DesenCatalog>;

/** Package-private diagnostic for a non-inert or inconsistent Catalog candidate. */
export const INVALID_CATALOG_INPUT_CODE = "run.desen.publisher/INVALID_CATALOG_INPUT" as const;

/** Package-private diagnostic for Catalog work that crosses the finite Publisher profile. */
export const CATALOG_LIMIT_EXCEEDED_CODE = "run.desen.publisher/CATALOG_LIMIT_EXCEEDED" as const;

/** Immutable task-owned metadata for M06-T02 Catalog diagnostics. */
export const PUBLISH_CATALOG_DIAGNOSTIC_REGISTRY = Object.freeze([
  Object.freeze({
    code: INVALID_CATALOG_INPUT_CODE,
    meaning: "Catalog package input is not inert interoperable data.",
    defaultStage: "catalog-resolution",
    defaultSeverity: "error",
  }),
  Object.freeze({
    code: CATALOG_LIMIT_EXCEEDED_CODE,
    meaning: "Catalog processing exceeded the finite Publisher profile.",
    defaultStage: "catalog-integrity",
    defaultSeverity: "error",
  }),
] as const);

const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const FUNCTION_TO_STRING = Function.prototype.toString;
const NATIVE_OBJECT_CONSTRUCTOR_SOURCE = Reflect.apply(FUNCTION_TO_STRING, Object, []);
const CATALOG_LIMIT_KEYS = Object.freeze([
  "maxRequirements",
  "maxCandidates",
  "maxCatalogCanonicalBytes",
  "maxAggregateCatalogCanonicalBytes",
  "maxCatalogDepth",
  "maxCatalogValueOccurrences",
  "maxCatalogStringCodeUnits",
  "maxCapabilityDeclarations",
  "maxDiagnostics",
  "maxIdentityStringCodeUnits",
] as const);
const CATALOG_LIMIT_KEY_SET: ReadonlySet<string> = new Set(CATALOG_LIMIT_KEYS);

/**
 * Finite, project-owned limits for the package-private Catalog resolution boundary.
 *
 * @remarks These ceilings are not universal DESEN 0.1.0 constants. They bound work before the
 * selected Catalog values enter the Validator. A later protocol profile may standardize different
 * values without changing exact tuple semantics.
 */
export interface PublishCatalogResolutionLimits {
  /** Maximum Source Catalog requirements considered in one publication. */
  readonly maxRequirements: number;
  /** Maximum package candidates admitted into one closed resolution inventory. */
  readonly maxCandidates: number;
  /** Maximum UTF-8 bytes in one selected canonical Catalog. */
  readonly maxCatalogCanonicalBytes: number;
  /** Maximum aggregate UTF-8 bytes across all selected canonical Catalogs. */
  readonly maxAggregateCatalogCanonicalBytes: number;
  /** Maximum container nesting in one selected Catalog. */
  readonly maxCatalogDepth: number;
  /** Maximum JSON value occurrences in one selected Catalog. */
  readonly maxCatalogValueOccurrences: number;
  /** Maximum aggregate decoded string code units in one selected Catalog. */
  readonly maxCatalogStringCodeUnits: number;
  /** Maximum capability declarations across the selected Catalog set. */
  readonly maxCapabilityDeclarations: number;
  /** Maximum diagnostics emitted by one Catalog stage. */
  readonly maxDiagnostics: number;
  /** Maximum code units in one Source or package identity field. */
  readonly maxIdentityStringCodeUnits: number;
}

/** Default finite Catalog resolution profile used by the local Publisher. */
export const PUBLISH_CATALOG_RESOLUTION_LIMITS: Readonly<PublishCatalogResolutionLimits> =
  Object.freeze({
    maxRequirements: 256,
    maxCandidates: 1_024,
    maxCatalogCanonicalBytes: 16 * 1_024 * 1_024,
    maxAggregateCatalogCanonicalBytes: 64 * 1_024 * 1_024,
    maxCatalogDepth: 128,
    maxCatalogValueOccurrences: 100_000,
    maxCatalogStringCodeUnits: 4 * 1_024 * 1_024,
    maxCapabilityDeclarations: 100_000,
    maxDiagnostics: 1_024,
    maxIdentityStringCodeUnits: 4_096,
  });

/**
 * One target-profile observation offered to exact Catalog resolution.
 *
 * @remarks `observedPackageDigest` must come from a target-specific package-byte verifier before
 * this data-only boundary is called. Equality with `catalog.packageDigest` proves tuple
 * consistency, not that an arbitrary caller actually hashed package bytes. Duplicate candidates
 * are rejected even when their Catalog JSON is byte-identical; Catalog equality cannot
 * authenticate package-artifact identity.
 */
export interface PublishCatalogPackageCandidate {
  /** Exact package identifier offered for one Source Catalog requirement. */
  readonly id: string;
  /** Exact semantic package version offered for the requirement. */
  readonly version: string;
  /** Exact target profile implemented by the offered package. */
  readonly target: string;
  /** SHA-256 digest observed from the target-specific package-byte verifier. */
  readonly observedPackageDigest: string;
  /** Inert Catalog JSON claimed by the offered package. */
  readonly catalog: unknown;
}

/** One exact immutable package tuple selected for the Source. */
export interface PublishResolvedCatalogPackage {
  readonly id: string;
  readonly version: string;
  readonly target: string;
  readonly packageDigest: string;
  readonly catalog: CatalogSnapshot;
}

/**
 * Successful package-private Catalog resolution.
 *
 * @remarks Catalog order follows first Source requirement order. Duplicate Source requirements
 * preserve their one-to-one position in `requirementPackageIndexes` while sharing one selected
 * package index.
 */
export interface PublishCatalogResolutionSuccess {
  readonly resolved: true;
  readonly catalogSet: DesenValidatedCatalogSet;
  readonly packages: readonly PublishResolvedCatalogPackage[];
  readonly requirementPackageIndexes: readonly number[];
  readonly diagnostics: readonly [];
}

/** Exact Catalog resolution either succeeds completely or returns the terminal no-Bundle shell. */
export type PublishCatalogResolutionResult = PublishCatalogResolutionSuccess | PublishFailure;

interface CapturedRequirement {
  readonly id: string;
  readonly version: string;
  readonly target?: string;
}

interface CapturedCandidate {
  readonly candidateIndex: number;
  readonly id: string;
  readonly version: string;
  readonly target: string;
  readonly observedPackageDigest: string;
  readonly catalog: unknown;
}

interface JsonBudget {
  values: number;
  strings: number;
}

class CatalogResolutionInputError extends Error {
  constructor(
    readonly reason: "invalid" | "limit",
    message: string,
  ) {
    super(message);
    this.name = "CatalogResolutionInputError";
  }
}

function inputFailure(reason: "invalid" | "limit", message: string): never {
  throw new CatalogResolutionInputError(reason, message);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function normalizeLimits(input: unknown): Readonly<PublishCatalogResolutionLimits> {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new TypeError();
    }
    if (!hasOrdinaryJsonObjectPrototype(input)) {
      throw new TypeError();
    }
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== CATALOG_LIMIT_KEYS.length ||
      keys.some((key) => typeof key !== "string" || !CATALOG_LIMIT_KEY_SET.has(key))
    ) {
      throw new TypeError();
    }

    const normalized: Record<string, number> = Object.create(null) as Record<string, number>;
    for (const key of CATALOG_LIMIT_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        !isPositiveSafeInteger(descriptor.value)
      ) {
        throw new TypeError();
      }
      normalized[key] = descriptor.value;
    }
    if (
      (normalized.maxCatalogCanonicalBytes as number) >
      (normalized.maxAggregateCatalogCanonicalBytes as number)
    ) {
      throw new TypeError(
        "One Catalog canonical-byte limit cannot exceed the aggregate Catalog byte limit.",
      );
    }
    return Object.freeze({
      maxRequirements: normalized.maxRequirements as number,
      maxCandidates: normalized.maxCandidates as number,
      maxCatalogCanonicalBytes: normalized.maxCatalogCanonicalBytes as number,
      maxAggregateCatalogCanonicalBytes: normalized.maxAggregateCatalogCanonicalBytes as number,
      maxCatalogDepth: normalized.maxCatalogDepth as number,
      maxCatalogValueOccurrences: normalized.maxCatalogValueOccurrences as number,
      maxCatalogStringCodeUnits: normalized.maxCatalogStringCodeUnits as number,
      maxCapabilityDeclarations: normalized.maxCapabilityDeclarations as number,
      maxDiagnostics: normalized.maxDiagnostics as number,
      maxIdentityStringCodeUnits: normalized.maxIdentityStringCodeUnits as number,
    });
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message ===
        "One Catalog canonical-byte limit cannot exceed the aggregate Catalog byte limit."
    ) {
      throw error;
    }
    // Deliberately omit `cause`: a hostile profile may throw with secret-bearing provider text.
    // eslint-disable-next-line preserve-caught-error
    throw new TypeError(
      "Catalog resolution limits must be an exact own-data positive-integer profile.",
    );
  }
}

function hasOrdinaryJsonObjectPrototype(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null) return true;
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor");
  return (
    Object.getPrototypeOf(prototype) === null &&
    constructor !== undefined &&
    "value" in constructor &&
    typeof constructor.value === "function" &&
    Reflect.apply(FUNCTION_TO_STRING, constructor.value, []) === NATIVE_OBJECT_CONSTRUCTOR_SOURCE
  );
}

function assertUnicodeScalarSequence(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (!(trailing >= 0xdc00 && trailing <= 0xdfff)) {
        inputFailure("invalid", "A Catalog resolution string contains invalid Unicode.");
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      inputFailure("invalid", "A Catalog resolution string contains invalid Unicode.");
    }
  }
}

function consumeCatalogStringBudget(
  value: string,
  limits: Readonly<PublishCatalogResolutionLimits>,
  budget: JsonBudget,
): void {
  const remainingCodeUnits = limits.maxCatalogStringCodeUnits - budget.strings;
  if (value.length > remainingCodeUnits) {
    inputFailure("limit", "A selected Catalog exceeded the decoded-string limit.");
  }
  budget.strings += value.length;
  assertUnicodeScalarSequence(value);
}

function boundedIdentityString(value: unknown, maximumCodeUnits: number): string {
  if (typeof value !== "string" || value.length === 0) {
    inputFailure("invalid", "A Catalog package identity field is invalid.");
  }
  if (value.length > maximumCodeUnits) {
    inputFailure("limit", "A Catalog package identity field exceeded the finite profile.");
  }
  assertUnicodeScalarSequence(value);
  return value;
}

function ownEnumerableDataRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
  requiredKeys: ReadonlySet<string>,
): ReadonlyMap<string, unknown> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      inputFailure("invalid", "A Catalog resolution record is invalid.");
    }
    if (!hasOrdinaryJsonObjectPrototype(value)) {
      inputFailure("invalid", "A Catalog resolution record has a non-data prototype.");
    }

    const keys = Reflect.ownKeys(value);
    const captured = new Map<string, unknown>();
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) {
        inputFailure("invalid", "A Catalog resolution record contains an unknown field.");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        inputFailure("invalid", "A Catalog resolution record contains an active field.");
      }
      captured.set(key, descriptor.value);
    }
    for (const key of requiredKeys) {
      if (!captured.has(key)) {
        inputFailure("invalid", "A Catalog resolution record is missing a required field.");
      }
    }
    return captured;
  } catch (error) {
    if (error instanceof CatalogResolutionInputError) throw error;
    inputFailure("invalid", "A Catalog resolution record could not be inspected safely.");
  }
}

function denseArrayElements(value: unknown, maximum: number): readonly unknown[] {
  try {
    if (!Array.isArray(value)) {
      inputFailure("invalid", "A Catalog resolution collection must be an ordinary dense array.");
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      typeof lengthDescriptor.value !== "number" ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      inputFailure("invalid", "A Catalog resolution collection has an invalid length.");
    }
    const length = lengthDescriptor.value;
    if (length > maximum) {
      inputFailure("limit", "A Catalog resolution collection exceeded its finite item limit.");
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== length + 1 ||
      keys.some((key) => typeof key === "symbol") ||
      !keys.includes("length")
    ) {
      inputFailure("invalid", "A Catalog resolution collection must be dense and undecorated.");
    }

    const elements: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        inputFailure("invalid", "A Catalog resolution collection contains an active item.");
      }
      elements.push(descriptor.value);
    }
    return elements;
  } catch (error) {
    if (error instanceof CatalogResolutionInputError) throw error;
    inputFailure("invalid", "A Catalog resolution collection could not be inspected safely.");
  }
}

function captureRequirements(
  input: unknown,
  limits: Readonly<PublishCatalogResolutionLimits>,
): readonly CapturedRequirement[] {
  const elements = denseArrayElements(input, limits.maxRequirements);
  return elements.map((element) => {
    const record = ownEnumerableDataRecord(
      element,
      new Set(["id", "version", "target", "location", "extensions"]),
      new Set(["id", "version"]),
    );
    const id = boundedIdentityString(record.get("id"), limits.maxIdentityStringCodeUnits);
    const version = boundedIdentityString(record.get("version"), limits.maxIdentityStringCodeUnits);
    if (!isExactSemanticVersion(version)) {
      inputFailure("invalid", "A Source Catalog requirement version is not exact SemVer.");
    }
    const hasTarget = record.has("target");
    const target = hasTarget
      ? boundedIdentityString(record.get("target"), limits.maxIdentityStringCodeUnits)
      : undefined;
    return Object.freeze({
      id,
      version,
      ...(target === undefined ? {} : { target }),
    });
  });
}

function captureCandidates(
  input: unknown,
  limits: Readonly<PublishCatalogResolutionLimits>,
): readonly CapturedCandidate[] {
  const elements = denseArrayElements(input, limits.maxCandidates);
  return elements.map((element, candidateIndex) => {
    const record = ownEnumerableDataRecord(
      element,
      new Set(["id", "version", "target", "observedPackageDigest", "catalog"]),
      new Set(["id", "version", "target", "observedPackageDigest", "catalog"]),
    );
    const version = boundedIdentityString(record.get("version"), limits.maxIdentityStringCodeUnits);
    const observedPackageDigest = boundedIdentityString(
      record.get("observedPackageDigest"),
      limits.maxIdentityStringCodeUnits,
    );
    if (!isExactSemanticVersion(version) || !SHA256_DIGEST_PATTERN.test(observedPackageDigest)) {
      inputFailure("invalid", "A Catalog package candidate envelope is invalid.");
    }
    return Object.freeze({
      candidateIndex,
      id: boundedIdentityString(record.get("id"), limits.maxIdentityStringCodeUnits),
      version,
      target: boundedIdentityString(record.get("target"), limits.maxIdentityStringCodeUnits),
      observedPackageDigest,
      catalog: record.get("catalog"),
    });
  });
}

function captureBoundedJson(
  value: unknown,
  limits: Readonly<PublishCatalogResolutionLimits>,
  budget: JsonBudget,
  depth: number,
  active: WeakSet<object>,
): unknown {
  budget.values += 1;
  if (budget.values > limits.maxCatalogValueOccurrences) {
    inputFailure("limit", "A selected Catalog exceeded the JSON value limit.");
  }
  if (depth > limits.maxCatalogDepth) {
    inputFailure("limit", "A selected Catalog exceeded the JSON depth limit.");
  }

  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      inputFailure("invalid", "A selected Catalog contains a non-finite number.");
    }
    return value;
  }
  if (typeof value === "string") {
    consumeCatalogStringBudget(value, limits, budget);
    return value;
  }
  if (typeof value !== "object") {
    inputFailure("invalid", "A selected Catalog contains a non-JSON value.");
  }
  if (active.has(value)) {
    inputFailure("invalid", "A selected Catalog contains a cycle.");
  }
  active.add(value);

  try {
    const keys = Reflect.ownKeys(value);
    if (Array.isArray(value)) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        typeof lengthDescriptor.value !== "number" ||
        keys.length !== lengthDescriptor.value + 1 ||
        keys.some((key) => typeof key === "symbol") ||
        !keys.includes("length")
      ) {
        inputFailure("invalid", "A selected Catalog contains a sparse or decorated array.");
      }
      const captured: unknown[] = [];
      for (let index = 0; index < lengthDescriptor.value; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          inputFailure("invalid", "A selected Catalog contains an active array item.");
        }
        captured.push(captureBoundedJson(descriptor.value, limits, budget, depth + 1, active));
      }
      return captured;
    }

    if (!hasOrdinaryJsonObjectPrototype(value)) {
      inputFailure("invalid", "A selected Catalog contains a non-JSON object prototype.");
    }
    const captured: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string") {
        inputFailure("invalid", "A selected Catalog contains a symbol field.");
      }
      consumeCatalogStringBudget(key, limits, budget);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        inputFailure("invalid", "A selected Catalog contains an active object field.");
      }
      Object.defineProperty(captured, key, {
        value: captureBoundedJson(descriptor.value, limits, budget, depth + 1, active),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return captured;
  } catch (error) {
    if (error instanceof CatalogResolutionInputError) throw error;
    inputFailure("invalid", "A selected Catalog could not be inspected safely.");
  } finally {
    active.delete(value);
  }
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x7f) {
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

function deepFreezeJson(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreezeJson(item));
  } else {
    Object.keys(value).forEach((key) => deepFreezeJson((value as Record<string, unknown>)[key]));
  }
  return Object.freeze(value);
}

function captureCatalog(
  value: unknown,
  limits: Readonly<PublishCatalogResolutionLimits>,
): Readonly<{ snapshot: unknown; canonicalBytes: number }> {
  const captured = captureBoundedJson(value, limits, { values: 0, strings: 0 }, 0, new WeakSet());
  let canonical: string;
  try {
    canonical = canonicalizeJson(captured);
  } catch {
    inputFailure("invalid", "A selected Catalog is not inert RFC 8785-compatible JSON.");
  }
  const canonicalBytes = utf8ByteLength(canonical);
  if (canonicalBytes > limits.maxCatalogCanonicalBytes) {
    inputFailure("limit", "A selected Catalog exceeded its canonical-byte limit.");
  }
  return Object.freeze({
    snapshot: deepFreezeJson(JSON.parse(canonical) as unknown),
    canonicalBytes,
  });
}

function requirementPointer(index?: number): JsonPointer {
  return index === undefined
    ? createJsonPointer(["catalogs"])
    : createJsonPointer(["catalogs", index]);
}

function diagnosticContext(documentId: string | undefined, capabilityId?: string) {
  if (documentId === undefined && capabilityId === undefined) return undefined;
  return Object.freeze({
    ...(documentId === undefined ? {} : { documentId }),
    ...(capabilityId === undefined ? {} : { capabilityId }),
  });
}

function coreFailure(
  stage: PublishPipelineStage,
  code: "CATALOG_DIGEST_MISMATCH" | "CATALOG_VERSION_UNAVAILABLE",
  message: string,
  pointer: JsonPointer,
  documentId?: string,
): PublishFailure {
  const context = diagnosticContext(documentId);
  return createPublishFailure([
    annotatePublishErrorDiagnostic(
      createCoreDiagnostic({
        code,
        message,
        pointer,
        ...(context === undefined ? {} : { context }),
      }),
      stage,
    ),
  ]);
}

function publisherCatalogFailure(
  stage: PublishPipelineStage,
  code: typeof CATALOG_LIMIT_EXCEEDED_CODE | typeof INVALID_CATALOG_INPUT_CODE,
  message: string,
  pointer: JsonPointer,
  documentId?: string,
): PublishFailure {
  const context = diagnosticContext(documentId);
  const diagnostic = Object.freeze({
    code,
    message,
    pointer,
    ...(context === undefined ? {} : { context }),
  }) satisfies Readonly<
    DesenDiagnostic<typeof CATALOG_LIMIT_EXCEEDED_CODE | typeof INVALID_CATALOG_INPUT_CODE>
  >;
  return createPublishFailure([annotatePublishErrorDiagnostic(diagnostic, stage)]);
}

function resolutionInputFailure(
  error: CatalogResolutionInputError,
  documentId?: string,
): PublishFailure {
  return publisherCatalogFailure(
    "catalog-resolution",
    error.reason === "limit" ? CATALOG_LIMIT_EXCEEDED_CODE : INVALID_CATALOG_INPUT_CODE,
    error.reason === "limit"
      ? "Catalog resolution exceeded the finite Publisher profile."
      : "Catalog package candidates could not be resolved safely.",
    requirementPointer(),
    documentId,
  );
}

function tupleKey(...parts: readonly string[]): string {
  return JSON.stringify(parts);
}

function capturedCapabilityCount(value: unknown): number {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return 0;
  const catalog = value as Record<string, unknown>;
  let count = 0;
  for (const field of ["components", "behaviors", "operations", "resources"] as const) {
    const capabilities = catalog[field];
    if (typeof capabilities === "object" && capabilities !== null && !Array.isArray(capabilities)) {
      count += Object.keys(capabilities).length;
    }
  }
  return count;
}

function firstRequirementIndexForCatalog(
  firstRequirementIndexes: readonly number[],
  catalogIndex: number,
): number | undefined {
  return firstRequirementIndexes[catalogIndex];
}

function catalogIndexFromDiagnostic(diagnostic: DesenSemanticDiagnostic): number | undefined {
  if (diagnostic.pointer === undefined) return undefined;
  try {
    const [first] = parseJsonPointer(diagnostic.pointer);
    if (first === undefined || !/^(?:0|[1-9][0-9]*)$/u.test(first)) return undefined;
    const index = Number(first);
    return Number.isSafeInteger(index) ? index : undefined;
  } catch {
    return undefined;
  }
}

function remapSemanticDiagnostic(
  diagnostic: DesenSemanticDiagnostic,
  pointer: JsonPointer,
  documentId?: string,
): DesenSemanticDiagnostic {
  const inherited = diagnostic.context;
  const context =
    inherited === undefined && documentId === undefined
      ? undefined
      : Object.freeze({
          ...(inherited ?? {}),
          ...(documentId === undefined ? {} : { documentId }),
        });
  return Object.freeze({
    ...diagnostic,
    pointer,
    ...(context === undefined ? {} : { context }),
  }) as DesenSemanticDiagnostic;
}

function namespaceFailure(
  diagnostics: readonly DesenSemanticDiagnostic[],
  firstRequirementIndexes: readonly number[],
  maxDiagnostics: number,
  documentId?: string,
): PublishFailure {
  if (diagnostics.length > maxDiagnostics) {
    return publisherCatalogFailure(
      "namespace-conflicts",
      CATALOG_LIMIT_EXCEEDED_CODE,
      "Catalog namespace diagnostics exceeded the finite Publisher profile.",
      requirementPointer(),
      documentId,
    );
  }
  const mapped = diagnostics.map((diagnostic) => {
    const catalogIndex = catalogIndexFromDiagnostic(diagnostic);
    const requirementIndex =
      catalogIndex === undefined
        ? undefined
        : firstRequirementIndexForCatalog(firstRequirementIndexes, catalogIndex);
    const context = diagnosticContext(documentId, diagnostic.context?.capabilityId);
    return annotatePublishErrorDiagnostic(
      createCoreDiagnostic({
        code: "AMBIGUOUS_CAPABILITY",
        message: "A capability identifier is declared more than once in the resolved Catalog set.",
        pointer: requirementPointer(requirementIndex),
        ...(context === undefined ? {} : { context }),
      }),
      "namespace-conflicts",
    );
  });
  return createPublishFailure(mapped);
}

/**
 * Resolves exact package candidates for already validated Source requirements.
 *
 * @internal This helper is deliberately absent from the package root. It performs no I/O and never
 * trusts `location`. Matching uses exact code-unit equality only: no trimming, case folding,
 * Unicode normalization, range selection, newest-version policy, or candidate-order fallback.
 * Failure returns the terminal no-Bundle shell and never exposes a partial Catalog authority.
 */
export function resolvePublishCatalogs(
  requirementsInput: unknown,
  candidatesInput: unknown,
  documentId?: string,
  limitInput: Readonly<PublishCatalogResolutionLimits> = PUBLISH_CATALOG_RESOLUTION_LIMITS,
): PublishCatalogResolutionResult {
  const limits = normalizeLimits(limitInput);

  let safeDocumentId: string | undefined;
  try {
    safeDocumentId =
      documentId === undefined
        ? undefined
        : boundedIdentityString(documentId, limits.maxIdentityStringCodeUnits);
  } catch (error) {
    if (error instanceof CatalogResolutionInputError) {
      return resolutionInputFailure(error);
    }
    throw error;
  }

  let requirements: readonly CapturedRequirement[];
  let candidates: readonly CapturedCandidate[];
  try {
    requirements = captureRequirements(requirementsInput, limits);
    candidates = captureCandidates(candidatesInput, limits);
  } catch (error) {
    if (error instanceof CatalogResolutionInputError) {
      return resolutionInputFailure(error, safeDocumentId);
    }
    throw error;
  }

  const byIdVersion = new Map<string, CapturedCandidate[]>();
  const byExactTarget = new Map<string, CapturedCandidate[]>();
  for (const candidate of candidates) {
    const idVersionKey = tupleKey(candidate.id, candidate.version);
    const exactTargetKey = tupleKey(candidate.id, candidate.version, candidate.target);
    const idVersionMatches = byIdVersion.get(idVersionKey) ?? [];
    idVersionMatches.push(candidate);
    byIdVersion.set(idVersionKey, idVersionMatches);
    const exactTargetMatches = byExactTarget.get(exactTargetKey) ?? [];
    exactTargetMatches.push(candidate);
    byExactTarget.set(exactTargetKey, exactTargetMatches);
  }

  const selectedByRequirement: CapturedCandidate[] = [];
  const resolutionDiagnostics: PublishErrorDiagnostic[] = [];
  for (let requirementIndex = 0; requirementIndex < requirements.length; requirementIndex += 1) {
    const requirement = requirements[requirementIndex] as CapturedRequirement;
    const matches =
      requirement.target === undefined
        ? (byIdVersion.get(tupleKey(requirement.id, requirement.version)) ?? [])
        : (byExactTarget.get(tupleKey(requirement.id, requirement.version, requirement.target)) ??
          []);
    if (matches.length !== 1) {
      if (resolutionDiagnostics.length >= limits.maxDiagnostics) {
        return publisherCatalogFailure(
          "catalog-resolution",
          CATALOG_LIMIT_EXCEEDED_CODE,
          "Catalog resolution diagnostics exceeded the finite Publisher profile.",
          requirementPointer(),
          safeDocumentId,
        );
      }
      const context = diagnosticContext(safeDocumentId);
      resolutionDiagnostics.push(
        annotatePublishErrorDiagnostic(
          createCoreDiagnostic({
            code: "CATALOG_VERSION_UNAVAILABLE",
            message:
              matches.length === 0
                ? "No exact Catalog package candidate matches the Source requirement."
                : "The Source requirement matches more than one Catalog package candidate.",
            pointer: requirementPointer(requirementIndex),
            ...(context === undefined ? {} : { context }),
          }),
          "catalog-resolution",
        ),
      );
      continue;
    }
    selectedByRequirement.push(matches[0] as CapturedCandidate);
  }
  if (resolutionDiagnostics.length > 0) {
    return createPublishFailure(resolutionDiagnostics);
  }

  const uniqueCandidates: CapturedCandidate[] = [];
  const packageIndexByCandidateIndex = new Map<number, number>();
  const firstRequirementIndexes: number[] = [];
  const requirementPackageIndexes = selectedByRequirement.map((candidate, requirementIndex) => {
    const existing = packageIndexByCandidateIndex.get(candidate.candidateIndex);
    if (existing !== undefined) return existing;
    const packageIndex = uniqueCandidates.length;
    uniqueCandidates.push(candidate);
    packageIndexByCandidateIndex.set(candidate.candidateIndex, packageIndex);
    firstRequirementIndexes.push(requirementIndex);
    return packageIndex;
  });

  const structuralCatalogs: CatalogSnapshot[] = [];
  let aggregateCanonicalBytes = 0;
  let aggregateCapabilityDeclarations = 0;
  for (let packageIndex = 0; packageIndex < uniqueCandidates.length; packageIndex += 1) {
    const candidate = uniqueCandidates[packageIndex] as CapturedCandidate;
    const requirementIndex = firstRequirementIndexForCatalog(firstRequirementIndexes, packageIndex);
    let captured: Readonly<{ snapshot: unknown; canonicalBytes: number }>;
    try {
      captured = captureCatalog(candidate.catalog, limits);
    } catch (error) {
      if (error instanceof CatalogResolutionInputError) {
        return publisherCatalogFailure(
          "catalog-integrity",
          error.reason === "limit" ? CATALOG_LIMIT_EXCEEDED_CODE : INVALID_CATALOG_INPUT_CODE,
          error.reason === "limit"
            ? "A selected Catalog exceeded the finite Publisher integrity profile."
            : "A selected Catalog is not inert interoperable JSON.",
          requirementPointer(requirementIndex),
          safeDocumentId,
        );
      }
      throw error;
    }
    aggregateCanonicalBytes += captured.canonicalBytes;
    if (aggregateCanonicalBytes > limits.maxAggregateCatalogCanonicalBytes) {
      return publisherCatalogFailure(
        "catalog-integrity",
        CATALOG_LIMIT_EXCEEDED_CODE,
        "The selected Catalog set exceeded the aggregate Publisher integrity profile.",
        requirementPointer(requirementIndex),
        safeDocumentId,
      );
    }
    aggregateCapabilityDeclarations += capturedCapabilityCount(captured.snapshot);
    if (aggregateCapabilityDeclarations > limits.maxCapabilityDeclarations) {
      return publisherCatalogFailure(
        "catalog-integrity",
        CATALOG_LIMIT_EXCEEDED_CODE,
        "The selected Catalog set exceeded the capability declaration limit.",
        requirementPointer(requirementIndex),
        safeDocumentId,
      );
    }

    const structural = validateDesenStructure("catalog", captured.snapshot);
    if (!structural.valid) {
      if (structural.diagnostics.length > limits.maxDiagnostics) {
        return publisherCatalogFailure(
          "catalog-integrity",
          CATALOG_LIMIT_EXCEEDED_CODE,
          "Catalog integrity diagnostics exceeded the finite Publisher profile.",
          requirementPointer(requirementIndex),
          safeDocumentId,
        );
      }
      const firstByCode = [
        ...new Map(
          structural.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic] as const),
        ).values(),
      ];
      const mapped = firstByCode.map((diagnostic) => {
        const context = diagnosticContext(safeDocumentId);
        return annotatePublishErrorDiagnostic(
          createCoreDiagnostic({
            code: diagnostic.code,
            message: diagnostic.message,
            pointer: requirementPointer(requirementIndex),
            ...(context === undefined ? {} : { context }),
          }),
          "catalog-integrity",
        );
      });
      return createPublishFailure(mapped);
    }

    const catalog = structural.value;
    if (
      !isExactSemanticVersion(candidate.version) ||
      !isExactSemanticVersion(catalog.version) ||
      candidate.id !== catalog.id ||
      candidate.version !== catalog.version ||
      candidate.target !== catalog.target
    ) {
      return publisherCatalogFailure(
        "catalog-integrity",
        INVALID_CATALOG_INPUT_CODE,
        "The selected Catalog identity does not match its exact package candidate.",
        requirementPointer(requirementIndex),
        safeDocumentId,
      );
    }
    if (
      !SHA256_DIGEST_PATTERN.test(candidate.observedPackageDigest) ||
      candidate.observedPackageDigest !== catalog.packageDigest
    ) {
      return coreFailure(
        "catalog-integrity",
        "CATALOG_DIGEST_MISMATCH",
        "The selected Catalog digest does not match the observed package digest.",
        requirementPointer(requirementIndex),
        safeDocumentId,
      );
    }
    structuralCatalogs.push(catalog);
  }

  const catalogSetResult = validateDesenCatalogSet(structuralCatalogs);
  if (!catalogSetResult.valid) {
    const namespaceDiagnostics = catalogSetResult.diagnostics.filter(
      (diagnostic) => diagnostic.code === "AMBIGUOUS_CAPABILITY",
    );
    if (namespaceDiagnostics.length !== catalogSetResult.diagnostics.length) {
      if (catalogSetResult.diagnostics.length > limits.maxDiagnostics) {
        return publisherCatalogFailure(
          "catalog-integrity",
          CATALOG_LIMIT_EXCEEDED_CODE,
          "Catalog integrity diagnostics exceeded the finite Publisher profile.",
          requirementPointer(),
          safeDocumentId,
        );
      }
      const mapped = catalogSetResult.diagnostics.map((diagnostic) => {
        const catalogIndex = catalogIndexFromDiagnostic(diagnostic);
        const requirementIndex =
          catalogIndex === undefined
            ? undefined
            : firstRequirementIndexForCatalog(firstRequirementIndexes, catalogIndex);
        return annotatePublishErrorDiagnostic(
          remapSemanticDiagnostic(diagnostic, requirementPointer(requirementIndex), safeDocumentId),
          "catalog-integrity",
        );
      });
      return createPublishFailure(mapped);
    }
    return namespaceFailure(
      namespaceDiagnostics,
      firstRequirementIndexes,
      limits.maxDiagnostics,
      safeDocumentId,
    );
  }

  const packages = uniqueCandidates.map((candidate, packageIndex) =>
    Object.freeze({
      id: candidate.id,
      version: candidate.version,
      target: candidate.target,
      packageDigest: candidate.observedPackageDigest,
      catalog: catalogSetResult.value[packageIndex] as CatalogSnapshot,
    }),
  );

  return Object.freeze({
    resolved: true,
    catalogSet: catalogSetResult.value,
    packages: Object.freeze(packages),
    requirementPackageIndexes: Object.freeze([...requirementPackageIndexes]),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
