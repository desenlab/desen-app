import {
  calculateDesenBundleRevision,
  canonicalizeJsonBytes,
  createCoreDiagnostic,
  createJsonPointer,
  getCoreDiagnosticDefinition,
  isCoreDiagnosticCode,
  isJsonPointer,
  isSha256Digest,
} from "@desen/protocol";
import {
  ADAPTER_VALIDATION_LIMIT_EXCEEDED_CODE,
  CATALOG_REQUIREMENT_MISMATCH_CODE,
  INVALID_BINDING_CONTRACT_CODE,
  INVALID_COMPONENT_CONTRACT_CODE,
  INVALID_EXECUTION_CONTRACT_CODE,
  INVALID_INTERACTION_CONTRACT_CODE,
  INVALID_SEMVER_CODE,
  validateDesenBundleExecutionContracts,
} from "@desen/validator";

import type { DesenBundle, DesenDiagnostic } from "@desen/protocol";
import type {
  DesenExecutionContractValidationResult,
  DesenSemanticDiagnostic,
  ImmutableJson,
} from "@desen/validator";

import type { PublishCatalogPackageCandidate } from "./catalog-resolution.js";
import {
  preflightPublishCatalogPinning,
  type PublishCatalogPinningResult,
  type PublishCatalogPinningSuccess,
} from "./catalog-pinning.js";
import { annotatePublishErrorDiagnostic, createPublishFailure } from "./publish-diagnostics.js";
import { PUBLISH_PIPELINE_STAGES } from "./publish-result.js";
import type {
  BundlePublicationExtensionDiagnosticCode,
  PublishFailure,
  PublishResult,
} from "./publish-result.js";
import {
  PUBLISH_SOURCE_NORMALIZATION_LIMITS,
  normalizePublishSourceNormalizationLimits,
  type PublishSourceNormalizationLimits,
} from "./source-normalization.js";

/**
 * Package-private diagnostic for an impossible or forged terminal validation authority.
 *
 * @remarks Ordinary document failures retain their exact core or Validator diagnostic. This code
 * is reserved for malformed predecessor/Validator shells, mutable or divergent snapshots, or
 * canonicalization authority that cannot be authenticated.
 */
const BUNDLE_VALIDATION_AUTHORITY_INVALID_CODE: BundlePublicationExtensionDiagnosticCode =
  "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID";

/** Finite profile used by the terminal Bundle boundary. */
export interface PublishBundlePublicationLimits {
  /** Exact profile inherited by M06-T01 through M06-T08. */
  readonly catalogPinning: Readonly<PublishSourceNormalizationLimits>;
  /** Maximum RFC 8785 canonical UTF-8 bytes admitted to the complete Bundle. */
  readonly maxBundleCanonicalBytes: number;
}

/**
 * Default finite profile for complete deterministic publication.
 *
 * @remarks The two-MiB ceiling is measured after exact Catalog tuples, Source digest, and revision
 * are present. Optional root publication metadata remains outside M06 and must be remeasured by its
 * later owner.
 */
export const PUBLISH_BUNDLE_PUBLICATION_LIMITS: Readonly<PublishBundlePublicationLimits> =
  Object.freeze({
    catalogPinning: PUBLISH_SOURCE_NORMALIZATION_LIMITS,
    maxBundleCanonicalBytes: 2_097_152,
  });

const OBJECT_FREEZE = Object.freeze;
const OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const OBJECT_IS_FROZEN = Object.isFrozen;
const OBJECT_PROTOTYPE = Object.prototype;
const ARRAY_IS_ARRAY = Array.isArray;
const ARRAY_PROTOTYPE = Array.prototype;
const REFLECT_OWN_KEYS = Reflect.ownKeys;

