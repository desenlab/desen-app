import {
  appendJsonPointer,
  canonicalizeJson,
  createCoreDiagnostic,
  parseJsonPointer,
} from "@desen/protocol";

import {
  catalogRequirementMismatchDiagnostic,
  invalidSemanticVersionDiagnostic,
  normalizeSemanticDiagnostics,
  prefixedCoreDiagnostic,
} from "./semantic-diagnostics.js";
import { validateDesenStructure, validateDesenStructurePhases } from "./structural-validation.js";
import { compareText, ROOT_POINTER } from "./validation-internals.js";

import type {
  DesenBundle,
  DesenCatalog,
  DesenDiagnosticContext,
  DesenSource,
  JsonPointer,
} from "@desen/protocol";
import type { DesenSemanticDiagnostic } from "./semantic-diagnostics.js";
import type {
  DesenDocumentForTarget,
  DesenStructuralDiagnostic,
  DesenStructuralTarget,
  ImmutableJson,
} from "./structural-validation.js";

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

declare const validatedCatalogSetBrand: unique symbol;

/**
 * A recursively immutable catalog set created by {@link validateDesenCatalogSet}.
 *
 * @remarks The nominal TypeScript brand is backed by a private runtime `WeakSet`. Casting an
 * arbitrary array to this type cannot bypass the trust check performed by source and Bundle
 * semantic validation.
 */
export type DesenValidatedCatalogSet = readonly ImmutableJson<DesenCatalog>[] & {
  readonly [validatedCatalogSetBrand]: "DesenValidatedCatalogSet";
};

/** Successful semantic-foundation validation of one DESEN document. */
export interface DesenSemanticValidationSuccess<Target extends DesenStructuralTarget> {
  /** Confirms that structural and M02-T07 semantic-foundation checks passed. */
  readonly valid: true;
  /** Identifies the validated frozen protocol root. */
  readonly target: Target;
  /** Independent, recursively immutable document snapshot inherited from structural validation. */
  readonly value: ImmutableJson<DesenDocumentForTarget<Target>>;
  /** Always empty on success. */
  readonly diagnostics: readonly [];
}

/** Failed semantic-foundation validation with no trusted document value. */
export interface DesenSemanticValidationFailure<Target extends DesenStructuralTarget> {
  /** Confirms that semantic-foundation validation did not produce an accepted document. */
  readonly valid: false;
  /** Identifies the attempted frozen protocol root. */
  readonly target: Target;
  /** Sorted, de-duplicated structural or semantic diagnostics. */
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
}

/** Result of structural validation followed by the M02-T07 semantic foundation. */
export type DesenSemanticValidationResult<Target extends DesenStructuralTarget> =
  DesenSemanticValidationSuccess<Target> | DesenSemanticValidationFailure<Target>;

/** Successful construction of a trusted resolved-catalog set. */
export interface DesenCatalogSetValidationSuccess {
  /** Confirms every catalog and the set-wide namespace passed. */
  readonly valid: true;
  /** Distinguishes this result from validation of a catalog document root. */
  readonly target: "catalog-set";
  /** Branded, recursively immutable catalogs accepted by later semantic stages. */
  readonly value: DesenValidatedCatalogSet;
  /** Always empty on success. */
  readonly diagnostics: readonly [];
}

/** Failed catalog-set construction with no trusted set value. */
export interface DesenCatalogSetValidationFailure {
  /** Confirms the input did not become a trusted catalog set. */
  readonly valid: false;
  /** Distinguishes this result from validation of a catalog document root. */
  readonly target: "catalog-set";
  /** Sorted, de-duplicated structural or semantic diagnostics. */
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
}

/** Result of validating unknown input as one trusted resolved-catalog set. */
export type DesenCatalogSetValidationResult =
  DesenCatalogSetValidationSuccess | DesenCatalogSetValidationFailure;

type SourceSnapshot = ImmutableJson<DesenSource>;
type BundleSnapshot = ImmutableJson<DesenBundle>;
type CatalogSnapshot = ImmutableJson<DesenCatalog>;
type SemanticDocumentSnapshot = SourceSnapshot | BundleSnapshot;
type SurfaceSnapshot = SemanticDocumentSnapshot["surfaces"][string];
type NodeSnapshot = SurfaceSnapshot["root"];
type BehaviorSnapshot = NonNullable<NodeSnapshot["behaviors"]>[number];
type ActionSnapshot = NonNullable<NodeSnapshot["on"]>[string][number];

declare const preparedSourceFoundationBrand: unique symbol;

