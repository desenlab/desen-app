import { createDesenEditorDocument } from "@desen/editor-core";
import { publishDesenSource } from "@desen/publisher";
import { canonicalizeJson } from "@desen/protocol";
import { createRuntimeHostPorts } from "@desen/runtime-core";
import { readRuntimeReactAdapterRegistry } from "@desen/runtime-react";
import {
  validateDesenInteractionCatalogSet,
  validateDesenSourceInteractionContracts,
} from "@desen/validator";

import { createDesenAppProjectPath } from "./project-navigation.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { PublishCatalogPackageCandidate } from "@desen/publisher";
import type { RuntimeHostPorts } from "@desen/runtime-core";
import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactAdapterRegistrySnapshot,
} from "@desen/runtime-react";
import type { DesenValidatedInteractionCatalogSet } from "@desen/validator";

const PROFILE_INPUT_KEYS = Object.freeze([
  "profileId",
  "project",
  "route",
  "sourceSurfaceId",
  "documentId",
  "sourceKey",
  "initialDocument",
  "catalogs",
  "catalogPackages",
  "runtime",
  "publication",
] as const);
const PROJECT_KEYS = Object.freeze(["id", "name", "description", "surfaces"] as const);
const SURFACE_KEYS = Object.freeze(["id", "sourceId", "name", "description"] as const);
const ROUTE_KEYS = Object.freeze(["projectId", "surfaceId"] as const);
const RUNTIME_KEYS = Object.freeze([
  "target",
  "registry",
  "tokenCssProperties",
  "hostPorts",
] as const);
const PUBLICATION_KEYS = Object.freeze(["channelName", "hostId"] as const);
const CATALOG_PACKAGE_KEYS = Object.freeze([
  "id",
  "version",
  "target",
  "observedPackageDigest",
  "catalog",
] as const);
const ROUTE_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SOURCE_KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const CSS_CUSTOM_PROPERTY_PATTERN = /^--[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_PROFILE_ID_CODE_UNITS = 128;
const MAX_LABEL_CODE_UNITS = 512;
const MAX_SURFACES = 1_024;
const MAX_CATALOGS = 1_024;
const MAX_TOKEN_CSS_PROPERTIES = 4_096;
const MAX_TOKEN_CSS_CODE_UNITS = 1_048_576;

declare const PROJECT_WORKSPACE_PROFILE_HANDLE_BRAND: unique symbol;

/** Opaque factory-authenticated identity for one trusted project workspace composition. */
export interface ProjectWorkspaceProfileHandle {
  readonly [PROJECT_WORKSPACE_PROFILE_HANDLE_BRAND]: true;
}

/** Human-facing metadata for one Source surface and its independently chosen App route slug. */
export interface ProjectWorkspaceSurfaceMetadata {
  /** Canonical lowercase kebab-case slug used only by the Desen App router. */
  readonly id: string;
  /** Exact surface identity present in the admitted DESEN Source. */
  readonly sourceId: string;
  /** Human-facing surface name. */
  readonly name: string;
  /** Human-facing description; it grants no runtime or Catalog authority. */
  readonly description: string;
}

/** Human-facing project inventory metadata owned by the trusted application profile. */
export interface ProjectWorkspaceProjectMetadata {
  /** Canonical lowercase kebab-case project route identity. */
  readonly id: string;
  /** Human-facing project name. */
  readonly name: string;
  /** Human-facing project description. */
  readonly description: string;
  /** Complete one-to-one inventory of surfaces in the initial Source. */
  readonly surfaces: readonly ProjectWorkspaceSurfaceMetadata[];
}

/** Initial App route selected independently from DESEN document and surface identities. */
export interface ProjectWorkspaceRoute {
  readonly projectId: string;
  readonly surfaceId: string;
}

/** Trusted Web runtime authorities captured for one exact Catalog target. */
export interface ProjectWorkspaceRuntimeProfile {
  /** Exact Catalog target implemented by this runtime profile. */
  readonly target: string;
  /** Factory-authenticated executable React adapter registry selected only by the host. */
  readonly registry: RuntimeReactAdapterRegistryHandle;
  /** Callback-free registry inventory retained for deterministic diagnostics and UI projection. */
  readonly registrySnapshot: RuntimeReactAdapterRegistrySnapshot;
  /** Detached CSS custom properties installed by the host around the managed canvas. */
  readonly tokenCssProperties: Readonly<Record<`--${string}`, string>>;
  /** Stable receiver-independent runtime ports captured by `createRuntimeHostPorts`. */
  readonly hostPorts: RuntimeHostPorts;
}

/** Opaque publication destination selected by trusted App composition rather than Source data. */
export interface ProjectWorkspacePublicationBinding {
  /** Host-owned discovery channel updated after successful publication. */
  readonly channelName: string;
  /** Opaque installed-host binding resolved outside DESEN documents. */
  readonly hostId: string;
}

/** Complete trusted input admitted into one factory-authenticated workspace profile. */
export interface ProjectWorkspaceProfileInput {
  readonly profileId: string;
  readonly project: ProjectWorkspaceProjectMetadata;
  readonly route: ProjectWorkspaceRoute;
  /** Exact Source surface selected by the route's independent surface slug. */
  readonly sourceSurfaceId: string;
  /** Exact DESEN Source document identity authorized by this profile. */
  readonly documentId: string;
  /** Host storage identity, deliberately independent from the Source document id. */
  readonly sourceKey: string;
  /** Initial independently admitted Source used only when this profile creates a missing project. */
  readonly initialDocument: DesenEditorDocument;
  /** Complete ordered Catalog set used by authoring validation and runtime planning. */
  readonly catalogs: readonly unknown[];
  /** Complete host-observed package candidates used by Publisher resolution. */
  readonly catalogPackages: readonly PublishCatalogPackageCandidate[];
  /** Executable and token authorities selected by the trusted runtime host. */
  readonly runtime: Readonly<{
    readonly target: string;
    readonly registry: RuntimeReactAdapterRegistryHandle;
    readonly tokenCssProperties: Readonly<Record<string, string>>;
    readonly hostPorts: RuntimeHostPorts;
  }>;
  /** Publication binding, or `null` when this profile deliberately cannot publish. */
  readonly publication: ProjectWorkspacePublicationBinding | null;
}

/** Immutable exact workspace authority available only after factory authentication. */
export interface ProjectWorkspaceProfileSnapshot {
  readonly profileId: string;
  readonly project: ProjectWorkspaceProjectMetadata;
  readonly route: ProjectWorkspaceRoute;
  readonly surfacePath: string;
  readonly sourceSurfaceId: string;
  readonly documentId: string;
  readonly sourceKey: string;
  readonly initialDocument: DesenEditorDocument;
  readonly catalogs: DesenValidatedInteractionCatalogSet;
  readonly catalogPackages: readonly PublishCatalogPackageCandidate[];
  readonly runtime: ProjectWorkspaceRuntimeProfile;
  readonly publication: ProjectWorkspacePublicationBinding | null;
}

/** Stable redacted reason why no workspace-profile authority was created. */
export type ProjectWorkspaceProfileFailureReason =
  | "catalog-document-mismatch"
  | "catalog-invalid"
  | "catalog-package-invalid"
  | "document-invalid"
  | "host-ports-invalid"
  | "input-invalid"
  | "project-invalid"
  | "publication-invalid"
  | "publisher-rejected"
  | "route-invalid"
  | "runtime-invalid";

/** Closed result of creating one trusted project workspace profile. */
export type ProjectWorkspaceProfileCreationResult =
  | Readonly<{
      readonly ok: true;
      readonly handle: ProjectWorkspaceProfileHandle;
      readonly snapshot: ProjectWorkspaceProfileSnapshot;
    }>
  | Readonly<{ readonly ok: false; readonly reason: ProjectWorkspaceProfileFailureReason }>;

/** Closed authenticated read of one factory-created workspace-profile authority. */
export type ProjectWorkspaceProfileReadResult =
  | Readonly<{ readonly status: "read"; readonly profile: ProjectWorkspaceProfileSnapshot }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** Exact profile-bound admission of a current authored or persisted Source. */
export type ProjectWorkspaceDocumentAdmissionResult =
  | Readonly<{ readonly status: "admitted"; readonly document: DesenEditorDocument }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason:
        "catalog-document-mismatch" | "document-invalid" | "document-mismatch" | "profile-invalid";
    }>;