const LIMIT_KEYS = Object.freeze(["catalogPinning", "maxBundleCanonicalBytes"] as const);
const LIMIT_KEY_SET: ReadonlySet<string> = new Set(LIMIT_KEYS);
const FAILURE_KEYS: ReadonlySet<string> = new Set(["diagnostics", "ok", "stage"]);
const PINNING_SUCCESS_KEYS: ReadonlySet<string> = new Set([
  "catalogSet",
  "catalogsPinned",
  "diagnostics",
  "normalizedDocument",
  "obligations",
  "packages",
  "pinnedDocument",
  "preservedDocument",
  "requirementPackageIndexes",
  "source",
  "sourceCatalogRequirements",
  "sourceDigest",
  "traceability",
]);
const VALIDATOR_SUCCESS_KEYS: ReadonlySet<string> = new Set([
  "diagnostics",
  "obligations",
  "target",
  "valid",
  "value",
]);
const VALIDATOR_FAILURE_KEYS: ReadonlySet<string> = new Set([
  "diagnostics",
  "obligations",
  "target",
  "valid",
]);
const PINNED_DOCUMENT_REQUIRED_KEYS: ReadonlySet<string> = new Set([
  "desen",
  "entry",
  "id",
  "kind",
  "requires",
  "sourceDigest",
  "surfaces",
]);
const BUNDLE_REQUIRED_KEYS: ReadonlySet<string> = new Set([
  "desen",
  "entry",
  "id",
  "kind",
  "requires",
  "revision",
  "sourceDigest",
  "surfaces",
]);
const VALIDATOR_EXTENSION_CODES: ReadonlySet<string> = new Set([
  ADAPTER_VALIDATION_LIMIT_EXCEEDED_CODE,
  CATALOG_REQUIREMENT_MISMATCH_CODE,
  INVALID_BINDING_CONTRACT_CODE,
  INVALID_COMPONENT_CONTRACT_CODE,
  INVALID_EXECUTION_CONTRACT_CODE,
  INVALID_INTERACTION_CONTRACT_CODE,
  INVALID_SEMVER_CODE,
]);
const PUBLISH_ERROR_EXTENSION_CODES: ReadonlySet<string> = new Set([
  ...VALIDATOR_EXTENSION_CODES,
  "run.desen.publisher/INVALID_SOURCE_JSON",
  "run.desen.publisher/SOURCE_LIMIT_EXCEEDED",
  "run.desen.publisher/INVALID_CATALOG_INPUT",
  "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
  "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
  "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
  "run.desen.publisher/EXECUTION_PREFLIGHT_AUTHORITY_INVALID",
  "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
  "run.desen.publisher/SOURCE_PRESERVATION_AUTHORITY_INVALID",
  "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED",
  "run.desen.publisher/SOURCE_NORMALIZATION_AUTHORITY_INVALID",
  "run.desen.publisher/SOURCE_NORMALIZATION_LIMIT_EXCEEDED",
]);
const PUBLISH_WARNING_EXTENSION_CODES: ReadonlySet<string> = new Set([
  "run.desen.publisher/DEPRECATED_CAPABILITY",
]);
const PUBLISH_DIAGNOSTIC_METADATA_KEYS: ReadonlySet<string> = new Set(["severity", "stage"]);
const PIPELINE_STAGE_SET: ReadonlySet<string> = new Set(PUBLISH_PIPELINE_STAGES);
const EMPTY_KEYS: ReadonlySet<string> = new Set();
const DIAGNOSTIC_CONTEXT_KEYS: ReadonlySet<string> = new Set([
  "capabilityId",
  "documentId",
  "subject",
  "surfaceId",
]);
const DIAGNOSTIC_SUBJECT_KEYS: ReadonlySet<string> = new Set(["id", "kind"]);

type ValidatorResult = DesenExecutionContractValidationResult<"bundle">;

function ownDataValue<Value>(object: object, key: PropertyKey): Value | undefined {
  const descriptor = Reflect.apply(OBJECT_GET_OWN_PROPERTY_DESCRIPTOR, Object, [object, key]) as
    PropertyDescriptor | undefined;
  return descriptor !== undefined && descriptor.enumerable && "value" in descriptor
    ? (descriptor.value as Value)
    : undefined;
}

function hasExactOrdinaryOwnDataShape(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
  requiredKeys: ReadonlySet<string> = allowedKeys,
): value is Record<string, unknown> {
  try {
    if (typeof value !== "object" || value === null || ARRAY_IS_ARRAY(value)) return false;
    if (Reflect.apply(OBJECT_GET_PROTOTYPE_OF, Object, [value]) !== OBJECT_PROTOTYPE) return false;
    const keys = Reflect.apply(REFLECT_OWN_KEYS, Reflect, [value]) as PropertyKey[];
    if (
      keys.some((key) => typeof key !== "string" || !allowedKeys.has(key)) ||
      [...requiredKeys].some((key) => !keys.includes(key))
    ) {
      return false;
    }
    return keys.every((key) => {
      const descriptor = Reflect.apply(OBJECT_GET_OWN_PROPERTY_DESCRIPTOR, Object, [value, key]) as
        PropertyDescriptor | undefined;
      return descriptor !== undefined && descriptor.enumerable && "value" in descriptor;
    });
  } catch {
    return false;
  }
}

