import { types as utilTypes } from "node:util";

import { canonicalizeJsonBytes, createCoreDiagnostic, createJsonPointer } from "@desen/protocol";
import {
  isExactSemanticVersion,
  validateDesenCatalogSet,
  validateDesenStructure,
} from "@desen/validator";

import { readBundleIntegrityAuthority } from "./bundle-verification-internal.js";
import {
  BUNDLE_PACKAGE_PREFLIGHT_LIMITS,
  INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE,
  INVALID_INSTALLED_PACKAGE_CODE,
  PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE,
  PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
} from "./package-preflight-contract.js";
import { calculateWebReactPackageDigest } from "./package-preflight-web-react.js";
import { guardPackagePreflightCatalogStructure } from "./package-preflight-schema-guard.js";

import type { BundleIntegrityAuthority } from "./bundle-verification-contract.js";
import type { BundleIntegrityAuthorityRecord } from "./bundle-verification-internal.js";
import type {
  BundlePackagePreflightAuthority,
  BundlePackagePreflightDiagnostic,
  BundlePackagePreflightResult,
  BundlePackagePreflightStage,
  InstalledPackageCandidate,
  VerifiedInstalledPackage,
} from "./package-preflight-contract.js";
import type { CapturedWebReactPackageArtifact } from "./package-preflight-web-react.js";
import type { DesenBundle, DesenCatalog, JsonPointer } from "@desen/protocol";
import type { DesenValidatedCatalogSet, ImmutableJson } from "@desen/validator";

interface JsonObject {
  readonly [key: string]: JsonValue;
}
type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;
type BundleRequirement = ImmutableJson<DesenBundle>["requires"]["catalogs"][number];

interface CapturedRequirement {
  readonly index: number;
  readonly id: string;
  readonly version: string;
  readonly target: string;
  readonly digest: string;
}

interface CapturedCandidate {
  readonly index: number;
  readonly id: string;
  readonly version: string;
  readonly target: string;
  readonly catalog: unknown;
  readonly artifacts: unknown;
}

interface CapturedCatalog {
  readonly value: JsonValue;
  readonly canonicalByteLength: number;
}

interface JsonCaptureBudget {
  values: number;
  strings: number;
}

interface PackagePreflightPorts {
  readonly validateStructure: typeof validateDesenStructure;
  readonly validateCatalogSet: typeof validateDesenCatalogSet;
  readonly calculateWebReactDigest: typeof calculateWebReactPackageDigest;
}

/** @internal Complete private authority retained for M07-T04 and later staging work. */
export interface BundlePackagePreflightAuthorityRecord {
  readonly integrityAuthority: BundleIntegrityAuthority;
  readonly integrityRecord: BundleIntegrityAuthorityRecord;
  readonly catalogSet: DesenValidatedCatalogSet;
  readonly packages: readonly Readonly<{
    readonly metadata: VerifiedInstalledPackage;
    readonly catalog: ImmutableJson<DesenCatalog>;
    readonly artifacts: readonly CapturedWebReactPackageArtifact[];
  }>[];
  readonly requirementPackageIndexes: readonly number[];
}

class PackageInputFailure extends Error {
  constructor(readonly reason: "invalid" | "limit") {
    super("Installed-package input rejected.");
    this.name = "PackageInputFailure";
  }
}

const ROOT_POINTER = createJsonPointer();
const PROFILE_MAGIC_BYTE_LENGTH = "DESEN-WEB-REACT-PACKAGE-DIGEST-V1\n".length;
const CATALOG_PATH_BYTE_LENGTH = "catalog.json".length;
const CATALOG_PATH = "catalog.json";
const PATH_SEGMENT_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/u;
const WINDOWS_DEVICE_SEGMENT_PATTERN = /^(?:aux|com[1-9]|con|lpt[1-9]|nul|prn)(?:\.|$)/u;
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
const AUTHORITIES = new WeakMap<
  BundlePackagePreflightAuthority,
  BundlePackagePreflightAuthorityRecord