const PROFILE_AUTHORITIES = new WeakMap<
  ProjectWorkspaceProfileHandle,
  ProjectWorkspaceProfileSnapshot
>();

function invalid(
  reason: ProjectWorkspaceProfileFailureReason,
): ProjectWorkspaceProfileCreationResult {
  return Object.freeze({ ok: false, reason });
}

function exactOwnDataRecord(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    ) {
      return undefined;
    }
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    ) {
      return undefined;
    }
    const captured: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
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

function captureArray(value: unknown, maximum: number): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return undefined;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximum ||
      Reflect.ownKeys(value).length !== lengthDescriptor.value + 1
    ) {
      return undefined;
    }
    const captured: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      captured.push(descriptor.value);
    }
    return Object.freeze(captured);
  } catch {
    return undefined;
  }
}

function boundedString(value: unknown, maximum: number, allowEmpty = false): string | undefined {
  if (typeof value !== "string" || value.length > maximum || (!allowEmpty && value.length === 0)) {
    return undefined;
  }
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 31 || codeUnit === 127) return undefined;
  }
  return value;
}

function routeSegment(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= 64 && ROUTE_SEGMENT_PATTERN.test(value)
    ? value
    : undefined;
}

function captureProject(
  value: unknown,
): ProjectWorkspaceProjectMetadata | ProjectWorkspaceProfileFailureReason {
  const project = exactOwnDataRecord(value, PROJECT_KEYS);
  if (project === undefined) return "project-invalid";
  const id = routeSegment(project.id);
  const name = boundedString(project.name, MAX_LABEL_CODE_UNITS);
  const description = boundedString(project.description, MAX_LABEL_CODE_UNITS, true);
  const surfaceValues = captureArray(project.surfaces, MAX_SURFACES);
  if (
    id === undefined ||
    name === undefined ||
    description === undefined ||
    surfaceValues === undefined ||
    surfaceValues.length === 0
  ) {
    return "project-invalid";
  }

  const surfaceIds = new Set<string>();
  const sourceIds = new Set<string>();
  const surfaces: ProjectWorkspaceSurfaceMetadata[] = [];
  for (const surfaceValue of surfaceValues) {
    const surface = exactOwnDataRecord(surfaceValue, SURFACE_KEYS);
    if (surface === undefined) return "project-invalid";
    const surfaceId = routeSegment(surface.id);
    const sourceId = boundedString(surface.sourceId, MAX_LABEL_CODE_UNITS);
    const surfaceName = boundedString(surface.name, MAX_LABEL_CODE_UNITS);
    const surfaceDescription = boundedString(surface.description, MAX_LABEL_CODE_UNITS, true);
    if (
      surfaceId === undefined ||
      sourceId === undefined ||
      surfaceName === undefined ||
      surfaceDescription === undefined ||
      surfaceIds.has(surfaceId) ||
      sourceIds.has(sourceId)
    ) {
      return "project-invalid";
    }
    surfaceIds.add(surfaceId);
    sourceIds.add(sourceId);
    surfaces.push(
      Object.freeze({
        id: surfaceId,
        sourceId,
        name: surfaceName,
        description: surfaceDescription,
      }),
    );
  }

  return Object.freeze({ id, name, description, surfaces: Object.freeze(surfaces) });
}