function isDenseFrozenArray(value: unknown): value is readonly unknown[] {
  try {
    if (
      !ARRAY_IS_ARRAY(value) ||
      Reflect.apply(OBJECT_GET_PROTOTYPE_OF, Object, [value]) !== ARRAY_PROTOTYPE ||
      !Reflect.apply(OBJECT_IS_FROZEN, Object, [value])
    ) {
      return false;
    }
    const keys = Reflect.apply(REFLECT_OWN_KEYS, Reflect, [value]) as PropertyKey[];
    if (
      keys.length !== value.length + 1 ||
      !keys.includes("length") ||
      keys.some(
        (key) =>
          typeof key !== "string" ||
          (key !== "length" &&
            (!/^(?:0|[1-9][0-9]*)$/u.test(key) ||
              Number(key) >= value.length ||
              String(Number(key)) !== key)),
      )
    ) {
      return false;
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Reflect.apply(OBJECT_GET_OWN_PROPERTY_DESCRIPTOR, Object, [
        value,
        String(index),
      ]) as PropertyDescriptor | undefined;
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function isRecursivelyFrozenJson(value: unknown): boolean {
  const pending: unknown[] = [value];
  const visited = new Set<object>();
  try {
    while (pending.length > 0) {
      const current = pending.pop();
      if (
        current === null ||
        typeof current === "string" ||
        typeof current === "boolean" ||
        typeof current === "number"
      ) {
        if (typeof current === "number" && !Number.isFinite(current)) return false;
        continue;
      }
      if (typeof current !== "object" || visited.has(current)) return false;
      visited.add(current);
      if (!Reflect.apply(OBJECT_IS_FROZEN, Object, [current])) return false;

      if (ARRAY_IS_ARRAY(current)) {
        if (!isDenseFrozenArray(current)) return false;
        for (let index = 0; index < current.length; index += 1) {
          pending.push(ownDataValue(current, String(index)));
        }
        continue;
      }
      if (Reflect.apply(OBJECT_GET_PROTOTYPE_OF, Object, [current]) !== OBJECT_PROTOTYPE) {
        return false;
      }
      for (const key of Reflect.apply(REFLECT_OWN_KEYS, Reflect, [current]) as PropertyKey[]) {
        if (typeof key !== "string") return false;
        const descriptor = Reflect.apply(OBJECT_GET_OWN_PROPERTY_DESCRIPTOR, Object, [
          current,
          key,
        ]) as PropertyDescriptor | undefined;
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          return false;
        }
        pending.push(descriptor.value);
      }
    }
    return true;
  } catch {
    return false;
  }
}

function diagnosticContextIsAuthentic(value: unknown): boolean {
  try {
    if (
      !hasExactOrdinaryOwnDataShape(value, DIAGNOSTIC_CONTEXT_KEYS, EMPTY_KEYS) ||
      !Reflect.apply(OBJECT_IS_FROZEN, Object, [value]) ||
      Reflect.apply(REFLECT_OWN_KEYS, Reflect, [value]).length === 0
    ) {
      return false;
    }
    for (const key of ["capabilityId", "documentId", "surfaceId"] as const) {
      const descriptor = Reflect.apply(OBJECT_GET_OWN_PROPERTY_DESCRIPTOR, Object, [value, key]) as
        PropertyDescriptor | undefined;
      const identity = descriptor === undefined ? undefined : ownDataValue<string>(value, key);
      if (
        descriptor !== undefined &&
        (typeof identity !== "string" || identity.trim().length === 0)
      ) {
        return false;
      }
    }
    const subjectDescriptor = Reflect.apply(OBJECT_GET_OWN_PROPERTY_DESCRIPTOR, Object, [
      value,
      "subject",
    ]) as PropertyDescriptor | undefined;
    if (subjectDescriptor === undefined) return true;
    const subject = ownDataValue<object>(value, "subject");
    return (
      hasExactOrdinaryOwnDataShape(subject, DIAGNOSTIC_SUBJECT_KEYS) &&
      Reflect.apply(OBJECT_IS_FROZEN, Object, [subject]) &&
      (ownDataValue(subject, "kind") === "node" || ownDataValue(subject, "kind") === "behavior") &&
      typeof ownDataValue(subject, "id") === "string" &&
      (ownDataValue<string>(subject, "id") as string).trim().length > 0
    );
  } catch {
    return false;
  }
}

function diagnosticEnvelopeIsAuthentic(
  value: unknown,
  allowedExtensionCodes: ReadonlySet<string>,
  additionalAllowedKeys: ReadonlySet<string> = EMPTY_KEYS,
): value is DesenSemanticDiagnostic {
  try {
    if (!isRecursivelyFrozenJson(value) || typeof value !== "object" || value === null) {
      return false;
    }
    const code = ownDataValue<string>(value, "code");
    const message = ownDataValue<string>(value, "message");
    const pointerDescriptor = Reflect.apply(OBJECT_GET_OWN_PROPERTY_DESCRIPTOR, Object, [
      value,
      "pointer",
    ]) as PropertyDescriptor | undefined;
    const pointer =
      pointerDescriptor === undefined ? undefined : ownDataValue<string>(value, "pointer");
    const contextDescriptor = Reflect.apply(OBJECT_GET_OWN_PROPERTY_DESCRIPTOR, Object, [
      value,
      "context",
    ]) as PropertyDescriptor | undefined;
    const context =
      contextDescriptor === undefined ? undefined : ownDataValue<object>(value, "context");
    if (
      typeof code !== "string" ||
      typeof message !== "string" ||
      message.length === 0 ||
      (pointerDescriptor !== undefined &&
        (typeof pointer !== "string" || !isJsonPointer(pointer))) ||
      (contextDescriptor !== undefined && !diagnosticContextIsAuthentic(context))
    ) {
      return false;
    }
    const core = isCoreDiagnosticCode(code);
    const allowedKeys = new Set([
      "code",
      ...(core ? ["classification"] : []),
      ...additionalAllowedKeys,
      "context",
      "message",
      "pointer",
    ]);
    if (!hasExactOrdinaryOwnDataShape(value, allowedKeys, new Set(["code", "message"]))) {
      return false;
    }
    if (core) {
      return (
        ownDataValue(value, "classification") === getCoreDiagnosticDefinition(code)?.classification
      );
    }
    return allowedExtensionCodes.has(code);
  } catch {
    return false;
  }
}

function publisherWarningIsAuthentic(value: unknown): boolean {
  try {
    if (
      !diagnosticEnvelopeIsAuthentic(
        value,
        PUBLISH_WARNING_EXTENSION_CODES,
        PUBLISH_DIAGNOSTIC_METADATA_KEYS,
      ) ||
      typeof value !== "object" ||
      value === null ||
      !hasExactOrdinaryOwnDataShape(
        value,
        new Set(["code", "context", "message", "pointer", "severity", "stage"]),
      )
    ) {
      return false;
    }
    return (
      ownDataValue(value, "code") === "run.desen.publisher/DEPRECATED_CAPABILITY" &&
      ownDataValue(value, "message") === "Source data uses a deprecated Catalog capability." &&
      ownDataValue(value, "severity") === "warning" &&
      ownDataValue(value, "stage") === "capability-contracts"
    );
  } catch {
    return false;
  }
}

function publisherErrorIsAuthentic(value: unknown, stage: string): boolean {
  try {
    if (
      !diagnosticEnvelopeIsAuthentic(
        value,
        PUBLISH_ERROR_EXTENSION_CODES,
        PUBLISH_DIAGNOSTIC_METADATA_KEYS,
      ) ||
      typeof value !== "object" ||
      value === null
    ) {
      return false;
    }
    const core = isCoreDiagnosticCode(ownDataValue(value, "code"));
    return (
      hasExactOrdinaryOwnDataShape(
        value,
        new Set([
          "code",
          ...(core ? ["classification"] : []),
          "context",
          "message",
          "pointer",
          "severity",
          "stage",
        ]),
        new Set(["code", "message", "severity", "stage"]),
      ) &&
      ownDataValue(value, "severity") === "error" &&
      ownDataValue(value, "stage") === stage
    );
  } catch {
    return false;
  }
}

function byteEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function isAuthenticCanonicalBytes(value: unknown): value is Uint8Array {
  try {
    return (
      value instanceof Uint8Array &&
      Reflect.apply(OBJECT_GET_PROTOTYPE_OF, Object, [value]) === Uint8Array.prototype &&
      Number.isSafeInteger(value.byteLength)
    );
  } catch {
    return false;
  }
}

function jsonGraphsAreDisjoint(left: object, right: object): boolean {
  const leftObjects = new Set<object>();
  const pendingLeft: object[] = [left];
  const pendingRight: object[] = [right];
  try {
    while (pendingLeft.length > 0) {
      const current = pendingLeft.pop();
      if (current === undefined || leftObjects.has(current)) continue;
      leftObjects.add(current);
      for (const key of Reflect.apply(REFLECT_OWN_KEYS, Reflect, [current]) as PropertyKey[]) {
        if (ARRAY_IS_ARRAY(current) && key === "length") continue;
        const child = ownDataValue<unknown>(current, key);
        if (typeof child === "object" && child !== null) pendingLeft.push(child);
      }
    }
    const visitedRight = new Set<object>();
    while (pendingRight.length > 0) {
      const current = pendingRight.pop();
      if (current === undefined || visitedRight.has(current)) continue;
      if (leftObjects.has(current)) return false;
      visitedRight.add(current);
      for (const key of Reflect.apply(REFLECT_OWN_KEYS, Reflect, [current]) as PropertyKey[]) {
        if (ARRAY_IS_ARRAY(current) && key === "length") continue;
        const child = ownDataValue<unknown>(current, key);
        if (typeof child === "object" && child !== null) pendingRight.push(child);
      }
    }
    return true;
  } catch {
    return false;
  }
}

function documentContext(document: object | undefined) {
  try {
    if (document === undefined) return undefined;
    const documentId = ownDataValue<string>(document, "id");
    return typeof documentId === "string" && documentId.trim().length > 0
      ? OBJECT_FREEZE({ documentId })
      : undefined;
  } catch {
    return undefined;
  }
}

function authorityDiagnostic(): Readonly<
  DesenDiagnostic<BundlePublicationExtensionDiagnosticCode>
> {
  return OBJECT_FREEZE({
    code: BUNDLE_VALIDATION_AUTHORITY_INVALID_CODE,
    message: "Bundle validation could not authenticate its complete publication authority.",
    pointer: createJsonPointer(),
  });
}

function authorityFailure(): PublishFailure {
  return createPublishFailure([
    annotatePublishErrorDiagnostic(authorityDiagnostic(), "bundle-validation"),
  ]);
}

function bundleLimitFailure(document?: object): PublishFailure {
  const context = documentContext(document);
  return createPublishFailure([
    annotatePublishErrorDiagnostic(
      createCoreDiagnostic({
        code: "BUNDLE_LIMIT_EXCEEDED",
        message: "The complete Bundle exceeded the finite Publisher profile.",
        pointer: createJsonPointer(),
        ...(context === undefined ? {} : { context }),
      }),
      "bundle-validation",
    ),
  ]);
}

function revisionFailure(document?: object): PublishFailure {
  const context = documentContext(document);
  return createPublishFailure([
    annotatePublishErrorDiagnostic(
      createCoreDiagnostic({
        code: "REVISION_MISMATCH",
        message: "The Bundle revision does not match its canonical semantic content.",
        pointer: createJsonPointer(["revision"]),
        ...(context === undefined ? {} : { context }),
      }),
      "bundle-revision",
    ),
  ]);
}

function isPublishFailure(result: PublishCatalogPinningResult): result is PublishFailure {
  try {
    if (
      !hasExactOrdinaryOwnDataShape(result, FAILURE_KEYS) ||
      !Reflect.apply(OBJECT_IS_FROZEN, Object, [result]) ||
      ownDataValue(result, "ok") !== false
    ) {
      return false;
    }
    const stage = ownDataValue<string>(result, "stage");
    const diagnostics = ownDataValue<readonly unknown[]>(result, "diagnostics");
    if (
      typeof stage !== "string" ||
      !PIPELINE_STAGE_SET.has(stage) ||
      !isDenseFrozenArray(diagnostics) ||
      diagnostics.length === 0 ||
      !isRecursivelyFrozenJson(diagnostics)
    ) {
      return false;
    }
    for (let index = 0; index < diagnostics.length; index += 1) {
      const diagnostic = ownDataValue<unknown>(diagnostics, String(index));
      const severity =
        typeof diagnostic === "object" && diagnostic !== null
          ? ownDataValue<string>(diagnostic, "severity")
          : undefined;
      if (
        index === 0 || severity === "error"
          ? !publisherErrorIsAuthentic(diagnostic, stage)
          : !publisherWarningIsAuthentic(diagnostic)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function isPinningSuccess(
  result: PublishCatalogPinningResult,
): result is PublishCatalogPinningSuccess {
  try {
    if (
      !hasExactOrdinaryOwnDataShape(result, PINNING_SUCCESS_KEYS) ||
      !Reflect.apply(OBJECT_IS_FROZEN, Object, [result]) ||
      ownDataValue(result, "catalogsPinned") !== true
    ) {
      return false;
    }
    const diagnostics = ownDataValue<readonly unknown[]>(result, "diagnostics");
    const document = ownDataValue<object>(result, "pinnedDocument");
    const catalogSet = ownDataValue<object>(result, "catalogSet");
    if (!isDenseFrozenArray(diagnostics)) return false;
    for (let index = 0; index < diagnostics.length; index += 1) {
      if (!publisherWarningIsAuthentic(ownDataValue(diagnostics, String(index)))) return false;
    }
    return (
      hasExactOrdinaryOwnDataShape(
        document,
        new Set([...PINNED_DOCUMENT_REQUIRED_KEYS, "extensions"]),
        PINNED_DOCUMENT_REQUIRED_KEYS,
      ) &&
      isRecursivelyFrozenJson(document) &&
      ARRAY_IS_ARRAY(catalogSet) &&
      isRecursivelyFrozenJson(catalogSet)
    );
  } catch {
    return false;
  }
}

function validatorDiagnosticIsAuthentic(value: unknown): value is DesenSemanticDiagnostic {
  return diagnosticEnvelopeIsAuthentic(value, VALIDATOR_EXTENSION_CODES);
}

function isValidatorFailure(result: ValidatorResult): boolean {
  try {
    const diagnostics = ownDataValue<readonly unknown[]>(result, "diagnostics");
    if (!(
      hasExactOrdinaryOwnDataShape(result, VALIDATOR_FAILURE_KEYS) &&
      Reflect.apply(OBJECT_IS_FROZEN, Object, [result]) &&
      ownDataValue(result, "valid") === false &&
      ownDataValue(result, "target") === "bundle" &&
      isDenseFrozenArray(diagnostics) &&
      diagnostics.length > 0 &&
      isDenseFrozenArray(ownDataValue(result, "obligations"))
    )) {
      return false;
    }
    for (let index = 0; index < diagnostics.length; index += 1) {
      if (!validatorDiagnosticIsAuthentic(ownDataValue(diagnostics, String(index)))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isValidatorSuccess(result: ValidatorResult): boolean {
  try {
    const diagnostics = ownDataValue<readonly unknown[]>(result, "diagnostics");
    const value = ownDataValue<object>(result, "value");
    return (
      hasExactOrdinaryOwnDataShape(result, VALIDATOR_SUCCESS_KEYS) &&
      Reflect.apply(OBJECT_IS_FROZEN, Object, [result]) &&
      ownDataValue(result, "valid") === true &&
      ownDataValue(result, "target") === "bundle" &&
      isDenseFrozenArray(diagnostics) &&
      diagnostics.length === 0 &&
      isDenseFrozenArray(ownDataValue(result, "obligations")) &&
      hasExactOrdinaryOwnDataShape(
        value,
        new Set([...BUNDLE_REQUIRED_KEYS, "extensions", "publication"]),
        BUNDLE_REQUIRED_KEYS,
      ) &&
      isRecursivelyFrozenJson(value)
    );
  } catch {
    return false;
  }
}

function relayValidatorFailure(result: ValidatorResult): PublishFailure {
  try {
    if (!isValidatorFailure(result)) return authorityFailure();
    const diagnostics = ownDataValue<readonly DesenSemanticDiagnostic[]>(result, "diagnostics");
    if (diagnostics === undefined) return authorityFailure();
    const annotated = [];
    for (let index = 0; index < diagnostics.length; index += 1) {
      const diagnostic = ownDataValue<DesenSemanticDiagnostic>(diagnostics, String(index));
      if (diagnostic === undefined) return authorityFailure();
      annotated.push(annotatePublishErrorDiagnostic(diagnostic, "bundle-validation"));
    }
    return createPublishFailure(annotated);
  } catch {
    return authorityFailure();
  }
}

function createCandidate(
  pinning: PublishCatalogPinningSuccess,
  revision: string,
): ImmutableJson<DesenBundle> | undefined {
  try {
    const pinned = pinning.pinnedDocument;
    const extensionsDescriptor = Reflect.apply(OBJECT_GET_OWN_PROPERTY_DESCRIPTOR, Object, [
      pinned,
      "extensions",
    ]) as PropertyDescriptor | undefined;
    if (
      extensionsDescriptor !== undefined &&
      (!extensionsDescriptor.enumerable || !("value" in extensionsDescriptor))
    ) {
      return undefined;
    }
    const candidate =
      extensionsDescriptor === undefined
        ? OBJECT_FREEZE({
            kind: pinned.kind,
            desen: pinned.desen,
            id: pinned.id,
            revision,
            sourceDigest: pinned.sourceDigest,
            requires: pinned.requires,
            entry: pinned.entry,
            surfaces: pinned.surfaces,
          })
        : OBJECT_FREEZE({
            kind: pinned.kind,
            desen: pinned.desen,
            id: pinned.id,
            revision,
            sourceDigest: pinned.sourceDigest,
            requires: pinned.requires,
            entry: pinned.entry,
            surfaces: pinned.surfaces,
            extensions: extensionsDescriptor.value as DesenBundle["extensions"],
          });
    return candidate as ImmutableJson<DesenBundle>;
  } catch {
    return undefined;
  }
}

/**
 * Captures one exact own-data terminal publication profile before observing Source or packages.
 *
 * @internal Accessors, inherited members, symbols, extra keys, custom prototypes, negative values,
 * and unsafe integers fail before any caller-controlled publication input is read.
 */
export function normalizePublishBundlePublicationLimits(
  input: unknown,
): Readonly<PublishBundlePublicationLimits> {
  try {
    if (
      typeof input !== "object" ||
      input === null ||
      ARRAY_IS_ARRAY(input) ||
      Reflect.apply(OBJECT_GET_PROTOTYPE_OF, Object, [input]) !== OBJECT_PROTOTYPE
    ) {
      throw new TypeError();
    }
    const keys = Reflect.apply(REFLECT_OWN_KEYS, Reflect, [input]) as PropertyKey[];
    if (
      keys.length !== LIMIT_KEYS.length ||
      keys.some((key) => typeof key !== "string" || !LIMIT_KEY_SET.has(key))
    ) {
      throw new TypeError();
    }
    for (const key of LIMIT_KEYS) {
      const descriptor = Reflect.apply(OBJECT_GET_OWN_PROPERTY_DESCRIPTOR, Object, [input, key]) as
        PropertyDescriptor | undefined;
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new TypeError();
      }
    }
    const catalogPinning = normalizePublishSourceNormalizationLimits(
      ownDataValue(input, "catalogPinning"),
    );
    const maxBundleCanonicalBytes = ownDataValue<number>(input, "maxBundleCanonicalBytes");
    if (!Number.isSafeInteger(maxBundleCanonicalBytes) || (maxBundleCanonicalBytes as number) < 0) {
      throw new TypeError();
    }
    return OBJECT_FREEZE({
      catalogPinning,
      maxBundleCanonicalBytes: maxBundleCanonicalBytes as number,
    });
  } catch {
    throw new TypeError(
      "Bundle-publication limits must be an exact own-data finite non-negative-integer profile.",
    );
  }
}

/**
 * Executes the complete terminal M06-T09 publication profile with an explicit finite limit seam.
 *
 * @internal Tests and deterministic proof tooling use this package-private seam for exact boundary
 * vectors. Product callers receive the fixed two-argument {@link publishDesenSource} API.
 */
export function publishDesenSourceWithLimits(
  rawSourceInput: unknown,
  catalogPackageCandidatesInput: unknown,
  limitInput: Readonly<PublishBundlePublicationLimits> = PUBLISH_BUNDLE_PUBLICATION_LIMITS,
): PublishResult {
  const limits = normalizePublishBundlePublicationLimits(limitInput);
  let pinning: PublishCatalogPinningResult;
  try {
    pinning = preflightPublishCatalogPinning(
      rawSourceInput,
      catalogPackageCandidatesInput,
      limits.catalogPinning,
    );
  } catch {
    return authorityFailure();
  }
  if (!isPinningSuccess(pinning)) {
    return isPublishFailure(pinning) ? pinning : authorityFailure();
  }

  let provisionalRevision: string;
  try {
    provisionalRevision = calculateDesenBundleRevision(pinning.pinnedDocument);
  } catch {
    return revisionFailure(pinning.pinnedDocument);
  }
  if (!isSha256Digest(provisionalRevision)) {
    return revisionFailure(pinning.pinnedDocument);
  }

  const candidate = createCandidate(pinning, provisionalRevision);
  if (candidate === undefined) return authorityFailure();

  let candidateBytes: Uint8Array;
  try {
    const canonicalBytes = canonicalizeJsonBytes(candidate);
    if (!isAuthenticCanonicalBytes(canonicalBytes)) return authorityFailure();
    candidateBytes = canonicalBytes;
  } catch {
    return authorityFailure();
  }
  if (candidateBytes.byteLength > limits.maxBundleCanonicalBytes) {
    return bundleLimitFailure(candidate);
  }

  let validation: ValidatorResult;
  try {
    validation = validateDesenBundleExecutionContracts(candidate, pinning.catalogSet);
  } catch {
    return authorityFailure();
  }
  if (!isValidatorSuccess(validation)) {
    return relayValidatorFailure(validation);
  }

  const bundle = ownDataValue<ImmutableJson<DesenBundle>>(validation, "value");
  if (
    bundle === undefined ||
    bundle === candidate ||
    !jsonGraphsAreDisjoint(candidate as object, bundle as object)
  ) {
    return authorityFailure();
  }
  let validatedBytes: Uint8Array;
  try {
    const canonicalBytes = canonicalizeJsonBytes(bundle);
    if (!isAuthenticCanonicalBytes(canonicalBytes)) return authorityFailure();
    validatedBytes = canonicalBytes;
  } catch {
    return authorityFailure();
  }
  if (!byteEqual(candidateBytes, validatedBytes)) return authorityFailure();
  if (validatedBytes.byteLength > limits.maxBundleCanonicalBytes) {
    return bundleLimitFailure(bundle);
  }

  let closedRevision: string;
  try {
    closedRevision = calculateDesenBundleRevision(bundle);
  } catch {
    return revisionFailure(bundle);
  }
  const validatedRevision = ownDataValue<string>(bundle, "revision");
  if (
    !isSha256Digest(closedRevision) ||
    !isSha256Digest(validatedRevision) ||
    provisionalRevision !== validatedRevision ||
    closedRevision !== validatedRevision
  ) {
    return revisionFailure(bundle);
  }

  return OBJECT_FREEZE({
    ok: true,
    bundle,
    diagnostics: pinning.diagnostics,
  });
}

/**
 * Publishes raw DESEN Source JSON into one complete immutable, revision-closed Bundle.
 *
 * @remarks The operation is synchronous, deterministic, platform-neutral, and side-effect-free.
 * It performs no filesystem, network, clock, signing, runtime, host, adapter, editor, or deployment
 * work. Success exposes only the Validator's independent frozen Bundle snapshot and inherited
 * warnings; every failure structurally exposes no Bundle or intermediate authority.
 */
export function publishDesenSource(
  rawSource: string,
  catalogPackages: readonly PublishCatalogPackageCandidate[],
): PublishResult {
  return publishDesenSourceWithLimits(
    rawSource,
    catalogPackages,
    PUBLISH_BUNDLE_PUBLICATION_LIMITS,
  );
}