/**
 * A detached Source that passed root, embedded-schema, and catalog-independent identity checks.
 *
 * @remarks The nominal brand is backed by a private runtime registry. No symbol or executable
 * metadata is written into the JSON document.
 */
export type DesenPreparedSourceFoundation = SourceSnapshot & {
  readonly [preparedSourceFoundationBrand]: "DesenPreparedSourceFoundation";
};

/** Exact Source-foundation subphase that rejected publication preparation. */
export type DesenSourceFoundationPhase = "root-schema" | "embedded-schema" | "identity";

/** Successful preparation of one runtime-authenticated Source foundation. */
export interface DesenSourceFoundationPreparationSuccess {
  readonly valid: true;
  readonly target: "source-foundation";
  readonly value: DesenPreparedSourceFoundation;
  readonly diagnostics: readonly [];
}

/** Failed preparation with no trusted Source value. */
export interface DesenSourceFoundationPreparationFailure {
  readonly valid: false;
  readonly target: "source-foundation";
  readonly phase: DesenSourceFoundationPhase;
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
}

/** Phase-aware Source preparation used by deterministic Publisher orchestration. */
export type DesenSourceFoundationPreparationResult =
  DesenSourceFoundationPreparationSuccess | DesenSourceFoundationPreparationFailure;

type CapabilityKind = "component" | "behavior" | "operation" | "resource";
type CapabilityMapName = "components" | "behaviors" | "operations" | "resources";

interface CapabilityMapSpec {
  readonly map: CapabilityMapName;
  readonly kind: CapabilityKind;
}

interface CatalogIdentity {
  readonly index: number;
  readonly id: string;
  readonly version: string;
  readonly target: string;
}

interface CapabilityResolution {
  readonly kind: CapabilityKind;
  readonly catalogIndex: number;
}

interface CapabilityMetadata {
  readonly capabilities: ReadonlyMap<string, CapabilityResolution>;
}

interface CatalogSetMetadata extends CapabilityMetadata {
  readonly byIdVersion: ReadonlyMap<string, readonly CatalogIdentity[]>;
  readonly byExactTuple: ReadonlyMap<string, readonly CatalogIdentity[]>;
}

interface CatalogAnalysis {
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
  readonly metadata: CatalogSetMetadata;
}

interface RequirementAnalysis {
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
  readonly catalogIndexes: ReadonlySet<number>;
}

interface NodeWork {
  readonly kind: "node";
  readonly value: NodeSnapshot;
  readonly pointer: JsonPointer;
}

interface BehaviorWork {
  readonly kind: "behavior";
  readonly value: BehaviorSnapshot;
  readonly pointer: JsonPointer;
}

type IdentityWork = NodeWork | BehaviorWork;

interface ActionWork {
  readonly value: ActionSnapshot;
  readonly pointer: JsonPointer;
}

const CAPABILITY_MAPS: readonly CapabilityMapSpec[] = Object.freeze([
  Object.freeze({ map: "components", kind: "component" }),
  Object.freeze({ map: "behaviors", kind: "behavior" }),
  Object.freeze({ map: "operations", kind: "operation" }),
  Object.freeze({ map: "resources", kind: "resource" }),
]);

const TRUSTED_CATALOG_SETS = new WeakSet<object>();
const CATALOG_SET_METADATA = new WeakMap<object, CatalogSetMetadata>();
const PREPARED_SOURCE_FOUNDATIONS = new WeakSet<object>();

function appendPath(pointer: JsonPointer, ...segments: readonly (number | string)[]): JsonPointer {
  return segments.reduce<JsonPointer>(
    (current, segment) => appendJsonPointer(current, segment),
    pointer,
  );
}

function prefixedPointer(prefix: JsonPointer, pointer: JsonPointer | undefined): JsonPointer {
  if (pointer === undefined) return prefix;
  return parseJsonPointer(pointer).reduce<JsonPointer>(
    (current, segment) => appendJsonPointer(current, segment),
    prefix,
  );
}

function semanticSuccess<Target extends DesenStructuralTarget>(
  target: Target,
  value: ImmutableJson<DesenDocumentForTarget<Target>>,
): DesenSemanticValidationSuccess<Target> {
  return Object.freeze({ valid: true, target, value, diagnostics: EMPTY_DIAGNOSTICS });
}

function semanticFailure<Target extends DesenStructuralTarget>(
  target: Target,
  diagnostics: readonly DesenSemanticDiagnostic[],
): DesenSemanticValidationFailure<Target> {
  return Object.freeze({
    valid: false,
    target,
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
  });
}