>();
const DEFAULT_PORTS: PackagePreflightPorts = Object.freeze({
  validateStructure: validateDesenStructure,
  validateCatalogSet: validateDesenCatalogSet,
  calculateWebReactDigest: calculateWebReactPackageDigest,
});
const CAPABILITY_GROUPS = Object.freeze([
  "components",
  "behaviors",
  "operations",
  "resources",
] as const);

function requirementPointer(index?: number, leaf?: "digest" | "version"): JsonPointer {
  return createJsonPointer([
    "requires",
    "catalogs",
    ...(index === undefined ? [] : [index]),
    ...(leaf === undefined ? [] : [leaf]),
  ]);
}

function extensionDiagnostic(
  code:
    | typeof INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE
    | typeof INVALID_INSTALLED_PACKAGE_CODE
    | typeof PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE
    | typeof PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE
    | "run.desen.validator/INVALID_SEMVER",
  message: string,
  pointer: JsonPointer,
): BundlePackagePreflightDiagnostic {
  return Object.freeze({ code, message, pointer });
}

function rejection(
  stage: BundlePackagePreflightStage,
  diagnostics: readonly BundlePackagePreflightDiagnostic[],
): BundlePackagePreflightResult {
  return Object.freeze({
    status: "rejected",
    stage,
    diagnostics: Object.freeze([...diagnostics]),
  });
}

function invalidInputRejection(
  stage: BundlePackagePreflightStage,
  pointer: JsonPointer = ROOT_POINTER,
): BundlePackagePreflightResult {
  return rejection(stage, [
    extensionDiagnostic(
      INVALID_INSTALLED_PACKAGE_CODE,
      "Installed package material is not exact safe inert data.",
      pointer,
    ),
  ]);
}

function limitRejection(
  stage: BundlePackagePreflightStage,
  pointer: JsonPointer = ROOT_POINTER,
): BundlePackagePreflightResult {
  return rejection(stage, [
    extensionDiagnostic(
      PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
      "Installed-package preflight exceeded its fixed finite profile.",
      pointer,
    ),
  ]);
}

function exactDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  try {
    if (utilTypes.isProxy(value) || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const captured: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    const seen = new Set<string>();
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      if (seen.size >= expectedKeys.length || !expectedKeys.includes(key)) return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      seen.add(key);
      captured[key] = descriptor.value;
    }
    if (expectedKeys.some((key) => !seen.has(key))) return undefined;
    return Object.freeze(captured);
  } catch {
    return undefined;
  }
}

function denseArrayElements(value: unknown, maximum: number): readonly unknown[] {
  try {
    if (utilTypes.isProxy(value) || !Array.isArray(value)) throw new PackageInputFailure("invalid");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Array.prototype && prototype !== null) {
      throw new PackageInputFailure("invalid");
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      (lengthDescriptor.value as number) < 0
    ) {
      throw new PackageInputFailure("invalid");
    }
    const length = lengthDescriptor.value as number;
    if (length > maximum) throw new PackageInputFailure("limit");
    let enumerableIndexes = 0;
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      if (!/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= length) {
        throw new PackageInputFailure("invalid");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new PackageInputFailure("invalid");
      }
      enumerableIndexes += 1;
      if (enumerableIndexes > length) throw new PackageInputFailure("invalid");
    }
    if (enumerableIndexes !== length) throw new PackageInputFailure("invalid");
    const elements: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new PackageInputFailure("invalid");
      }
      elements.push(descriptor.value);
    }
    return elements;
  } catch (error) {
    if (error instanceof PackageInputFailure) throw error;
    throw new PackageInputFailure("invalid");
  }
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

function boundedIdentity(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxIdentityStringCodeUnits ||
    !hasUnicodeScalarSequence(value)
  ) {
    throw new PackageInputFailure(
      typeof value === "string" &&
        value.length > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxIdentityStringCodeUnits
        ? "limit"
        : "invalid",
    );
  }
  return value;
}