function captureRoute(value: unknown): ProjectWorkspaceRoute | undefined {
  const route = exactOwnDataRecord(value, ROUTE_KEYS);
  if (route === undefined) return undefined;
  const projectId = routeSegment(route.projectId);
  const surfaceId = routeSegment(route.surfaceId);
  return projectId === undefined || surfaceId === undefined
    ? undefined
    : Object.freeze({ projectId, surfaceId });
}

function captureCatalogPackages(
  value: unknown,
  catalogs: DesenValidatedInteractionCatalogSet,
): readonly PublishCatalogPackageCandidate[] | undefined {
  const packages = captureArray(value, MAX_CATALOGS);
  if (packages === undefined || packages.length !== catalogs.length) return undefined;

  const candidateRecords: Readonly<Record<string, unknown>>[] = [];
  for (const packageValue of packages) {
    const candidate = exactOwnDataRecord(packageValue, CATALOG_PACKAGE_KEYS);
    if (candidate === undefined) return undefined;
    candidateRecords.push(candidate);
  }
  const candidateCatalogValidation = validateDesenInteractionCatalogSet(
    candidateRecords.map((candidate) => candidate.catalog),
  );
  if (!candidateCatalogValidation.valid) return undefined;
  const candidateCatalogs = candidateCatalogValidation.value;

  const catalogsByIdentity = new Map<string, DesenValidatedInteractionCatalogSet[number]>();
  for (const catalog of catalogs) {
    catalogsByIdentity.set(`${catalog.id}\u0000${catalog.version}\u0000${catalog.target}`, catalog);
  }

  const seen = new Set<string>();
  const captured: PublishCatalogPackageCandidate[] = [];
  for (let index = 0; index < candidateRecords.length; index += 1) {
    const candidate = candidateRecords[index];
    const candidateCatalog = candidateCatalogs[index];
    if (candidate === undefined || candidateCatalog === undefined) return undefined;
    const id = boundedString(candidate.id, MAX_LABEL_CODE_UNITS);
    const version = boundedString(candidate.version, MAX_LABEL_CODE_UNITS);
    const target = boundedString(candidate.target, MAX_LABEL_CODE_UNITS);
    const observedPackageDigest =
      typeof candidate.observedPackageDigest === "string" &&
      SHA256_PATTERN.test(candidate.observedPackageDigest)
        ? candidate.observedPackageDigest
        : undefined;
    if (
      id === undefined ||
      version === undefined ||
      target === undefined ||
      observedPackageDigest === undefined
    ) {
      return undefined;
    }
    const identity = `${id}\u0000${version}\u0000${target}`;
    const catalog = catalogsByIdentity.get(identity);
    if (catalog === undefined) return undefined;
    let sameCatalog: boolean;
    try {
      sameCatalog = canonicalizeJson(candidateCatalog) === canonicalizeJson(catalog);
    } catch {
      return undefined;
    }
    if (
      seen.has(identity) ||
      !sameCatalog ||
      candidateCatalog.id !== id ||
      candidateCatalog.version !== version ||
      candidateCatalog.target !== target ||
      catalog.packageDigest !== observedPackageDigest
    ) {
      return undefined;
    }
    seen.add(identity);
    captured.push(Object.freeze({ id, version, target, observedPackageDigest, catalog }));
  }
  return seen.size === catalogs.length ? Object.freeze(captured) : undefined;
}

