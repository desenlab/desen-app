import {
  calculateDesenSourceDigest,
  canonicalizeJson,
  canonicalizeJsonBytes,
  createJsonPointer,
  isSha256Digest,
} from "@desen/protocol";

import type { DesenDiagnostic } from "@desen/protocol";
import type {
  DesenExecutionContractObligation,
  DesenPreparedSourceFoundation,
  DesenValidatedExecutionCatalogSet,
  ImmutableJson,
} from "@desen/validator";

import type { PublishResolvedCatalogPackage } from "./catalog-resolution.js";
import { annotatePublishErrorDiagnostic, createPublishFailure } from "./publish-diagnostics.js";
import type { PublishFailure, PublishWarningDiagnostic } from "./publish-result.js";
import {
  PUBLISH_SOURCE_PRESERVATION_LIMITS,
  normalizePublishSourcePreservationLimits,
  preflightPublishSourcePreservation,
} from "./source-preservation.js";
import type {
  PublishPreservedSourceDocument,
  PublishSourcePreservationLimits,
  PublishSourcePreservationResult,
  PublishSourcePreservationSuccess,
  PublishSourceTraceability,
} from "./source-preservation.js";

/** Package-private diagnostic for cumulative digest or normalization-authority drift. */
export const SOURCE_NORMALIZATION_AUTHORITY_INVALID_CODE =
  "run.desen.publisher/SOURCE_NORMALIZATION_AUTHORITY_INVALID" as const;

/** Package-private diagnostic for finite normalized-document exhaustion. */
export const SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE =
  "run.desen.publisher/SOURCE_NORMALIZATION_LIMIT_EXCEEDED" as const;

/**
 * Finite output profile for the package-private M06-T07 normalization boundary.
 *
 * @remarks The nested profile is owned by M06-T06. The remaining ceiling measures the exact UTF-8
 * byte length of the RFC 8785 canonical normalized document. It is project-profile input rather
 * than a universal DESEN protocol constant.
 */
export interface PublishSourceNormalizationLimits {
  /** Exact finite profile inherited by M06-T01 through M06-T06. */
  readonly sourcePreservation: Readonly<PublishSourcePreservationLimits>;
  /** Maximum canonical UTF-8 bytes admitted to the complete normalized document. */
  readonly maxNormalizedDocumentCanonicalBytes: number;
}

/**
 * Default finite Publisher profile for authoring removal and deterministic normalization.
 *
 * @remarks The two-MiB ceiling matches the DESEN 0.1.0 Reference Profile's final uncompressed
 * Bundle limit. Later stages must still account for exact Catalog tuples, digests, and revision
 * fields before claiming that the terminal Bundle satisfies that profile.
 */
export const PUBLISH_SOURCE_NORMALIZATION_LIMITS: Readonly<PublishSourceNormalizationLimits> =
  Object.freeze({
    sourcePreservation: PUBLISH_SOURCE_PRESERVATION_LIMITS,
    maxNormalizedDocumentCanonicalBytes: 2_097_152,
  });

/**
 * Detached production document after root authoring removal and minimal normalization.
 *
 * @remarks This is deliberately not a DESEN Bundle. Exact Catalog requirements, the already
 * calculated Source digest, revision, and optional publication metadata remain outside this
 * document. The nested data is an RFC 8785 round-trip of the M06-T06 production projection. Its
 * canonical serialization is stable even though JSON object member order is non-semantic and
 * JavaScript may enumerate integer-like keys specially. Every semantic array, identifier,
 * condition, literal, capability id, and opaque extension value retains its parsed JSON meaning.
 */
export interface PublishNormalizedDocument {
  readonly kind: "desen.bundle";
  readonly desen: PublishPreservedSourceDocument["desen"];
  readonly id: PublishPreservedSourceDocument["id"];
  readonly entry: PublishPreservedSourceDocument["entry"];
  readonly surfaces: PublishPreservedSourceDocument["surfaces"];
  readonly extensions?: PublishPreservedSourceDocument["extensions"];
}