function captureCandidates(input: unknown): readonly CapturedCandidate[] {
  const elements = denseArrayElements(input, BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCandidates);
  return Object.freeze(
    elements.map((element, index) => {
      const record = exactDataRecord(element, ["id", "version", "target", "catalog", "artifacts"]);
      if (record === undefined) throw new PackageInputFailure("invalid");
      const version = boundedIdentity(record.version);
      if (!isExactSemanticVersion(version)) throw new PackageInputFailure("invalid");
      return Object.freeze({
        index,
        id: boundedIdentity(record.id),
        version,
        target: boundedIdentity(record.target),
        catalog: record.catalog,
        artifacts: record.artifacts,
      });
    }),
  );
}

function captureRequirements(
  record: BundleIntegrityAuthorityRecord,
): readonly CapturedRequirement[] {
  const requirements = record.bundle.requires.catalogs;
  if (requirements.length > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxRequirements) {
    throw new PackageInputFailure("limit");
  }
  return Object.freeze(
    requirements.map((requirement: BundleRequirement, index) =>
      Object.freeze({
        index,
        id: boundedIdentity(requirement.id),
        version: boundedIdentity(requirement.version),
        target: boundedIdentity(requirement.target),
        digest: boundedIdentity(requirement.digest),
      }),
    ),
  );
}

function captureJsonValue(
  value: unknown,
  depth: number,
  budget: JsonCaptureBudget,
  active: WeakSet<object>,
): JsonValue {
  budget.values += 1;
  if (budget.values > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogValueOccurrences) {
    throw new PackageInputFailure("limit");
  }
  if (depth > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogDepth) {
    throw new PackageInputFailure("limit");
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new PackageInputFailure("invalid");
    return value;
  }
  if (typeof value === "string") {
    if (!hasUnicodeScalarSequence(value)) throw new PackageInputFailure("invalid");
    budget.strings += value.length;
    if (budget.strings > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogStringCodeUnits) {
      throw new PackageInputFailure("limit");
    }
    return value;
  }
  if (typeof value !== "object" || utilTypes.isProxy(value)) {
    throw new PackageInputFailure("invalid");
  }
  if (active.has(value)) throw new PackageInputFailure("invalid");
  active.add(value);
  try {
    if (Array.isArray(value)) {
      const elements = denseArrayElements(
        value,
        BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogValueOccurrences,
      );
      return Object.freeze(
        elements.map((element) => captureJsonValue(element, depth + 1, budget, active)),
      );
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new PackageInputFailure("invalid");
    }
    const snapshot: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
    let memberCount = 0;
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      memberCount += 1;
      if (memberCount > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogObjectMembers) {
        throw new PackageInputFailure("limit");
      }
      if (!hasUnicodeScalarSequence(key)) throw new PackageInputFailure("invalid");
      budget.strings += key.length;
      if (budget.strings > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogStringCodeUnits) {
        throw new PackageInputFailure("limit");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new PackageInputFailure("invalid");
      }
      Object.defineProperty(snapshot, key, {
        configurable: false,
        enumerable: true,
        value: captureJsonValue(descriptor.value, depth + 1, budget, active),
        writable: false,
      });
    }
    return Object.freeze(snapshot);
  } finally {
    active.delete(value);
  }
}

function captureCatalog(input: unknown): CapturedCatalog {
  const value = captureJsonValue(input, 0, { values: 0, strings: 0 }, new WeakSet<object>());
  let canonicalBytes: Uint8Array;
  try {
    canonicalBytes = canonicalizeJsonBytes(value);
  } catch {
    throw new PackageInputFailure("invalid");
  }
  if (canonicalBytes.byteLength > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCatalogCanonicalBytes) {
    throw new PackageInputFailure("limit");
  }
  return Object.freeze({ value, canonicalByteLength: canonicalBytes.byteLength });
}