function captureTokenCssProperties(
  value: unknown,
): Readonly<Record<`--${string}`, string>> | undefined {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    ) {
      return undefined;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_TOKEN_CSS_PROPERTIES || keys.some((key) => typeof key !== "string")) {
      return undefined;
    }
    let codeUnits = 0;
    // React's style boundary requires an ordinary record with `hasOwnProperty`; the strict CSS
    // custom-property grammar prevents prototype-key injection while this remains detached.
    const captured: Record<string, string> = {};
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string" ||
        !CSS_CUSTOM_PROPERTY_PATTERN.test(key)
      ) {
        return undefined;
      }
      codeUnits += key.length + descriptor.value.length;
      if (codeUnits > MAX_TOKEN_CSS_CODE_UNITS) return undefined;
      captured[key] = descriptor.value;
    }
    return Object.freeze(captured) as Readonly<Record<`--${string}`, string>>;
  } catch {
    return undefined;
  }
}

function capturePublication(value: unknown): ProjectWorkspacePublicationBinding | null | undefined {
  if (value === null) return null;
  const publication = exactOwnDataRecord(value, PUBLICATION_KEYS);
  if (publication === undefined) return undefined;
  const channelName = routeSegment(publication.channelName);
  const hostId = routeSegment(publication.hostId);
  return channelName === undefined || hostId === undefined
    ? undefined
    : Object.freeze({ channelName, hostId });
}

function catalogRequirementsMatch(
  document: DesenEditorDocument,
  catalogs: DesenValidatedInteractionCatalogSet,
): boolean {
  const matchedCatalogIndexes = new Set<number>();
  for (const requirement of document.catalogs) {
    const matchingIndexes = catalogs.flatMap((catalog, index) =>
      requirement.id === catalog.id &&
      requirement.version === catalog.version &&
      (requirement.target === undefined || requirement.target === catalog.target)
        ? [index]
        : [],
    );
    if (matchingIndexes.length !== 1) return false;
    const matchedIndex = matchingIndexes[0];
    if (matchedIndex === undefined) return false;
    matchedCatalogIndexes.add(matchedIndex);
  }
  return matchedCatalogIndexes.size === catalogs.length;
}

function registryExactlyCoversCatalogs(
  registry: RuntimeReactAdapterRegistrySnapshot,
  catalogs: DesenValidatedInteractionCatalogSet,
): boolean {
  const expectedComponents = catalogs.flatMap((catalog) => Object.keys(catalog.components)).sort();
  const expectedBehaviors = catalogs.flatMap((catalog) => Object.keys(catalog.behaviors)).sort();
  return (
    expectedComponents.length === registry.componentCapabilityIds.length &&
    expectedComponents.every((id, index) => id === registry.componentCapabilityIds[index]) &&
    expectedBehaviors.length === registry.behaviorCapabilityIds.length &&
    expectedBehaviors.every((id, index) => id === registry.behaviorCapabilityIds[index])
  );
}