/**
 * Complete nonterminal digest and normalization authority prepared for exact Catalog pinning.
 *
 * @remarks Every M06-T06 authority crosses by exact runtime identity. `sourceDigest` is calculated
 * from the exact authenticated Source before authoring removal and normalization.
 * `normalizedDocument` is then detached, recursively frozen, stripped of top-level authoring, and
 * canonicalized. The Source remains available as the authenticated digest authority. This result
 * grants no exact Catalog tuple, Bundle, revision, target, runtime, host, or adapter authority.
 */
export interface PublishSourceNormalizationSuccess {
  readonly sourceNormalized: true;
  /** Normative digest of the exact authenticated Source with only root authoring omitted. */
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
}

/** Source normalization either prepares one complete authority or exposes no partials. */
export type PublishSourceNormalizationResult = PublishSourceNormalizationSuccess | PublishFailure;

const NORMALIZATION_LIMIT_KEYS = Object.freeze([
  "sourcePreservation",
  "maxNormalizedDocumentCanonicalBytes",
] as const);
const NORMALIZATION_LIMIT_KEY_SET: ReadonlySet<string> = new Set(NORMALIZATION_LIMIT_KEYS);
const NORMALIZED_DOCUMENT_REQUIRED_KEYS: ReadonlySet<string> = new Set([
  "desen",
  "entry",
  "id",
  "surfaces",
]);
const OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const OBJECT_PROTOTYPE = Object.prototype;
const SOURCE_DIGEST_STAGE = "source-digest" as const;
const NORMALIZATION_STAGE = "normalization" as const;

function hasOrdinaryObjectPrototype(value: object): boolean {
  return Reflect.apply(OBJECT_GET_PROTOTYPE_OF, Object, [value]) === OBJECT_PROTOTYPE;
}

function ownDataValue<Value>(object: object, key: PropertyKey): Value | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && "value" in descriptor
    ? (descriptor.value as Value)
    : undefined;
}

function isSourcePreservationSuccess(
  result: PublishSourcePreservationResult,
): result is PublishSourcePreservationSuccess {
  return ownDataValue(result, "preservationPrepared") === true;
}

/**
 * Captures an exact own-data normalization profile before Source or Catalog-candidate observation.
 *
 * @internal Accessors, inherited members, symbols, extra keys, null/custom prototypes, negative or
 * unsafe integers are rejected. Zero remains meaningful for exact boundary and hostile tests. The
 * nested M06-T06 profile is normalized by its owning boundary.
 */
export function normalizePublishSourceNormalizationLimits(
  input: unknown,
): Readonly<PublishSourceNormalizationLimits> {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) throw new TypeError();
    if (!hasOrdinaryObjectPrototype(input)) throw new TypeError();
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== NORMALIZATION_LIMIT_KEYS.length ||
      keys.some((key) => typeof key !== "string" || !NORMALIZATION_LIMIT_KEY_SET.has(key))
    ) {
      throw new TypeError();
    }

    for (const key of NORMALIZATION_LIMIT_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new TypeError();
      }
    }

    const sourcePreservation = normalizePublishSourcePreservationLimits(
      ownDataValue(input, "sourcePreservation"),
    );
    const maxNormalizedDocumentCanonicalBytes = ownDataValue<number>(
      input,
      "maxNormalizedDocumentCanonicalBytes",
    );
    if (
      !Number.isSafeInteger(maxNormalizedDocumentCanonicalBytes) ||
      (maxNormalizedDocumentCanonicalBytes as number) < 0
    ) {
      throw new TypeError();
    }

    return Object.freeze({
      sourcePreservation,
      maxNormalizedDocumentCanonicalBytes: maxNormalizedDocumentCanonicalBytes as number,
    });
  } catch {
    throw new TypeError(
      "Source-normalization limits must be an exact own-data finite non-negative-integer profile.",
    );
  }
}

function normalizationDiagnostic(
  code:
    | typeof SOURCE_NORMALIZATION_AUTHORITY_INVALID_CODE
    | typeof SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE,
  message: string,
): Readonly<DesenDiagnostic<typeof code>> {
  return Object.freeze({ code, message, pointer: createJsonPointer() });
}