function captureArtifactBytes(value: unknown): Uint8Array {
  try {
    if (
      utilTypes.isProxy(value) ||
      !utilTypes.isUint8Array(value) ||
      TYPED_ARRAY_BUFFER_GETTER === undefined ||
      TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined ||
      TYPED_ARRAY_BYTE_OFFSET_GETTER === undefined
    ) {
      throw new PackageInputFailure("invalid");
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
      byteLength < 0 ||
      byteOffset < 0
    ) {
      throw new PackageInputFailure("invalid");
    }
    if (byteLength > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactEntryBytes) {
      throw new PackageInputFailure("limit");
    }
    const source = new Uint8Array(buffer as ArrayBuffer, byteOffset, byteLength);
    const snapshot = new Uint8Array(byteLength);
    Reflect.apply(Uint8Array.prototype.set, snapshot, [source]);
    return snapshot;
  } catch (error) {
    if (error instanceof PackageInputFailure) throw error;
    throw new PackageInputFailure("invalid");
  }
}

function captureArtifactPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactPathBytes ||
    value === CATALOG_PATH ||
    !value.split("/").every((segment) => PATH_SEGMENT_PATTERN.test(segment)) ||
    value.split("/").some((segment) => WINDOWS_DEVICE_SEGMENT_PATTERN.test(segment))
  ) {
    throw new PackageInputFailure(
      typeof value === "string" &&
        value.length > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactPathBytes
        ? "limit"
        : "invalid",
    );
  }
  return value;
}

function captureArtifacts(
  input: unknown,
  catalogByteLength: number,
  maximumFramedBytes: number,
): readonly CapturedWebReactPackageArtifact[] {
  const elements = denseArrayElements(
    input,
    BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxArtifactsPerPackage,
  );
  const paths = new Set<string>([CATALOG_PATH]);
  let framedBytes =
    PROFILE_MAGIC_BYTE_LENGTH + 4 + 2 + CATALOG_PATH_BYTE_LENGTH + 4 + catalogByteLength;
  if (framedBytes > maximumFramedBytes) throw new PackageInputFailure("limit");
  const artifacts: CapturedWebReactPackageArtifact[] = [];
  for (const element of elements) {
    const record = exactDataRecord(element, ["path", "bytes"]);
    if (record === undefined) throw new PackageInputFailure("invalid");
    const path = captureArtifactPath(record.path);
    if (paths.has(path)) throw new PackageInputFailure("invalid");
    paths.add(path);
    const bytes = captureArtifactBytes(record.bytes);
    const entryBytes = 2 + path.length + 4 + bytes.byteLength;
    if (entryBytes > maximumFramedBytes - framedBytes) {
      throw new PackageInputFailure("limit");
    }
    framedBytes += entryBytes;
    artifacts.push(Object.freeze({ path, bytes }));
  }
  return Object.freeze(artifacts);
}

function tupleKey(id: string, version: string, target: string): string {
  return JSON.stringify([id, version, target]);
}

function capabilityCount(catalog: ImmutableJson<DesenCatalog>): number {
  return (
    Object.keys(catalog.components).length +
    Object.keys(catalog.behaviors).length +
    Object.keys(catalog.operations).length +
    Object.keys(catalog.resources).length
  );
}

function firstDuplicateCapabilityPackageIndex(
  catalogs: readonly ImmutableJson<DesenCatalog>[],
): number | undefined {
  const capabilityIds = new Set<string>();
  for (let packageIndex = 0; packageIndex < catalogs.length; packageIndex += 1) {
    const catalog = catalogs[packageIndex] as ImmutableJson<DesenCatalog>;
    for (const group of CAPABILITY_GROUPS) {
      const ids = Object.keys(catalog[group]).sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0,
      );
      for (const capabilityId of ids) {
        if (capabilityIds.has(capabilityId)) return packageIndex;
        capabilityIds.add(capabilityId);
      }
    }
  }
  return undefined;
}

function packageResolutionDiagnostic(
  requirement: CapturedRequirement,
  reason: "ambiguous" | "missing",
): BundlePackagePreflightDiagnostic {
  return createCoreDiagnostic({
    code: "CATALOG_VERSION_UNAVAILABLE",
    message:
      reason === "missing"
        ? "No exact installed package matches the Bundle requirement."
        : "More than one installed package matches the Bundle requirement.",
    pointer: requirementPointer(requirement.index),
  });
}