function sourceFoundationFailure(
  phase: DesenSourceFoundationPhase,
  diagnostics: readonly DesenSemanticDiagnostic[],
): DesenSourceFoundationPreparationFailure {
  return Object.freeze({
    valid: false,
    target: "source-foundation",
    phase,
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
  });
}

function sourceFoundationSuccess(value: SourceSnapshot): DesenSourceFoundationPreparationSuccess {
  PREPARED_SOURCE_FOUNDATIONS.add(value as object);
  return Object.freeze({
    valid: true,
    target: "source-foundation",
    value: value as DesenPreparedSourceFoundation,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function catalogSetSuccess(value: DesenValidatedCatalogSet): DesenCatalogSetValidationSuccess {
  return Object.freeze({
    valid: true,
    target: "catalog-set",
    value,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function catalogSetFailure(
  diagnostics: readonly DesenSemanticDiagnostic[],
): DesenCatalogSetValidationFailure {
  return Object.freeze({
    valid: false,
    target: "catalog-set",
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
  });
}

function isAsciiDigit(character: string): boolean {
  return character >= "0" && character <= "9";
}

function isAsciiLetter(character: string): boolean {
  return (character >= "A" && character <= "Z") || (character >= "a" && character <= "z");
}

function isIdentifier(identifier: string, numericLeadingZeroForbidden: boolean): boolean {
  if (identifier.length === 0) return false;

  let numeric = true;
  for (const character of identifier) {
    if (!isAsciiDigit(character)) numeric = false;
    if (!isAsciiDigit(character) && !isAsciiLetter(character) && character !== "-") return false;
  }
  return !(
    numericLeadingZeroForbidden &&
    numeric &&
    identifier.length > 1 &&
    identifier[0] === "0"
  );
}

function isCoreNumber(identifier: string): boolean {
  if (identifier.length === 0) return false;
  for (const character of identifier) {
    if (!isAsciiDigit(character)) return false;
  }
  return identifier.length === 1 || identifier[0] !== "0";
}

function areDotIdentifiers(value: string, numericLeadingZeroForbidden: boolean): boolean {
  return value
    .split(".")
    .every((identifier) => isIdentifier(identifier, numericLeadingZeroForbidden));
}

/**
 * Reports whether a value is one exact Semantic Versioning 2.0.0 string.
 *
 * @remarks This is a linear, non-coercing grammar check. It accepts build metadata, rejects ranges,
 * prefixes, whitespace, partial versions, empty identifiers, and leading-zero numeric prerelease
 * identifiers, and never converts unbounded version numbers to JavaScript numbers.
 */
export function isExactSemanticVersion(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;

  const buildSeparator = value.indexOf("+");
  if (buildSeparator !== -1 && value.indexOf("+", buildSeparator + 1) !== -1) return false;
  const versionAndPrerelease = buildSeparator === -1 ? value : value.slice(0, buildSeparator);
  if (buildSeparator !== -1) {
    const build = value.slice(buildSeparator + 1);
    if (!areDotIdentifiers(build, false)) return false;
  }

  const prereleaseSeparator = versionAndPrerelease.indexOf("-");
  const core =
    prereleaseSeparator === -1
      ? versionAndPrerelease
      : versionAndPrerelease.slice(0, prereleaseSeparator);
  if (prereleaseSeparator !== -1) {
    const prerelease = versionAndPrerelease.slice(prereleaseSeparator + 1);
    if (!areDotIdentifiers(prerelease, true)) return false;
  }

  const coreNumbers = core.split(".");
  return coreNumbers.length === 3 && coreNumbers.every((identifier) => isCoreNumber(identifier));
}

function inertCatalogArray(input: unknown): readonly unknown[] | undefined {
  try {
    const snapshot = JSON.parse(canonicalizeJson(input)) as unknown;
    return Array.isArray(snapshot) ? snapshot : undefined;
  } catch {
    return undefined;
  }
}

function sortedKeys(object: object): readonly string[] {
  return Object.keys(object).sort(compareText);
}

function catalogIdentityKey(...parts: readonly string[]): string {
  return JSON.stringify(parts);
}

function addCatalogIdentity(
  index: Map<string, CatalogIdentity[]>,
  key: string,
  identity: CatalogIdentity,
): void {
  const existing = index.get(key);
  if (existing === undefined) index.set(key, [identity]);
  else existing.push(identity);
}

function freezeCatalogIdentityIndex(
  index: ReadonlyMap<string, CatalogIdentity[]>,
): ReadonlyMap<string, readonly CatalogIdentity[]> {
  return new Map(
    [...index].map(([key, identities]) => [key, Object.freeze([...identities])] as const),
  );
}

function analyzeCatalogs(
  catalogs: readonly CatalogSnapshot[],
  catalogPointer: (index: number) => JsonPointer,
): CatalogAnalysis {
  const diagnostics: DesenSemanticDiagnostic[] = [];
  const capabilities = new Map<string, CapabilityResolution>();
  const byIdVersion = new Map<string, CatalogIdentity[]>();
  const byExactTuple = new Map<string, CatalogIdentity[]>();

  catalogs.forEach((catalog, catalogIndex) => {
    const basePointer = catalogPointer(catalogIndex);
    const identity = Object.freeze({
      index: catalogIndex,
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
    });
    addCatalogIdentity(byIdVersion, catalogIdentityKey(catalog.id, catalog.version), identity);
    addCatalogIdentity(
      byExactTuple,
      catalogIdentityKey(catalog.id, catalog.version, catalog.target),
      identity,
    );

    if (!isExactSemanticVersion(catalog.version)) {
      diagnostics.push(invalidSemanticVersionDiagnostic(appendPath(basePointer, "version")));
    }

    for (const { map, kind } of CAPABILITY_MAPS) {
      for (const capabilityId of sortedKeys(catalog[map])) {
        const declarationPointer = appendPath(basePointer, map, capabilityId);
        if (capabilities.has(capabilityId)) {
          diagnostics.push(
            createCoreDiagnostic({
              code: "AMBIGUOUS_CAPABILITY",
              message: "A capability identifier is declared more than once in the catalog set.",
              pointer: declarationPointer,
              context: { capabilityId },
            }),
          );
        } else {
          capabilities.set(capabilityId, Object.freeze({ kind, catalogIndex }));
        }
      }
    }
  });

  return Object.freeze({
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
    metadata: Object.freeze({
      capabilities,
      byIdVersion: freezeCatalogIdentityIndex(byIdVersion),
      byExactTuple: freezeCatalogIdentityIndex(byExactTuple),
    }),
  });
}

function trustedCatalogMetadata(catalogSet: unknown): CatalogSetMetadata | undefined {
  if ((typeof catalogSet !== "object" && typeof catalogSet !== "function") || catalogSet === null) {
    return undefined;
  }
  if (!TRUSTED_CATALOG_SETS.has(catalogSet)) return undefined;
  return CATALOG_SET_METADATA.get(catalogSet);
}

/**
 * Validates unknown input as a recursively immutable, single-namespace catalog set.
 *
 * @remarks Every array member first passes the exact T06 Catalog root and embedded-schema checks.
 * If any member fails structurally, no catalog semantics are evaluated. A successful result is
 * branded at compile time and registered in a private `WeakSet`; source and Bundle validators reject
 * ordinary or forged arrays. Catalog array order is preserved, while namespace traversal uses a
 * fixed category order and locale-independent key ordering.
 */
export function validateDesenCatalogSet(input: unknown): DesenCatalogSetValidationResult {
  const existingMetadata = trustedCatalogMetadata(input);
  if (existingMetadata !== undefined) return catalogSetSuccess(input as DesenValidatedCatalogSet);

  const snapshot = inertCatalogArray(input);
  if (snapshot === undefined) {
    return catalogSetFailure([
      createCoreDiagnostic({
        code: "SCHEMA_INVALID",
        message: "Catalog-set input must be an inert RFC 8785-compatible JSON array.",
        pointer: ROOT_POINTER,
      }),
    ]);
  }

  const structuralDiagnostics: DesenSemanticDiagnostic[] = [];
  const catalogs: CatalogSnapshot[] = [];
  snapshot.forEach((catalogInput, catalogIndex) => {
    const result = validateDesenStructure("catalog", catalogInput);
    if (result.valid) {
      catalogs.push(result.value);
      return;
    }

    const prefix = appendJsonPointer(ROOT_POINTER, catalogIndex);
    result.diagnostics.forEach((diagnostic: DesenStructuralDiagnostic) => {
      structuralDiagnostics.push(
        prefixedCoreDiagnostic(diagnostic, prefixedPointer(prefix, diagnostic.pointer)),
      );
    });
  });
  if (structuralDiagnostics.length > 0) return catalogSetFailure(structuralDiagnostics);

  const analysis = analyzeCatalogs(catalogs, (index) => appendJsonPointer(ROOT_POINTER, index));
  if (analysis.diagnostics.length > 0) return catalogSetFailure(analysis.diagnostics);

  const trusted = Object.freeze([...catalogs]) as DesenValidatedCatalogSet;
  TRUSTED_CATALOG_SETS.add(trusted);
  CATALOG_SET_METADATA.set(trusted, analysis.metadata);
  return catalogSetSuccess(trusted);
}

function exactVersionDiagnostics(
  target: "source" | "bundle",
  document: SourceSnapshot | BundleSnapshot,
): readonly DesenSemanticDiagnostic[] {
  const diagnostics: DesenSemanticDiagnostic[] = [];
  const context: DesenDiagnosticContext = { documentId: document.id };
  const requirements =
    target === "source"
      ? (document as SourceSnapshot).catalogs
      : (document as BundleSnapshot).requires.catalogs;
  const collectionPointer =
    target === "source"
      ? appendPath(ROOT_POINTER, "catalogs")
      : appendPath(ROOT_POINTER, "requires", "catalogs");

  requirements.forEach((requirement, index) => {
    if (!isExactSemanticVersion(requirement.version)) {
      diagnostics.push(
        invalidSemanticVersionDiagnostic(appendPath(collectionPointer, index, "version"), context),
      );
    }
  });
  return normalizeSemanticDiagnostics(diagnostics);
}

function sourceRequirementDiagnostics(
  document: SourceSnapshot,
  metadata: CatalogSetMetadata,
): RequirementAnalysis {
  const diagnostics: DesenSemanticDiagnostic[] = [];
  const matchedCatalogs = new Set<number>();
  const collectionPointer = appendPath(ROOT_POINTER, "catalogs");
  const context: DesenDiagnosticContext = { documentId: document.id };

  document.catalogs.forEach((requirement, requirementIndex) => {
    // `location` is deliberately never read: DESEN 0.1.0 makes it an inert discovery hint.
    const matches =
      (requirement.target === undefined
        ? metadata.byIdVersion.get(catalogIdentityKey(requirement.id, requirement.version))
        : metadata.byExactTuple.get(
            catalogIdentityKey(requirement.id, requirement.version, requirement.target),
          )) ?? [];
    if (matches.length !== 1) {
      diagnostics.push(
        catalogRequirementMismatchDiagnostic(
          appendJsonPointer(collectionPointer, requirementIndex),
          context,
        ),
      );
      return;
    }
    matchedCatalogs.add((matches[0] as CatalogIdentity).index);
  });

  return Object.freeze({
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
    catalogIndexes: matchedCatalogs,
  });
}

function bundleRequirementDiagnostics(
  document: BundleSnapshot,
  metadata: CatalogSetMetadata,
): RequirementAnalysis {
  const diagnostics: DesenSemanticDiagnostic[] = [];
  const matchedCatalogs = new Set<number>();
  const collectionPointer = appendPath(ROOT_POINTER, "requires", "catalogs");
  const context: DesenDiagnosticContext = { documentId: document.id };

  document.requires.catalogs.forEach((requirement, requirementIndex) => {
    // Digest comparison belongs to publication/activation. T07 compares only id/version/target.
    const matches =
      metadata.byExactTuple.get(
        catalogIdentityKey(requirement.id, requirement.version, requirement.target),
      ) ?? [];
    if (matches.length !== 1) {
      diagnostics.push(
        catalogRequirementMismatchDiagnostic(
          appendJsonPointer(collectionPointer, requirementIndex),
          context,
        ),
      );
      return;
    }
    matchedCatalogs.add((matches[0] as CatalogIdentity).index);
  });

  return Object.freeze({
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
    catalogIndexes: matchedCatalogs,
  });
}

function metadataForDocument(
  metadata: CatalogSetMetadata,
  catalogIndexes: ReadonlySet<number>,
): CapabilityMetadata {
  const capabilities = new Map<string, CapabilityResolution>();
  for (const [capabilityId, resolution] of metadata.capabilities) {
    if (catalogIndexes.has(resolution.catalogIndex)) capabilities.set(capabilityId, resolution);
  }

  return Object.freeze({ capabilities });
}

function capabilityMessage(kind: CapabilityKind): string {
  switch (kind) {
    case "component":
      return "The referenced component capability is not declared by this document's catalogs.";
    case "behavior":
      return "The referenced behavior capability is not declared by this document's catalogs.";
    case "operation":
      return "The referenced operation capability is not declared by this document's catalogs.";
    case "resource":
      return "The referenced resource capability is not declared by this document's catalogs.";
  }
}

function checkCapability(
  expectedKind: CapabilityKind,
  capabilityId: string,
  pointer: JsonPointer,
  baseContext: DesenDiagnosticContext,
  metadata: CapabilityMetadata | undefined,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  if (metadata === undefined) return;
  const resolution = metadata.capabilities.get(capabilityId);
  if (resolution?.kind === expectedKind) return;

  diagnostics.push(
    createCoreDiagnostic({
      code: "UNKNOWN_CAPABILITY",
      message: capabilityMessage(expectedKind),
      pointer,
      context: { ...baseContext, capabilityId },
    }),
  );
}

function pushSlotChildren(
  stack: IdentityWork[],
  slots: Readonly<Record<string, readonly NodeSnapshot[]>> | undefined,
  ownerPointer: JsonPointer,
): void {
  if (slots === undefined) return;
  const slotNames = sortedKeys(slots);
  for (let slotIndex = slotNames.length - 1; slotIndex >= 0; slotIndex -= 1) {
    const slotName = slotNames[slotIndex] as string;
    const children = slots[slotName] as readonly NodeSnapshot[];
    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      stack.push({
        kind: "node",
        value: children[childIndex] as NodeSnapshot,
        pointer: appendPath(ownerPointer, "slots", slotName, childIndex),
      });
    }
  }
}

function inspectActions(
  actions: readonly ActionSnapshot[],
  actionsPointer: JsonPointer,
  baseContext: DesenDiagnosticContext,
  metadata: CapabilityMetadata | undefined,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  const stack: ActionWork[] = [];
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    stack.push({
      value: actions[index] as ActionSnapshot,
      pointer: appendJsonPointer(actionsPointer, index),
    });
  }

  while (stack.length > 0) {
    const current = stack.pop() as ActionWork;
    const action = current.value;
    if (action.type !== "operation.invoke") continue;

    checkCapability(
      "operation",
      action.operation,
      appendPath(current.pointer, "operation"),
      baseContext,
      metadata,
      diagnostics,
    );

    const nestedGroups = [
      ["onFailure", action.onFailure],
      ["onSuccess", action.onSuccess],
    ] as const;
    for (const [field, nested] of nestedGroups) {
      if (nested === undefined) continue;
      for (let index = nested.length - 1; index >= 0; index -= 1) {
        stack.push({
          value: nested[index] as ActionSnapshot,
          pointer: appendPath(current.pointer, field, index),
        });
      }
    }
  }
}

function inspectHandlers(
  handlers: Readonly<Record<string, readonly ActionSnapshot[]>> | undefined,
  ownerPointer: JsonPointer,
  baseContext: DesenDiagnosticContext,
  metadata: CapabilityMetadata | undefined,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  if (handlers === undefined) return;
  for (const eventName of sortedKeys(handlers)) {
    inspectActions(
      handlers[eventName] as readonly ActionSnapshot[],
      appendPath(ownerPointer, "on", eventName),
      baseContext,
      metadata,
      diagnostics,
    );
  }
}

function inspectSurface(
  documentId: string,
  surfaceKey: string,
  surface: SurfaceSnapshot,
  surfacePointer: JsonPointer,
  metadata: CapabilityMetadata | undefined,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  const identityIds = new Set<string>();
  const stack: IdentityWork[] = [
    { kind: "node", value: surface.root, pointer: appendPath(surfacePointer, "root") },
  ];
  const surfaceContext: DesenDiagnosticContext = { documentId, surfaceId: surfaceKey };

  for (const resourceName of sortedKeys(surface.resources)) {
    const resource = surface.resources[resourceName];
    if (resource === undefined) continue;
    checkCapability(
      "resource",
      resource.use,
      appendPath(surfacePointer, "resources", resourceName, "use"),
      surfaceContext,
      metadata,
      diagnostics,
    );
  }

  while (stack.length > 0) {
    const current = stack.pop() as IdentityWork;
    const subject = Object.freeze({ kind: current.kind, id: current.value.id });
    const context: DesenDiagnosticContext = { ...surfaceContext, subject };
    if (identityIds.has(current.value.id)) {
      diagnostics.push(
        createCoreDiagnostic({
          code: "DUPLICATE_NODE_ID",
          message: "A node or behavior identifier is duplicated within its surface.",
          pointer: appendPath(current.pointer, "id"),
          context,
        }),
      );
    } else {
      identityIds.add(current.value.id);
    }

    if (current.kind === "behavior") {
      checkCapability(
        "behavior",
        current.value.use,
        appendPath(current.pointer, "use"),
        context,
        metadata,
        diagnostics,
      );
      inspectHandlers(current.value.on, current.pointer, context, metadata, diagnostics);
      pushSlotChildren(stack, current.value.slots, current.pointer);
      continue;
    }

    checkCapability(
      "component",
      current.value.use,
      appendPath(current.pointer, "use"),
      context,
      metadata,
      diagnostics,
    );
    inspectHandlers(current.value.on, current.pointer, context, metadata, diagnostics);

    // Node-owned slot children execute after behavior identities and their nested slot trees.
    pushSlotChildren(stack, current.value.slots, current.pointer);
    const behaviors = current.value.behaviors ?? [];
    for (let behaviorIndex = behaviors.length - 1; behaviorIndex >= 0; behaviorIndex -= 1) {
      stack.push({
        kind: "behavior",
        value: behaviors[behaviorIndex] as BehaviorSnapshot,
        pointer: appendPath(current.pointer, "behaviors", behaviorIndex),
      });
    }
  }
}

function documentFoundationDiagnostics(
  document: SemanticDocumentSnapshot,
  metadata: CapabilityMetadata | undefined,
): readonly DesenSemanticDiagnostic[] {
  const diagnostics: DesenSemanticDiagnostic[] = [];

  if (!Object.hasOwn(document.surfaces, document.entry)) {
    diagnostics.push(
      createCoreDiagnostic({
        code: "ENTRY_NOT_FOUND",
        message: "The declared entry surface does not exist.",
        pointer: appendPath(ROOT_POINTER, "entry"),
        context: { documentId: document.id },
      }),
    );
  }

  for (const surfaceKey of sortedKeys(document.surfaces)) {
    const surface = document.surfaces[surfaceKey];
    if (surface === undefined) continue;
    const surfacePointer = appendPath(ROOT_POINTER, "surfaces", surfaceKey);
    const context: DesenDiagnosticContext = { documentId: document.id, surfaceId: surfaceKey };
    // JSON object keys are already unique. Enforcing key/id equality therefore proves surface-id
    // uniqueness without producing a second cascading diagnostic on an otherwise correct entry.
    if (surface.id !== surfaceKey) {
      diagnostics.push(
        createCoreDiagnostic({
          code: "DUPLICATE_SURFACE_ID",
          message: "A surface identity is duplicated or differs from its map key.",
          pointer: appendPath(surfacePointer, "id"),
          context,
        }),
      );
    }
    inspectSurface(document.id, surfaceKey, surface, surfacePointer, metadata, diagnostics);
  }

  return normalizeSemanticDiagnostics(diagnostics);
}

/**
 * Prepares one Source through root schema, embedded schemas, and intrinsic identity semantics.
 *
 * @remarks This phase intentionally does not inspect a Catalog set. It proves strict Source
 * requirement versions, entry existence, surface identity, and the per-surface node/behavior
 * identity namespace before a Publisher may inspect package candidates. Catalog-backed capability
 * existence is finalized by {@link validatePreparedDesenSourceReferences}.
 */
export function prepareDesenSourceFoundation(
  input: unknown,
): DesenSourceFoundationPreparationResult {
  const structural = validateDesenStructurePhases("source", input);
  if (!structural.valid) {
    return sourceFoundationFailure(structural.phase, structural.diagnostics);
  }

  const source = structural.value as SourceSnapshot;
  const diagnostics = normalizeSemanticDiagnostics([
    ...exactVersionDiagnostics("source", source),
    ...documentFoundationDiagnostics(source, undefined),
  ]);
  return diagnostics.length === 0
    ? sourceFoundationSuccess(source)
    : sourceFoundationFailure("identity", diagnostics);
}

/**
 * Validates exact Source requirements and category-aware static references against trusted Catalogs.
 *
 * @remarks Both authorities are runtime authenticated. A TypeScript cast, cloned Source, serialized
 * Source, or forged Catalog array cannot cross this seam. Prop, slot, style, interaction, binding,
 * state, action, and execution contracts remain assigned to later cumulative validators.
 */
export function validatePreparedDesenSourceReferences(
  source: DesenPreparedSourceFoundation,
  catalogSet: DesenValidatedCatalogSet,
): DesenSemanticValidationResult<"source"> {
  if (
    typeof source !== "object" ||
    source === null ||
    !PREPARED_SOURCE_FOUNDATIONS.has(source as object)
  ) {
    return semanticFailure("source", [
      createCoreDiagnostic({
        code: "SCHEMA_INVALID",
        message: "Source reference validation requires a prepared Source foundation.",
        pointer: ROOT_POINTER,
      }),
    ]);
  }

  const metadata = trustedCatalogMetadata(catalogSet);
  if (metadata === undefined) {
    return semanticFailure("source", [
      catalogRequirementMismatchDiagnostic(appendPath(ROOT_POINTER, "catalogs"), {
        documentId: source.id,
      }),
    ]);
  }

  const requirementAnalysis = sourceRequirementDiagnostics(source, metadata);
  if (requirementAnalysis.diagnostics.length > 0) {
    return semanticFailure("source", requirementAnalysis.diagnostics);
  }

  const documentMetadata = metadataForDocument(metadata, requirementAnalysis.catalogIndexes);
  const diagnostics = documentFoundationDiagnostics(source, documentMetadata);
  return diagnostics.length === 0
    ? semanticSuccess("source", source)
    : semanticFailure("source", diagnostics);
}

function catalogSemanticResult(value: CatalogSnapshot): DesenSemanticValidationResult<"catalog"> {
  const analysis = analyzeCatalogs([value], () => ROOT_POINTER);
  return analysis.diagnostics.length === 0
    ? semanticSuccess("catalog", value)
    : semanticFailure("catalog", analysis.diagnostics);
}

/**
 * Applies T06 structural validation and the exact M02-T07 semantic foundation for one root.
 *
 * @remarks Source and Bundle validation requires the exact `.value` returned by
 * {@link validateDesenCatalogSet}. Structural failure always short-circuits before catalog-set or
 * semantic access. The semantic stage covers exact SemVer, catalog requirement identity, entry and
 * surface identity, surface-wide node/behavior identity, one catalog namespace, and category-aware
 * component/behavior/resource/operation existence. It deliberately does not inspect extension
 * payloads, props, style, state, predicates, repeats, bindings, events, command contracts, resource
 * inputs, action semantics, navigation, digests, or activation behavior.
 */
export function validateDesenSemanticFoundation<Target extends DesenStructuralTarget>(
  target: Target,
  input: unknown,
  catalogSet?: DesenValidatedCatalogSet,
): DesenSemanticValidationResult<Target> {
  const structural = validateDesenStructure(target, input);
  if (!structural.valid) return semanticFailure(target, structural.diagnostics);

  if (target === "catalog") {
    return catalogSemanticResult(
      structural.value as CatalogSnapshot,
    ) as DesenSemanticValidationResult<Target>;
  }

  const document = structural.value as SourceSnapshot | BundleSnapshot;
  const versionDiagnostics = exactVersionDiagnostics(target, document);
  const metadata = trustedCatalogMetadata(catalogSet);
  if (metadata === undefined) {
    const pointer =
      target === "source"
        ? appendPath(ROOT_POINTER, "catalogs")
        : appendPath(ROOT_POINTER, "requires", "catalogs");
    return semanticFailure(target, [
      ...versionDiagnostics,
      catalogRequirementMismatchDiagnostic(pointer, { documentId: document.id }),
      ...documentFoundationDiagnostics(document, undefined),
    ]);
  }

  if (versionDiagnostics.length > 0) {
    return semanticFailure(target, [
      ...versionDiagnostics,
      ...documentFoundationDiagnostics(document, undefined),
    ]);
  }

  const requirementAnalysis =
    target === "source"
      ? sourceRequirementDiagnostics(document as SourceSnapshot, metadata)
      : bundleRequirementDiagnostics(document as BundleSnapshot, metadata);
  if (requirementAnalysis.diagnostics.length > 0) {
    return semanticFailure(target, [
      ...requirementAnalysis.diagnostics,
      ...documentFoundationDiagnostics(document, undefined),
    ]);
  }

  const documentMetadata = metadataForDocument(metadata, requirementAnalysis.catalogIndexes);
  const foundationDiagnostics = documentFoundationDiagnostics(document, documentMetadata);
  return foundationDiagnostics.length === 0
    ? semanticSuccess(target, structural.value)
    : semanticFailure(target, foundationDiagnostics);
}

/** Validates unknown input as one Catalog root plus its exact-version and namespace semantics. */
export function validateDesenCatalogSemantics(
  input: unknown,
): DesenSemanticValidationResult<"catalog"> {
  return validateDesenSemanticFoundation("catalog", input);
}

/** Validates unknown input as one Source against a trusted resolved-catalog set. */
export function validateDesenSourceSemantics(
  input: unknown,
  catalogSet: DesenValidatedCatalogSet,
): DesenSemanticValidationResult<"source"> {
  return validateDesenSemanticFoundation("source", input, catalogSet);
}

/** Validates unknown input as one Bundle against a trusted resolved-catalog set. */
export function validateDesenBundleSemantics(
  input: unknown,
  catalogSet: DesenValidatedCatalogSet,
): DesenSemanticValidationResult<"bundle"> {
  return validateDesenSemanticFoundation("bundle", input, catalogSet);
}