function normalizationAuthorityFailure(
  stage: typeof SOURCE_DIGEST_STAGE | typeof NORMALIZATION_STAGE,
): PublishFailure {
  return createPublishFailure([
    annotatePublishErrorDiagnostic(
      normalizationDiagnostic(
        SOURCE_NORMALIZATION_AUTHORITY_INVALID_CODE,
        "Source normalization could not authenticate its complete publication authority.",
      ),
      stage,
    ),
  ]);
}

function normalizationLimitFailure(): PublishFailure {
  return createPublishFailure([
    annotatePublishErrorDiagnostic(
      normalizationDiagnostic(
        SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE,
        "The normalized production document exceeded the finite Publisher profile.",
      ),
      NORMALIZATION_STAGE,
    ),
  ]);
}

function normalizedDocumentProjection(
  preserved: Readonly<PublishPreservedSourceDocument>,
): PublishNormalizedDocument | undefined {
  try {
    const keys = Reflect.ownKeys(preserved);
    if (
      keys.some((key) => typeof key !== "string") ||
      keys.some(
        (key) =>
          typeof key === "string" &&
          !NORMALIZED_DOCUMENT_REQUIRED_KEYS.has(key) &&
          key !== "extensions",
      )
    ) {
      return undefined;
    }

    for (const key of NORMALIZED_DOCUMENT_REQUIRED_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(preserved, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
    }
    const extensionsDescriptor = Object.getOwnPropertyDescriptor(preserved, "extensions");
    if (
      extensionsDescriptor !== undefined &&
      (!extensionsDescriptor.enumerable || !("value" in extensionsDescriptor))
    ) {
      return undefined;
    }

    const desen = ownDataValue<PublishPreservedSourceDocument["desen"]>(preserved, "desen");
    const entry = ownDataValue<string>(preserved, "entry");
    const id = ownDataValue<string>(preserved, "id");
    const surfaces = ownDataValue<PublishPreservedSourceDocument["surfaces"]>(
      preserved,
      "surfaces",
    );
    if (
      desen !== "0.1.0" ||
      typeof entry !== "string" ||
      typeof id !== "string" ||
      typeof surfaces !== "object" ||
      surfaces === null ||
      Array.isArray(surfaces)
    ) {
      return undefined;
    }

    return extensionsDescriptor === undefined
      ? { kind: "desen.bundle", desen, id, entry, surfaces }
      : {
          kind: "desen.bundle",
          desen,
          id,
          entry,
          surfaces,
          extensions: extensionsDescriptor.value as PublishPreservedSourceDocument["extensions"],
        };
  } catch {
    return undefined;
  }
}

function deepFreezeDetachedJson<Value>(root: Value): ImmutableJson<Value> {
  const pending: object[] = [];
  const containers: object[] = [];
  if (typeof root === "object" && root !== null) pending.push(root);

  while (pending.length > 0) {
    const container = pending.pop();
    if (container === undefined) throw new TypeError("Detached JSON traversal failed.");
    containers.push(container);

    if (Array.isArray(container)) {
      const keys = Reflect.ownKeys(container);
      if (
        keys.length !== container.length + 1 ||
        keys.some(
          (key) =>
            typeof key !== "string" ||
            (key !== "length" &&
              (!/^(?:0|[1-9][0-9]*)$/u.test(key) ||
                Number(key) >= container.length ||
                String(Number(key)) !== key)),
        )
      ) {
        throw new TypeError("Detached JSON contains a non-dense array.");
      }
      for (let index = 0; index < container.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(container, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          throw new TypeError("Detached JSON contains a non-data array entry.");
        }
        if (typeof descriptor.value === "object" && descriptor.value !== null) {
          pending.push(descriptor.value as object);
        }
      }
    } else {
      if (!hasOrdinaryObjectPrototype(container)) {
        throw new TypeError("Detached JSON contains a non-JSON object.");
      }
      for (const key of Reflect.ownKeys(container)) {
        if (typeof key !== "string") throw new TypeError("Detached JSON contains a symbol key.");
        const descriptor = Object.getOwnPropertyDescriptor(container, key);
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          throw new TypeError("Detached JSON contains a non-data property.");
        }
        if (typeof descriptor.value === "object" && descriptor.value !== null) {
          pending.push(descriptor.value as object);
        }
      }
    }
  }

  for (let index = containers.length - 1; index >= 0; index -= 1) {
    Object.freeze(containers[index]);
  }
  return root as ImmutableJson<Value>;
}

