import {
  calculateDesenSourceDigest,
  createCoreDiagnostic,
  createJsonPointer,
  isSha256Digest,
} from "@desen/protocol";

import type {
  DesenExecutionContractObligation,
  DesenPreparedSourceFoundation,
  DesenValidatedExecutionCatalogSet,
  ImmutableJson,
} from "@desen/validator";

import type { PublishResolvedCatalogPackage } from "./catalog-resolution.js";
import { annotatePublishErrorDiagnostic, createPublishFailure } from "./publish-diagnostics.js";
import { PUBLISH_PIPELINE_STAGES } from "./publish-result.js";
import type {
  PublishDiagnostic,
  PublishFailure,
  PublishWarningDiagnostic,
} from "./publish-result.js";
import {
  PUBLISH_SOURCE_NORMALIZATION_LIMITS,
  normalizePublishSourceNormalizationLimits,
  preflightPublishSourceNormalization,
} from "./source-normalization.js";
import type {
  PublishNormalizedDocument,
  PublishSourceNormalizationLimits,
  PublishSourceNormalizationResult,
  PublishSourceNormalizationSuccess,
} from "./source-normalization.js";
import type {
  PublishPreservedSourceDocument,
  PublishSourceTraceability,
} from "./source-preservation.js";

type SourceCatalogRequirement = DesenPreparedSourceFoundation["catalogs"][number];

/**
 * One exact immutable Catalog package requirement written into a production document.
 *
 * @remarks Identity, target, and digest come only from the exact package selected by M06-T02.
 * Optional extensions retain their exact authenticated Source value and remain opaque. Source
 * discovery `location` is deliberately absent.
 */
export interface PublishPinnedCatalogRequirement {
  readonly id: string;
  readonly version: string;
  readonly target: string;
  readonly digest: string;
  readonly extensions?: SourceCatalogRequirement["extensions"];
}

/**
 * Nonterminal production document after exact Source-digest carry and Catalog tuple pinning.
 *
 * @remarks This is still not a DESEN Bundle: M06-T09 owns complete Bundle validation and revision
 * calculation. `publication` is also absent because signing and release metadata are later,
 * non-semantic concerns.
 */
export interface PublishCatalogPinnedDocument {
  readonly kind: PublishNormalizedDocument["kind"];
  readonly desen: PublishNormalizedDocument["desen"];
  readonly id: PublishNormalizedDocument["id"];
  readonly sourceDigest: string;
  readonly requires: Readonly<{
    readonly catalogs: readonly PublishPinnedCatalogRequirement[];
  }>;
  readonly entry: PublishNormalizedDocument["entry"];
  readonly surfaces: PublishNormalizedDocument["surfaces"];
  readonly extensions?: PublishNormalizedDocument["extensions"];
}

/**
 * Complete nonterminal M06-T08 authority prepared for Bundle validation and revision calculation.
 *
 * @remarks Every M06-T07 authority crosses by exact runtime identity. `pinnedDocument` adds only
 * the independently authenticated Source digest and one exact package tuple for each Source
 * requirement position. It grants no Bundle, revision, publication, runtime, host, or adapter
 * authority.
 */
export interface PublishCatalogPinningSuccess {
  readonly catalogsPinned: true;
  readonly sourceDigest: string;
  readonly source: DesenPreparedSourceFoundation;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly packages: readonly PublishResolvedCatalogPackage[];
  readonly requirementPackageIndexes: readonly number[];
  readonly diagnostics: readonly PublishWarningDiagnostic[];
  readonly obligations: readonly DesenExecutionContractObligation[];
  readonly preservedDocument: Readonly<PublishPreservedSourceDocument>;
  readonly sourceCatalogRequirements: DesenPreparedSourceFoundation["catalogs"];
  readonly traceability: Readonly<PublishSourceTraceability>;
  readonly normalizedDocument: ImmutableJson<PublishNormalizedDocument>;
  readonly pinnedDocument: ImmutableJson<PublishCatalogPinnedDocument>;
}

/** Catalog pinning either prepares one complete authority or exposes no partial value. */
export type PublishCatalogPinningResult = PublishCatalogPinningSuccess | PublishFailure;