function createAuthority(
  integrityAuthority: BundleIntegrityAuthority,
  integrityRecord: BundleIntegrityAuthorityRecord,
  catalogSet: DesenValidatedCatalogSet,
  packages: readonly BundlePackagePreflightAuthorityRecord["packages"][number][],
  requirementPackageIndexes: readonly number[],
): BundlePackagePreflightResult {
  const publicPackages = Object.freeze(packages.map((entry) => entry.metadata));
  const publicIndexes = Object.freeze([...requirementPackageIndexes]);
  const authority = Object.freeze({
    protocolVersion: "0.1.0",
    revision: integrityRecord.revision,
    packages: publicPackages,
    requirementPackageIndexes: publicIndexes,
  }) as BundlePackagePreflightAuthority;
  AUTHORITIES.set(
    authority,
    Object.freeze({
      integrityAuthority,
      integrityRecord,
      catalogSet,
      packages: Object.freeze([...packages]),
      requirementPackageIndexes: publicIndexes,
    }),
  );
  return Object.freeze({ status: "preflighted", authority });
}

/** @internal Authenticates and reads one exact M07-T03 package-preflight authority. */
export function readBundlePackagePreflightAuthority(
  authority: unknown,
): BundlePackagePreflightAuthorityRecord | undefined {
  return typeof authority === "object" && authority !== null
    ? AUTHORITIES.get(authority as BundlePackagePreflightAuthority)
    : undefined;
}

/** @internal Returns whether a value is an exact live M07-T03 authority. */
export function isBundlePackagePreflightAuthority(
  value: unknown,
): value is BundlePackagePreflightAuthority {
  return readBundlePackagePreflightAuthority(value) !== undefined;
}