function normalizeDocument(
  preserved: Readonly<PublishPreservedSourceDocument>,
  maximumCanonicalBytes: number,
):
  | Readonly<{ status: "success"; value: ImmutableJson<PublishNormalizedDocument> }>
  | Readonly<{ status: "authority-invalid" | "limit-exceeded" }> {
  try {
    const projection = normalizedDocumentProjection(preserved);
    if (projection === undefined) return Object.freeze({ status: "authority-invalid" });

    const canonical = canonicalizeJson(projection);
    if (canonicalizeJsonBytes(projection).byteLength > maximumCanonicalBytes) {
      return Object.freeze({ status: "limit-exceeded" });
    }
    const parsed = JSON.parse(canonical) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return Object.freeze({ status: "authority-invalid" });
    }
    const normalized = deepFreezeDetachedJson(
      parsed as PublishNormalizedDocument,
    ) as ImmutableJson<PublishNormalizedDocument>;
    return Object.freeze({ status: "success", value: normalized });
  } catch {
    return Object.freeze({ status: "authority-invalid" });
  }
}

/**
 * Runs M06-T06 exactly once, calculates the Source digest, removes only root authoring, and
 * minimally normalizes production data in that exact normative order.
 *
 * @internal Digest calculation consumes the exact authenticated Source and omits only its root
 * authoring member through the protocol helper. The Source itself is not mutated. Authoring removal
 * then consumes only M06-T06's production-field projection. RFC 8785 canonicalization creates one
 * detached, recursively frozen document with stable canonical serialization and unchanged
 * semantic-array order. This seam performs no exact Catalog pinning, Bundle validation, revision
 * calculation, terminal publication, or target-specific work.
 */
export function preflightPublishSourceNormalization(
  rawSourceInput: unknown,
  catalogPackageCandidatesInput: unknown,
  limitInput: Readonly<PublishSourceNormalizationLimits> = PUBLISH_SOURCE_NORMALIZATION_LIMITS,
): PublishSourceNormalizationResult {
  const limits = normalizePublishSourceNormalizationLimits(limitInput);
  const preservation = preflightPublishSourcePreservation(
    rawSourceInput,
    catalogPackageCandidatesInput,
    limits.sourcePreservation,
  );
  if (!isSourcePreservationSuccess(preservation)) return preservation;

  let sourceDigest: string;
  try {
    sourceDigest = calculateDesenSourceDigest(preservation.source);
    if (!isSha256Digest(sourceDigest)) {
      return normalizationAuthorityFailure(SOURCE_DIGEST_STAGE);
    }
  } catch {
    return normalizationAuthorityFailure(SOURCE_DIGEST_STAGE);
  }

  const normalized = normalizeDocument(
    preservation.preservedDocument,
    limits.maxNormalizedDocumentCanonicalBytes,
  );
  if (normalized.status !== "success") {
    return normalized.status === "limit-exceeded"
      ? normalizationLimitFailure()
      : normalizationAuthorityFailure(NORMALIZATION_STAGE);
  }

  return Object.freeze({
    sourceNormalized: true,
    sourceDigest,
    source: preservation.source,
    catalogSet: preservation.catalogSet,
    packages: preservation.packages,
    requirementPackageIndexes: preservation.requirementPackageIndexes,
    diagnostics: preservation.diagnostics,
    obligations: preservation.obligations,
    preservedDocument: preservation.preservedDocument,
    sourceCatalogRequirements: preservation.sourceCatalogRequirements,
    traceability: preservation.traceability,
    normalizedDocument: normalized.value,
  });
}