type PinningBuildResult =
  | Readonly<{
      status: "success";
      document: ImmutableJson<PublishCatalogPinnedDocument>;
    }>
  | Readonly<{
      status: "authority-invalid";
      requirementIndex?: number;
      digestMismatch: boolean;
    }>;

const OBJECT_FREEZE = Object.freeze;
const OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const OBJECT_IS_FROZEN = Object.isFrozen;
const OBJECT_PROTOTYPE = Object.prototype;
const ARRAY_IS_ARRAY = Array.isArray;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const REFLECT_OWN_KEYS = Reflect.ownKeys;

const SOURCE_DIGEST_STAGE = "source-digest" as const;
const CATALOG_PINNING_STAGE = "catalog-pinning" as const;
const NORMALIZATION_SUCCESS_KEYS: ReadonlySet<string> = new Set([
  "catalogSet",
  "diagnostics",
  "normalizedDocument",
  "obligations",
  "packages",
  "preservedDocument",
  "requirementPackageIndexes",
  "source",
  "sourceCatalogRequirements",
  "sourceDigest",
  "sourceNormalized",
  "traceability",
]);
const NORMALIZED_DOCUMENT_REQUIRED_KEYS: ReadonlySet<string> = new Set([
  "desen",
  "entry",
  "id",
  "kind",
  "surfaces",
]);
const SOURCE_REQUIREMENT_KEYS: ReadonlySet<string> = new Set([
  "extensions",
  "id",
  "location",
  "target",
  "version",
]);
const RESOLVED_PACKAGE_KEYS: ReadonlySet<string> = new Set([
  "catalog",
  "id",
  "packageDigest",
  "target",
  "version",
]);
const FAILURE_KEYS: ReadonlySet<string> = new Set(["diagnostics", "ok", "stage"]);
const PIPELINE_STAGE_SET: ReadonlySet<string> = new Set(PUBLISH_PIPELINE_STAGES);

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
    if (!ARRAY_IS_ARRAY(value) || !Reflect.apply(OBJECT_IS_FROZEN, Object, [value])) return false;
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

function isPublishFailure(result: PublishSourceNormalizationResult): result is PublishFailure {
  try {
    if (
      !hasExactOrdinaryOwnDataShape(result, FAILURE_KEYS) ||
      !Reflect.apply(OBJECT_IS_FROZEN, Object, [result]) ||
      ownDataValue(result, "ok") !== false
    ) {
      return false;
    }
    const stage = ownDataValue<string>(result, "stage");
    const diagnostics = ownDataValue<readonly PublishDiagnostic[]>(result, "diagnostics");
    if (
      typeof stage !== "string" ||
      !PIPELINE_STAGE_SET.has(stage) ||
      !isDenseFrozenArray(diagnostics) ||
      diagnostics.length === 0
    ) {
      return false;
    }
    const first = ownDataValue<PublishDiagnostic>(diagnostics, "0");
    return (
      typeof first === "object" &&
      first !== null &&
      ownDataValue(first, "severity") === "error" &&
      ownDataValue(first, "stage") === stage
    );
  } catch {
    return false;
  }
}

function isSourceNormalizationSuccess(
  result: PublishSourceNormalizationResult,
): result is PublishSourceNormalizationSuccess {
  try {
    return (
      hasExactOrdinaryOwnDataShape(result, NORMALIZATION_SUCCESS_KEYS) &&
      Reflect.apply(OBJECT_IS_FROZEN, Object, [result]) &&
      ownDataValue(result, "sourceNormalized") === true
    );
  } catch {
    return false;
  }
}

function documentContext(source: DesenPreparedSourceFoundation | undefined) {
  if (source === undefined) return undefined;
  try {
    const documentId = ownDataValue<string>(source, "id");
    return typeof documentId === "string" ? OBJECT_FREEZE({ documentId }) : undefined;
  } catch {
    return undefined;
  }
}

function sourceDigestFailure(source?: DesenPreparedSourceFoundation): PublishFailure {
  const context = documentContext(source);
  return createPublishFailure([
    annotatePublishErrorDiagnostic(
      createCoreDiagnostic({
        code: "SOURCE_DIGEST_MISMATCH",
        message: "The authenticated Source digest does not match the carried publication digest.",
        pointer: createJsonPointer(["sourceDigest"]),
        ...(context === undefined ? {} : { context }),
      }),
      SOURCE_DIGEST_STAGE,
    ),
  ]);
}