/** @internal Package-private implementation with injectable pure verification ports for tests. */
export function preflightBundlePackagesInternal(
  integrityAuthority: BundleIntegrityAuthority,
  installedPackages: readonly InstalledPackageCandidate[],
  ports: PackagePreflightPorts = DEFAULT_PORTS,
): BundlePackagePreflightResult {
  const integrityRecord = readBundleIntegrityAuthority(integrityAuthority);
  if (integrityRecord === undefined) {
    return rejection("integrity-authority", [
      extensionDiagnostic(
        INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE,
        "Package preflight requires an authentic Bundle integrity authority.",
        ROOT_POINTER,
      ),
    ]);
  }

  let requirements: readonly CapturedRequirement[];
  try {
    requirements = captureRequirements(integrityRecord);
  } catch (error) {
    if (error instanceof PackageInputFailure && error.reason === "limit") {
      return limitRejection("package-requirements", requirementPointer());
    }
    return invalidInputRejection("package-requirements", requirementPointer());
  }
  for (const requirement of requirements) {
    if (!isExactSemanticVersion(requirement.version)) {
      return rejection("package-requirements", [
        extensionDiagnostic(
          "run.desen.validator/INVALID_SEMVER",
          "A Bundle package requirement version must be exact Semantic Versioning.",
          requirementPointer(requirement.index, "version"),
        ),
      ]);
    }
  }

  let candidates: readonly CapturedCandidate[];
  try {
    candidates = captureCandidates(installedPackages);
  } catch (error) {
    return error instanceof PackageInputFailure && error.reason === "limit"
      ? limitRejection("package-inventory", requirementPointer())
      : invalidInputRejection("package-inventory", requirementPointer());
  }

  const candidatesByTuple = new Map<string, CapturedCandidate[]>();
  for (const candidate of candidates) {
    const key = tupleKey(candidate.id, candidate.version, candidate.target);
    const matches = candidatesByTuple.get(key) ?? [];
    matches.push(candidate);
    candidatesByTuple.set(key, matches);
  }

  const selectedByRequirement: CapturedCandidate[] = [];
  const resolutionDiagnostics: BundlePackagePreflightDiagnostic[] = [];
  for (const requirement of requirements) {
    const matches =
      candidatesByTuple.get(tupleKey(requirement.id, requirement.version, requirement.target)) ??
      [];
    if (matches.length !== 1 || requirement.target !== "web-react") {
      if (resolutionDiagnostics.length >= BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxDiagnostics) {
        return limitRejection("package-resolution", requirementPointer());
      }
      resolutionDiagnostics.push(
        packageResolutionDiagnostic(requirement, matches.length > 1 ? "ambiguous" : "missing"),
      );
      continue;
    }
    selectedByRequirement.push(matches[0] as CapturedCandidate);
  }
  if (resolutionDiagnostics.length > 0) {
    return rejection("package-resolution", resolutionDiagnostics);
  }

  const uniqueCandidates: CapturedCandidate[] = [];
  const packageIndexByCandidate = new Map<number, number>();
  const firstRequirementIndexes: number[] = [];
  const requirementPackageIndexes = selectedByRequirement.map((candidate, requirementIndex) => {
    const existing = packageIndexByCandidate.get(candidate.index);
    if (existing !== undefined) return existing;
    const packageIndex = uniqueCandidates.length;
    uniqueCandidates.push(candidate);
    packageIndexByCandidate.set(candidate.index, packageIndex);
    firstRequirementIndexes.push(requirementIndex);
    return packageIndex;
  });

  const selectedRecords: BundlePackagePreflightAuthorityRecord["packages"][number][] = [];
  const structuralCatalogs: ImmutableJson<DesenCatalog>[] = [];
  let aggregateCatalogBytes = 0;
  let aggregateFramedBytes = 0;
  let aggregateCapabilities = 0;
  try {
    for (let packageIndex = 0; packageIndex < uniqueCandidates.length; packageIndex += 1) {
      const candidate = uniqueCandidates[packageIndex] as CapturedCandidate;
      const requirementIndex = firstRequirementIndexes[packageIndex] as number;
      let capturedCatalog: CapturedCatalog;
      try {
        capturedCatalog = captureCatalog(candidate.catalog);
      } catch (error) {
        return error instanceof PackageInputFailure && error.reason === "limit"
          ? limitRejection("package-catalog", requirementPointer(requirementIndex))
          : invalidInputRejection("package-catalog", requirementPointer(requirementIndex));
      }
      aggregateCatalogBytes += capturedCatalog.canonicalByteLength;
      if (
        aggregateCatalogBytes > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxAggregateCatalogCanonicalBytes
      ) {
        return limitRejection("package-catalog", requirementPointer(requirementIndex));
      }

      const guarded = guardPackagePreflightCatalogStructure(capturedCatalog.value);
      if (!guarded.valid) {
        return rejection("package-catalog", [
          createCoreDiagnostic({
            code: guarded.code,
            message:
              guarded.code === "UNKNOWN_CORE_FIELD"
                ? "An installed Catalog contains an unknown closed-core field."
                : "An installed Catalog violates the frozen DESEN 0.1.0 schema.",
            pointer: requirementPointer(requirementIndex),
          }),
        ]);
      }

      const structural = ports.validateStructure("catalog", capturedCatalog.value);
      if (!structural.valid) {
        const first = structural.diagnostics[0];
        return first === undefined
          ? invalidInputRejection("package-catalog", requirementPointer(requirementIndex))
          : rejection("package-catalog", [
              createCoreDiagnostic({
                code: first.code,
                message:
                  first.code === "UNKNOWN_CORE_FIELD"
                    ? "An installed Catalog contains an unknown closed-core field."
                    : "An installed Catalog violates the frozen DESEN 0.1.0 schema.",
                pointer: requirementPointer(requirementIndex),
              }),
            ]);
      }
      const catalog = structural.value;
      if (
        candidate.id !== catalog.id ||
        candidate.version !== catalog.version ||
        candidate.target !== catalog.target ||
        !isExactSemanticVersion(catalog.version)
      ) {
        return invalidInputRejection("package-catalog", requirementPointer(requirementIndex));
      }
      aggregateCapabilities += capabilityCount(catalog);
      if (aggregateCapabilities > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCapabilityDeclarations) {
        return limitRejection("package-catalog", requirementPointer(requirementIndex));
      }

      let artifacts: readonly CapturedWebReactPackageArtifact[];
      try {
        artifacts = captureArtifacts(
          candidate.artifacts,
          capturedCatalog.canonicalByteLength,
          Math.min(
            BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxPackagePreimageBytes,
            BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxAggregatePackagePreimageBytes - aggregateFramedBytes,
          ),
        );
      } catch (error) {
        return error instanceof PackageInputFailure && error.reason === "limit"
          ? limitRejection("package-digest", requirementPointer(requirementIndex))
          : invalidInputRejection("package-digest", requirementPointer(requirementIndex));
      }
      const calculated = ports.calculateWebReactDigest(
        catalog,
        artifacts,
        Math.min(
          BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxPackagePreimageBytes,
          BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxAggregatePackagePreimageBytes - aggregateFramedBytes,
        ),
      );
      aggregateFramedBytes += calculated.framedByteLength;
      if (aggregateFramedBytes > BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxAggregatePackagePreimageBytes) {
        return limitRejection("package-digest", requirementPointer(requirementIndex));
      }
      const digestMismatch =
        catalog.packageDigest !== calculated.packageDigest ||
        requirements.some(
          (requirement, index) =>
            requirementPackageIndexes[index] === packageIndex &&
            requirement.digest !== calculated.packageDigest,
        );
      if (digestMismatch) {
        const mismatchIndex = requirements.findIndex(
          (requirement, index) =>
            requirementPackageIndexes[index] === packageIndex &&
            requirement.digest !== calculated.packageDigest,
        );
        return rejection("package-digest", [
          createCoreDiagnostic({
            code: "CATALOG_DIGEST_MISMATCH",
            message:
              "The Bundle requirement, installed Catalog, and calculated package digest must match.",
            pointer: requirementPointer(
              mismatchIndex >= 0 ? mismatchIndex : requirementIndex,
              "digest",
            ),
          }),
        ]);
      }
      const metadata = Object.freeze({
        id: catalog.id,
        version: catalog.version,
        target: "web-react",
        packageDigest: calculated.packageDigest,
        digestProfile: "desen.web-react.package-digest",
        digestProfileVersion: 1,
        artifactCount: calculated.artifactCount,
        framedByteLength: calculated.framedByteLength,
      }) satisfies VerifiedInstalledPackage;
      structuralCatalogs.push(catalog);
      selectedRecords.push(Object.freeze({ metadata, catalog, artifacts }));
    }

    const duplicatePackageIndex = firstDuplicateCapabilityPackageIndex(structuralCatalogs);
    if (duplicatePackageIndex !== undefined) {
      return rejection("catalog-set", [
        createCoreDiagnostic({
          code: "AMBIGUOUS_CAPABILITY",
          message: "The installed Catalog set contains an ambiguous capability namespace.",
          pointer: requirementPointer(firstRequirementIndexes[duplicatePackageIndex]),
        }),
      ]);
    }

    const catalogSet = ports.validateCatalogSet(structuralCatalogs);
    if (!catalogSet.valid) {
      return rejection("internal", [
        extensionDiagnostic(
          PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE,
          "Installed-package Catalog-set validation disagreed with its fail-fast admission.",
          ROOT_POINTER,
        ),
      ]);
    }

    const finalRecords = selectedRecords.map((record, index) =>
      Object.freeze({
        ...record,
        catalog: catalogSet.value[index] as ImmutableJson<DesenCatalog>,
      }),
    );
    return createAuthority(
      integrityAuthority,
      integrityRecord,
      catalogSet.value,
      finalRecords,
      requirementPackageIndexes,
    );
  } catch {
    return rejection("internal", [
      extensionDiagnostic(
        PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE,
        "Installed-package preflight could not complete its trusted implementation path.",
        ROOT_POINTER,
      ),
    ]);
  }
}