/**
 * Creates one finite, detached and factory-authenticated project workspace composition.
 *
 * @remarks Admission is fail-closed across exact-own-data capture, Source and Catalog validation,
 * Publisher package resolution, exact React adapter coverage, token CSS capture, and stable host
 * port capture. Source data can neither select executable adapters nor alter persistence or
 * publication identities. The returned handle is the only supported input to the authenticated
 * reader; caller objects retain no mutation authority over the stored profile.
 */
export function createProjectWorkspaceProfile(
  input: ProjectWorkspaceProfileInput,
): ProjectWorkspaceProfileCreationResult {
  const capturedInput = exactOwnDataRecord(input, PROFILE_INPUT_KEYS);
  if (capturedInput === undefined) return invalid("input-invalid");

  const profileId = boundedString(capturedInput.profileId, MAX_PROFILE_ID_CODE_UNITS);
  if (profileId === undefined) return invalid("input-invalid");
  const project = captureProject(capturedInput.project);
  if (typeof project === "string") return invalid(project);
  const route = captureRoute(capturedInput.route);
  const sourceSurfaceId = boundedString(capturedInput.sourceSurfaceId, MAX_LABEL_CODE_UNITS);
  const documentId = boundedString(capturedInput.documentId, MAX_LABEL_CODE_UNITS);
  const sourceKey =
    typeof capturedInput.sourceKey === "string" && SOURCE_KEY_PATTERN.test(capturedInput.sourceKey)
      ? capturedInput.sourceKey
      : undefined;
  if (route === undefined || sourceSurfaceId === undefined) return invalid("route-invalid");
  if (documentId === undefined || sourceKey === undefined) return invalid("input-invalid");

  const selectedSurface = project.surfaces.find((surface) => surface.id === route.surfaceId);
  if (
    route.projectId !== project.id ||
    selectedSurface === undefined ||
    selectedSurface.sourceId !== sourceSurfaceId
  ) {
    return invalid("route-invalid");
  }

  const admitted = createDesenEditorDocument(capturedInput.initialDocument);
  if (!admitted.ok) return invalid("document-invalid");
  const document = admitted.document;
  if (document.id !== documentId || !Object.hasOwn(document.surfaces, sourceSurfaceId)) {
    return invalid("document-invalid");
  }
  const declaredSurfaceIds = Object.keys(document.surfaces).sort();
  const inventoriedSurfaceIds = project.surfaces.map((surface) => surface.sourceId).sort();
  if (
    declaredSurfaceIds.length !== inventoriedSurfaceIds.length ||
    declaredSurfaceIds.some((id, index) => id !== inventoriedSurfaceIds[index])
  ) {
    return invalid("project-invalid");
  }

  const catalogValues = captureArray(capturedInput.catalogs, MAX_CATALOGS);
  if (catalogValues === undefined || catalogValues.length === 0) return invalid("catalog-invalid");
  const catalogValidation = validateDesenInteractionCatalogSet(catalogValues);
  if (!catalogValidation.valid) return invalid("catalog-invalid");
  const catalogs = catalogValidation.value;
  if (!catalogRequirementsMatch(document, catalogs)) {
    return invalid("catalog-document-mismatch");
  }
  const sourceValidation = validateDesenSourceInteractionContracts(document, catalogs);
  if (!sourceValidation.valid) return invalid("catalog-document-mismatch");

  const catalogPackages = captureCatalogPackages(capturedInput.catalogPackages, catalogs);
  if (catalogPackages === undefined) return invalid("catalog-package-invalid");
  let rawSource: string | undefined;
  try {
    rawSource = JSON.stringify(document);
  } catch {
    return invalid("document-invalid");
  }
  if (rawSource === undefined) return invalid("document-invalid");
  try {
    if (!publishDesenSource(rawSource, catalogPackages).ok) {
      return invalid("publisher-rejected");
    }
  } catch {
    return invalid("publisher-rejected");
  }

  const runtimeInput = exactOwnDataRecord(capturedInput.runtime, RUNTIME_KEYS);
  if (runtimeInput === undefined) return invalid("runtime-invalid");
  const target = boundedString(runtimeInput.target, MAX_LABEL_CODE_UNITS);
  if (target === undefined || catalogs.some((catalog) => catalog.target !== target)) {
    return invalid("runtime-invalid");
  }
  const registryRead = readRuntimeReactAdapterRegistry(
    runtimeInput.registry as RuntimeReactAdapterRegistryHandle,
  );
  if (
    registryRead.status !== "read" ||
    !registryExactlyCoversCatalogs(registryRead.snapshot, catalogs)
  ) {
    return invalid("runtime-invalid");
  }
  const tokenCssProperties = captureTokenCssProperties(runtimeInput.tokenCssProperties);
  if (tokenCssProperties === undefined) return invalid("runtime-invalid");
  let hostPorts: RuntimeHostPorts;
  try {
    hostPorts = createRuntimeHostPorts(runtimeInput.hostPorts as RuntimeHostPorts);
  } catch {
    return invalid("host-ports-invalid");
  }

  const publication = capturePublication(capturedInput.publication);
  if (publication === undefined) return invalid("publication-invalid");

  let surfacePath: string;
  try {
    surfacePath = createDesenAppProjectPath(route.projectId, route.surfaceId);
  } catch {
    return invalid("route-invalid");
  }
  const runtime: ProjectWorkspaceRuntimeProfile = Object.freeze({
    target,
    registry: runtimeInput.registry as RuntimeReactAdapterRegistryHandle,
    registrySnapshot: registryRead.snapshot,
    tokenCssProperties,
    hostPorts,
  });
  const snapshot: ProjectWorkspaceProfileSnapshot = Object.freeze({
    profileId,
    project,
    route,
    surfacePath,
    sourceSurfaceId,
    documentId,
    sourceKey,
    initialDocument: document,
    catalogs,
    catalogPackages,
    runtime,
    publication,
  });
  const handle = Object.freeze({}) as ProjectWorkspaceProfileHandle;
  PROFILE_AUTHORITIES.set(handle, snapshot);
  return Object.freeze({ ok: true, handle, snapshot });
}