function catalogPinningFailure(
  source?: DesenPreparedSourceFoundation,
  requirementIndex?: number,
  digestMismatch = false,
): PublishFailure {
  const context = documentContext(source);
  return createPublishFailure([
    annotatePublishErrorDiagnostic(
      createCoreDiagnostic({
        code: digestMismatch ? "CATALOG_DIGEST_MISMATCH" : "CATALOG_VERSION_UNAVAILABLE",
        message: digestMismatch
          ? "The exact selected Catalog package digest could not be authenticated for pinning."
          : "The exact selected Catalog package tuple could not be authenticated for pinning.",
        pointer:
          requirementIndex === undefined
            ? createJsonPointer(["requires", "catalogs"])
            : createJsonPointer(["requires", "catalogs", requirementIndex]),
        ...(context === undefined ? {} : { context }),
      }),
      CATALOG_PINNING_STAGE,
    ),
  ]);
}

function hasNormalizedDocumentAuthority(normalization: PublishSourceNormalizationSuccess): boolean {
  const document = normalization.normalizedDocument;
  try {
    if (
      !hasExactOrdinaryOwnDataShape(
        document,
        new Set([...NORMALIZED_DOCUMENT_REQUIRED_KEYS, "extensions"]),
        NORMALIZED_DOCUMENT_REQUIRED_KEYS,
      ) ||
      !Reflect.apply(OBJECT_IS_FROZEN, Object, [document]) ||
      ownDataValue(document, "kind") !== "desen.bundle" ||
      ownDataValue(document, "desen") !== "0.1.0" ||
      typeof ownDataValue(document, "id") !== "string" ||
      typeof ownDataValue(document, "entry") !== "string"
    ) {
      return false;
    }
    const surfaces = ownDataValue<object>(document, "surfaces");
    return typeof surfaces === "object" && surfaces !== null && !ARRAY_IS_ARRAY(surfaces);
  } catch {
    return false;
  }
}

function buildPinnedDocument(normalization: PublishSourceNormalizationSuccess): PinningBuildResult {
  try {
    const requirements = normalization.sourceCatalogRequirements;
    const indexes = normalization.requirementPackageIndexes;
    const packages = normalization.packages;
    const catalogSet = normalization.catalogSet;
    const sourceCatalogs = ownDataValue<DesenPreparedSourceFoundation["catalogs"]>(
      normalization.source,
      "catalogs",
    );

    if (
      requirements !== sourceCatalogs ||
      !isDenseFrozenArray(requirements) ||
      !isDenseFrozenArray(indexes) ||
      !isDenseFrozenArray(packages) ||
      !isDenseFrozenArray(catalogSet) ||
      requirements.length !== indexes.length ||
      packages.length !== catalogSet.length ||
      packages.length === 0 ||
      !hasNormalizedDocumentAuthority(normalization)
    ) {
      return OBJECT_FREEZE({ status: "authority-invalid", digestMismatch: false });
    }

    const pinned: PublishPinnedCatalogRequirement[] = [];
    const firstSeenPackageIndexes = new Set<number>();
    for (let requirementIndex = 0; requirementIndex < requirements.length; requirementIndex += 1) {
      const requirement = ownDataValue<SourceCatalogRequirement>(
        requirements,
        String(requirementIndex),
      );
      const packageIndex = ownDataValue<number>(indexes, String(requirementIndex));
      if (
        requirement === undefined ||
        !NUMBER_IS_SAFE_INTEGER(packageIndex) ||
        (packageIndex as number) < 0 ||
        (packageIndex as number) >= packages.length
      ) {
        return OBJECT_FREEZE({
          status: "authority-invalid",
          requirementIndex,
          digestMismatch: false,
        });
      }
      if (!firstSeenPackageIndexes.has(packageIndex as number)) {
        if ((packageIndex as number) !== firstSeenPackageIndexes.size) {
          return OBJECT_FREEZE({
            status: "authority-invalid",
            requirementIndex,
            digestMismatch: false,
          });
        }
        firstSeenPackageIndexes.add(packageIndex as number);
      }

      const selectedPackage = ownDataValue<PublishResolvedCatalogPackage>(
        packages,
        String(packageIndex),
      );
      const selectedCatalog = ownDataValue<DesenValidatedExecutionCatalogSet[number]>(
        catalogSet,
        String(packageIndex),
      );
      if (
        selectedPackage === undefined ||
        selectedCatalog === undefined ||
        !hasExactOrdinaryOwnDataShape(
          requirement,
          SOURCE_REQUIREMENT_KEYS,
          new Set(["id", "version"]),
        ) ||
        !Reflect.apply(OBJECT_IS_FROZEN, Object, [requirement]) ||
        !hasExactOrdinaryOwnDataShape(selectedPackage, RESOLVED_PACKAGE_KEYS) ||
        !Reflect.apply(OBJECT_IS_FROZEN, Object, [selectedPackage]) ||
        selectedPackage.catalog !== selectedCatalog
      ) {
        return OBJECT_FREEZE({
          status: "authority-invalid",
          requirementIndex,
          digestMismatch: false,
        });
      }

      const requirementId = ownDataValue<string>(requirement, "id");
      const requirementVersion = ownDataValue<string>(requirement, "version");
      const requirementTargetDescriptor = Reflect.apply(
        OBJECT_GET_OWN_PROPERTY_DESCRIPTOR,
        Object,
        [requirement, "target"],
      ) as PropertyDescriptor | undefined;
      const requirementTarget =
        requirementTargetDescriptor === undefined
          ? undefined
          : ownDataValue<string>(requirement, "target");
      const selectedId = ownDataValue<string>(selectedPackage, "id");
      const selectedVersion = ownDataValue<string>(selectedPackage, "version");
      const selectedTarget = ownDataValue<string>(selectedPackage, "target");
      const selectedDigest = ownDataValue<string>(selectedPackage, "packageDigest");
      const catalogId = ownDataValue<string>(selectedCatalog, "id");
      const catalogVersion = ownDataValue<string>(selectedCatalog, "version");
      const catalogTarget = ownDataValue<string>(selectedCatalog, "target");
      const catalogDigest = ownDataValue<string>(selectedCatalog, "packageDigest");

      if (
        typeof requirementId !== "string" ||
        typeof requirementVersion !== "string" ||
        (requirementTargetDescriptor !== undefined && typeof requirementTarget !== "string") ||
        typeof selectedId !== "string" ||
        typeof selectedVersion !== "string" ||
        typeof selectedTarget !== "string" ||
        requirementId !== selectedId ||
        requirementVersion !== selectedVersion ||
        (requirementTarget !== undefined && requirementTarget !== selectedTarget) ||
        selectedId !== catalogId ||
        selectedVersion !== catalogVersion ||
        selectedTarget !== catalogTarget
      ) {
        return OBJECT_FREEZE({
          status: "authority-invalid",
          requirementIndex,
          digestMismatch: false,
        });
      }
      if (
        typeof selectedDigest !== "string" ||
        !isSha256Digest(selectedDigest) ||
        selectedDigest !== catalogDigest
      ) {
        return OBJECT_FREEZE({
          status: "authority-invalid",
          requirementIndex,
          digestMismatch: true,
        });
      }

      const extensionsDescriptor = Reflect.apply(OBJECT_GET_OWN_PROPERTY_DESCRIPTOR, Object, [
        requirement,
        "extensions",
      ]) as PropertyDescriptor | undefined;
      if (
        extensionsDescriptor !== undefined &&
        (!extensionsDescriptor.enumerable ||
          !("value" in extensionsDescriptor) ||
          typeof extensionsDescriptor.value !== "object" ||
          extensionsDescriptor.value === null ||
          ARRAY_IS_ARRAY(extensionsDescriptor.value) ||
          !Reflect.apply(OBJECT_IS_FROZEN, Object, [extensionsDescriptor.value]))
      ) {
        return OBJECT_FREEZE({
          status: "authority-invalid",
          requirementIndex,
          digestMismatch: false,
        });
      }

      pinned.push(
        extensionsDescriptor === undefined
          ? OBJECT_FREEZE({
              id: selectedId,
              version: selectedVersion,
              target: selectedTarget,
              digest: selectedDigest,
            })
          : OBJECT_FREEZE({
              id: selectedId,
              version: selectedVersion,
              target: selectedTarget,
              digest: selectedDigest,
              extensions: extensionsDescriptor.value as SourceCatalogRequirement["extensions"],
            }),
      );
    }

    if (firstSeenPackageIndexes.size !== packages.length) {
      return OBJECT_FREEZE({ status: "authority-invalid", digestMismatch: false });
    }

    const catalogs = OBJECT_FREEZE(pinned);
    const requires = OBJECT_FREEZE({ catalogs });
    const normalized = normalization.normalizedDocument;
    const extensionsDescriptor = Reflect.apply(OBJECT_GET_OWN_PROPERTY_DESCRIPTOR, Object, [
      normalized,
      "extensions",
    ]) as PropertyDescriptor | undefined;
    const document =
      extensionsDescriptor === undefined
        ? OBJECT_FREEZE({
            kind: normalized.kind,
            desen: normalized.desen,
            id: normalized.id,
            sourceDigest: normalization.sourceDigest,
            requires,
            entry: normalized.entry,
            surfaces: normalized.surfaces,
          })
        : OBJECT_FREEZE({
            kind: normalized.kind,
            desen: normalized.desen,
            id: normalized.id,
            sourceDigest: normalization.sourceDigest,
            requires,
            entry: normalized.entry,
            surfaces: normalized.surfaces,
            extensions: extensionsDescriptor.value as PublishNormalizedDocument["extensions"],
          });
    return OBJECT_FREEZE({
      status: "success",
      document: document as ImmutableJson<PublishCatalogPinnedDocument>,
    });
  } catch {
    return OBJECT_FREEZE({ status: "authority-invalid", digestMismatch: false });
  }
}