/** Reads the exact immutable workspace authority behind one factory-created profile handle. */
export function readProjectWorkspaceProfileAuthority(
  handle: ProjectWorkspaceProfileHandle,
): ProjectWorkspaceProfileReadResult {
  const profile = PROFILE_AUTHORITIES.get(handle);
  return profile === undefined
    ? Object.freeze({ status: "invalid-handle" })
    : Object.freeze({ status: "read", profile });
}

/**
 * Re-admits one current Source against every identity owned by an authenticated workspace profile.
 *
 * @remarks Authored content may evolve, but the document id, entry surface, complete surface
 * inventory, complete Catalog requirement set and Catalog interaction contracts cannot drift from
 * the selected product profile. This shared check prevents direct App embeddings, persistence
 * ports, and publication snapshots from widening a profile with a same-id foreign Source.
 */
export function admitProjectWorkspaceDocument(
  handle: ProjectWorkspaceProfileHandle,
  input: unknown,
): ProjectWorkspaceDocumentAdmissionResult {
  const authority = readProjectWorkspaceProfileAuthority(handle);
  if (authority.status !== "read") {
    return Object.freeze({ status: "rejected", reason: "profile-invalid" });
  }
  let admitted: ReturnType<typeof createDesenEditorDocument>;
  try {
    admitted = createDesenEditorDocument(input);
  } catch {
    return Object.freeze({ status: "rejected", reason: "document-invalid" });
  }
  if (!admitted.ok) {
    return Object.freeze({ status: "rejected", reason: "document-invalid" });
  }
  const profile = authority.profile;
  const document = admitted.document;
  const documentSurfaceIds = Object.keys(document.surfaces).sort();
  const profileSurfaceIds = profile.project.surfaces.map(({ sourceId }) => sourceId).sort();
  if (
    document.id !== profile.documentId ||
    document.entry !== profile.initialDocument.entry ||
    documentSurfaceIds.length !== profileSurfaceIds.length ||
    documentSurfaceIds.some((id, index) => id !== profileSurfaceIds[index])
  ) {
    return Object.freeze({ status: "rejected", reason: "document-mismatch" });
  }
  if (!catalogRequirementsMatch(document, profile.catalogs)) {
    return Object.freeze({ status: "rejected", reason: "catalog-document-mismatch" });
  }
  let validation: ReturnType<typeof validateDesenSourceInteractionContracts>;
  try {
    validation = validateDesenSourceInteractionContracts(document, profile.catalogs);
  } catch {
    return Object.freeze({ status: "rejected", reason: "catalog-document-mismatch" });
  }
  return validation.valid
    ? Object.freeze({ status: "admitted", document: validation.value })
    : Object.freeze({ status: "rejected", reason: "catalog-document-mismatch" });
}