/**
 * Runs M06-T07 exactly once, authenticates its exact Source digest, and pins Catalog requirements.
 *
 * @internal The function accepts raw Source JSON and one closed package-observation inventory,
 * never a caller-created T07 shell. Digest authentication consumes the exact T07 Source and occurs
 * before tuple construction. Positional alignment preserves Source requirement order and duplicate
 * positions; optional target omission is filled only from the selected exact package. Discovery
 * locations are never read or copied. This seam performs no Bundle validation, revision
 * calculation, terminal publication, package-byte I/O, target-specific work, signing, or release.
 */
export function preflightPublishCatalogPinning(
  rawSourceInput: unknown,
  catalogPackageCandidatesInput: unknown,
  limitInput: Readonly<PublishSourceNormalizationLimits> = PUBLISH_SOURCE_NORMALIZATION_LIMITS,
): PublishCatalogPinningResult {
  const limits = normalizePublishSourceNormalizationLimits(limitInput);
  const normalization = preflightPublishSourceNormalization(
    rawSourceInput,
    catalogPackageCandidatesInput,
    limits,
  );
  if (!isSourceNormalizationSuccess(normalization)) {
    return isPublishFailure(normalization) ? normalization : catalogPinningFailure();
  }

  let authenticatedSourceDigest: string;
  try {
    authenticatedSourceDigest = calculateDesenSourceDigest(normalization.source);
  } catch {
    return sourceDigestFailure(normalization.source);
  }
  if (
    !isSha256Digest(authenticatedSourceDigest) ||
    !isSha256Digest(normalization.sourceDigest) ||
    authenticatedSourceDigest !== normalization.sourceDigest
  ) {
    return sourceDigestFailure(normalization.source);
  }

  const pinned = buildPinnedDocument(normalization);
  if (pinned.status !== "success") {
    return catalogPinningFailure(
      normalization.source,
      pinned.requirementIndex,
      pinned.digestMismatch,
    );
  }

  return OBJECT_FREEZE({
    catalogsPinned: true,
    sourceDigest: normalization.sourceDigest,
    source: normalization.source,
    catalogSet: normalization.catalogSet,
    packages: normalization.packages,
    requirementPackageIndexes: normalization.requirementPackageIndexes,
    diagnostics: normalization.diagnostics,
    obligations: normalization.obligations,
    preservedDocument: normalization.preservedDocument,
    sourceCatalogRequirements: normalization.sourceCatalogRequirements,
    traceability: normalization.traceability,
    normalizedDocument: normalization.normalizedDocument,
    pinnedDocument: pinned.document,
  });
}
