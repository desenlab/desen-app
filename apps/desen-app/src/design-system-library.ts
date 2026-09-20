import { digestCanonicalJson, isSha256Digest } from "@desen/protocol";

import type {
  AuthoringLayerNode,
  CatalogAuthoringIdentity,
  CatalogAuthoringModel,
} from "./authoring-data.js";
import type { PublishCatalogPackageCandidate } from "@desen/publisher";

/** The only Catalog extension namespace interpreted by the App-owned library view. */
export const DESIGN_SYSTEM_LIBRARY_EXTENSION = "desen.library" as const;

const MAX_TEXT = 512;
const MAX_COMPONENTS = 4_096;
const MAX_PROJECTS = 1_024;

type JsonObject = Readonly<Record<string, unknown>>;

/** Exact installed package identity used by Source and release/adoption decisions. */
export interface DesignSystemLibraryIdentity {
  readonly id: string;
  readonly version: string;
  readonly target: string;
  readonly packageDigest: string;
}

/** Inert deprecation and replacement guidance owned by a Catalog extension. */
export interface DesignSystemLibraryComponentLifecycle {
  readonly status: "active" | "deprecated";
  readonly replacement: string | undefined;
  readonly migration: string | undefined;
}

/** One component contract in an exact installed library release. */
export interface DesignSystemLibraryComponent {
  readonly id: string;
  readonly displayName: string;
  readonly contractDigest: string;
  readonly lifecycle: DesignSystemLibraryComponentLifecycle;
}

/** A release view retains its exact package identity; there is no mutable latest pointer. */
export interface DesignSystemLibraryReleaseView {
  readonly identity: DesignSystemLibraryIdentity;
  readonly releaseLabel: string | undefined;
  readonly components: readonly DesignSystemLibraryComponent[];
  readonly componentCount: number;
}

/** One exact Source node reference, derived from saved Source rather than telemetry. */
export interface DesignSystemLibraryUsageReference {
  readonly projectId: string;
  readonly surfaceId: string;
  readonly nodeId: string;
  readonly capabilityId: string;
  readonly library: DesignSystemLibraryIdentity;
}

/** Reverse index of every inspected local Source reference grouped by exact package digest. */
export interface DesignSystemLibraryUsageIndex {
  readonly references: readonly DesignSystemLibraryUsageReference[];
  readonly byLibraryDigest: Readonly<Record<string, number>>;
}

/** One local project included in a library-impact inspection. */
export interface DesignSystemLibraryProjectSnapshot {
  readonly projectId: string;
  readonly projectName: string | undefined;
  readonly releases: readonly DesignSystemLibraryReleaseView[];
  readonly usage: readonly DesignSystemLibraryUsageReference[];
}

/** Complete local-first library management projection for the inspected workspace. */
export interface DesignSystemLibraryWorkspaceModel {
  readonly status: "ready";
  readonly projects: readonly DesignSystemLibraryProjectSnapshot[];
  readonly releases: readonly DesignSystemLibraryReleaseView[];
  readonly usageIndex: DesignSystemLibraryUsageIndex;
}

export type DesignSystemLibraryResult =
  | Readonly<{ readonly ok: true; readonly model: DesignSystemLibraryWorkspaceModel }>
  | Readonly<{
      readonly ok: false;
      readonly reason:
        | "catalog-invalid"
        | "duplicate-package"
        | "metadata-invalid"
        | "package-missing"
        | "package-mismatch"
        | "project-invalid"
        | "source-invalid";
    }>;

/** Builds one immutable release view from a host-verified exact package candidate. */
export type DesignSystemLibraryReleaseResult =
  | Readonly<{ readonly ok: true; readonly release: DesignSystemLibraryReleaseView }>
  | Readonly<{
      readonly ok: false;
      readonly reason: "catalog-invalid" | "metadata-invalid" | "package-mismatch";
    }>;

/** Input for one project. The model must come from the admitted Catalog/Source boundary. */
export interface DesignSystemLibraryProjectInput {
  readonly projectId: string;
  readonly projectName?: string;
  readonly model: CatalogAuthoringModel;
  readonly catalogPackages: readonly PublishCatalogPackageCandidate[];
}

/** Input for a workspace-wide reverse-reference and release projection. */
export interface DesignSystemLibraryWorkspaceInput {
  readonly projects: readonly DesignSystemLibraryProjectInput[];
}

/** One changed contract in a reviewed release comparison. */
export interface DesignSystemLibraryComponentChange {
  readonly componentId: string;
  readonly kind: "added" | "removed" | "changed" | "deprecated" | "replacement";
  readonly from: DesignSystemLibraryComponent | undefined;
  readonly to: DesignSystemLibraryComponent | undefined;
}

/** A deterministic comparison that must be reviewed before adoption. */
export interface DesignSystemLibraryComparison {
  readonly from: DesignSystemLibraryIdentity;
  readonly to: DesignSystemLibraryIdentity;
  readonly changes: readonly DesignSystemLibraryComponentChange[];
  readonly affectedUsages: readonly DesignSystemLibraryUsageReference[];
  readonly compatibility: "compatible" | "incompatible";
  readonly reasons: readonly string[];
}

/** An explicit, non-mutating adoption proposal for one or more local projects. */
export interface DesignSystemLibraryAdoptionPlan {
  readonly status: "review_required";
  readonly previous: DesignSystemLibraryIdentity;
  readonly candidate: DesignSystemLibraryIdentity;
  readonly comparison: DesignSystemLibraryComparison;
}

/** Decision result; rejection leaves the prior exact release selected. */
export type DesignSystemLibraryAdoptionResult =
  | Readonly<{
      readonly ok: true;
      readonly status: "adopted";
      readonly previous: DesignSystemLibraryIdentity;
      readonly current: DesignSystemLibraryIdentity;
      readonly plan: DesignSystemLibraryAdoptionPlan;
    }>
  | Readonly<{
      readonly ok: true;
      readonly status: "rejected";
      readonly current: DesignSystemLibraryIdentity;
      readonly plan: DesignSystemLibraryAdoptionPlan;
    }>
  | Readonly<{
      readonly ok: false;
      readonly reason: "incompatible" | "plan-invalid" | "review-required";
    }>;

function ownObject(value: unknown): JsonObject | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor?.enumerable !== true || !("value" in descriptor)) return undefined;
    }
  } catch {
    return undefined;
  }
  return value as JsonObject;
}

function own(value: JsonObject, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function boundedText(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_TEXT) return undefined;
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) < 32) return undefined;
  }
  return value;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function identityKey(identity: DesignSystemLibraryIdentity): string {
  return `${identity.id}@${identity.version}#${identity.target}:${identity.packageDigest}`;
}

function sameIdentity(
  left: DesignSystemLibraryIdentity,
  right: DesignSystemLibraryIdentity,
): boolean {
  return identityKey(left) === identityKey(right);
}

function identityFromCatalog(
  catalog: JsonObject,
  candidate: PublishCatalogPackageCandidate,
): DesignSystemLibraryIdentity | undefined {
  const id = own(catalog, "id");
  const version = own(catalog, "version");
  const target = own(catalog, "target");
  const packageDigest = own(catalog, "packageDigest");
  if (
    typeof id !== "string" ||
    typeof version !== "string" ||
    typeof target !== "string" ||
    !isSha256Digest(packageDigest) ||
    candidate.id !== id ||
    candidate.version !== version ||
    candidate.target !== target ||
    candidate.observedPackageDigest !== packageDigest
  ) {
    return undefined;
  }
  return freeze({ id, version, target, packageDigest });
}

function packageIdentity(
  candidate: PublishCatalogPackageCandidate,
): { readonly identity: DesignSystemLibraryIdentity; readonly catalog: JsonObject } | undefined {
  const catalog = ownObject(candidate.catalog);
  if (catalog === undefined) return undefined;
  const identity = identityFromCatalog(catalog, candidate);
  return identity === undefined ? undefined : freeze({ identity, catalog });
}

function lifecycleFor(
  metadata: JsonObject | undefined,
): DesignSystemLibraryComponentLifecycle | undefined {
  if (metadata === undefined)
    return freeze({ status: "active", replacement: undefined, migration: undefined });
  const deprecated = own(metadata, "deprecated");
  if (deprecated !== undefined && typeof deprecated !== "boolean") return undefined;
  const replacement = own(metadata, "replacement");
  const migration = own(metadata, "migration");
  if (replacement !== undefined && boundedText(replacement) === undefined) return undefined;
  if (migration !== undefined && boundedText(migration) === undefined) return undefined;
  return freeze({
    status: deprecated === true ? "deprecated" : "active",
    replacement: replacement === undefined ? undefined : (replacement as string),
    migration: migration === undefined ? undefined : (migration as string),
  });
}

type LibraryExtensionRead = Readonly<{
  readonly valid: boolean;
  readonly value: JsonObject | undefined;
}>;

function readLibraryExtension(catalog: JsonObject): LibraryExtensionRead {
  const extensions = ownObject(own(catalog, "extensions"));
  if (own(catalog, "extensions") !== undefined && extensions === undefined) {
    return freeze({ valid: false, value: undefined });
  }
  if (extensions === undefined) return freeze({ valid: true, value: undefined });
  const namespace = own(extensions, DESIGN_SYSTEM_LIBRARY_EXTENSION);
  if (namespace === undefined) return freeze({ valid: true, value: undefined });
  const library = ownObject(namespace);
  return library === undefined
    ? freeze({ valid: false, value: undefined })
    : freeze({ valid: true, value: library });
}

function componentMetadata(
  catalog: JsonObject,
  componentId: string,
): { readonly valid: boolean; readonly value: JsonObject | undefined } {
  const extension = readLibraryExtension(catalog);
  if (!extension.valid || extension.value === undefined) return extension;
  const componentsValue = own(extension.value, "components");
  if (componentsValue === undefined) return freeze({ valid: true, value: undefined });
  const components = ownObject(componentsValue);
  if (components === undefined) return freeze({ valid: false, value: undefined });
  const metadata = own(components, componentId);
  if (metadata === undefined) return freeze({ valid: true, value: undefined });
  const value = ownObject(metadata);
  return value === undefined
    ? freeze({ valid: false, value: undefined })
    : freeze({ valid: true, value });
}

function releaseLabel(catalog: JsonObject): {
  readonly valid: boolean;
  readonly value: string | undefined;
} {
  const extension = readLibraryExtension(catalog);
  if (!extension.valid || extension.value === undefined) {
    return freeze({ valid: extension.valid, value: undefined });
  }
  const label = own(extension.value, "releaseLabel");
  if (label === undefined) return freeze({ valid: true, value: undefined });
  const value = boundedText(label);
  return value === undefined
    ? freeze({ valid: false, value: undefined })
    : freeze({ valid: true, value });
}

function releaseView(
  identity: DesignSystemLibraryIdentity,
  catalog: JsonObject,
): DesignSystemLibraryReleaseView | undefined {
  const componentsValue = ownObject(own(catalog, "components"));
  if (componentsValue === undefined) return undefined;
  const components: DesignSystemLibraryComponent[] = [];
  for (const [id, raw] of Object.entries(componentsValue)) {
    const contract = ownObject(raw);
    if (contract === undefined) return undefined;
    const authoring = ownObject(own(contract, "authoring"));
    const displayName = boundedText(own(authoring ?? {}, "displayName")) ?? id;
    const metadata = componentMetadata(catalog, id);
    if (!metadata.valid) return undefined;
    const lifecycle = lifecycleFor(metadata.value);
    if (lifecycle === undefined) return undefined;
    let contractDigest: string;
    try {
      contractDigest = digestCanonicalJson(contract);
    } catch {
      return undefined;
    }
    components.push(freeze({ id, displayName, contractDigest, lifecycle }));
  }
  if (components.length > MAX_COMPONENTS) return undefined;
  const label = releaseLabel(catalog);
  if (!label.valid) return undefined;
  components.sort((left, right) => left.id.localeCompare(right.id, "en-US"));
  return freeze({
    identity,
    releaseLabel: label.value,
    components: freeze(components),
    componentCount: components.length,
  });
}

/**
 * Projects a package candidate into a release view without selecting it for any project.
 *
 * The observed digest must match the Catalog's declared package digest. This keeps release
 * comparison display-only and prevents a caller from inventing a version or silently adopting it.
 */
export function prepareDesignSystemLibraryRelease(
  candidate: PublishCatalogPackageCandidate,
): DesignSystemLibraryReleaseResult {
  const resolved = packageIdentity(candidate);
  if (resolved === undefined) return freeze({ ok: false, reason: "package-mismatch" });
  const release = releaseView(resolved.identity, resolved.catalog);
  if (release === undefined) return freeze({ ok: false, reason: "metadata-invalid" });
  return freeze({ ok: true, release });
}

function candidateForCatalog(
  catalog: CatalogAuthoringIdentity,
  candidates: readonly PublishCatalogPackageCandidate[],
): { readonly identity: DesignSystemLibraryIdentity; readonly catalog: JsonObject } | undefined {
  const matching = candidates.filter(
    (candidate) =>
      candidate.id === catalog.id &&
      candidate.version === catalog.version &&
      candidate.target === catalog.target,
  );
  const candidate = matching[0];
  if (matching.length !== 1 || candidate === undefined) return undefined;
  return packageIdentity(candidate);
}

function visitNode(
  projectId: string,
  surfaceId: string,
  node: AuthoringLayerNode,
  identities: ReadonlyMap<string, DesignSystemLibraryIdentity>,
  output: DesignSystemLibraryUsageReference[],
): boolean {
  const library = identities.get(node.capabilityId);
  if (library === undefined) return false;
  output.push(
    freeze({
      projectId,
      surfaceId,
      nodeId: node.id,
      capabilityId: node.capabilityId,
      library,
    }),
  );
  for (const slot of node.slots) {
    for (const child of slot.children) {
      if (!visitNode(projectId, surfaceId, child, identities, output)) return false;
    }
  }
  for (const behavior of node.behaviors) {
    for (const slot of behavior.slots) {
      for (const child of slot.children) {
        if (!visitNode(projectId, surfaceId, child, identities, output)) return false;
      }
    }
  }
  return true;
}

type DesignSystemLibraryProjectResult =
  | Readonly<{ readonly ok: true; readonly value: DesignSystemLibraryProjectSnapshot }>
  | Readonly<{
      readonly ok: false;
      readonly reason:
        | "catalog-invalid"
        | "duplicate-package"
        | "metadata-invalid"
        | "package-missing"
        | "package-mismatch"
        | "project-invalid"
        | "source-invalid";
    }>;

function prepareProject(input: DesignSystemLibraryProjectInput): DesignSystemLibraryProjectResult {
  if (input.projectId.length === 0 || input.model.catalogs.length === 0) {
    return freeze({ ok: false, reason: "project-invalid" as const });
  }
  const packageByIdentity = new Map<
    string,
    { readonly identity: DesignSystemLibraryIdentity; readonly catalog: JsonObject }
  >();
  for (const candidate of input.catalogPackages) {
    const resolved = packageIdentity(candidate);
    if (resolved === undefined) return freeze({ ok: false, reason: "package-mismatch" as const });
    const key = identityKey(resolved.identity);
    if (packageByIdentity.has(key))
      return freeze({ ok: false, reason: "duplicate-package" as const });
    packageByIdentity.set(key, resolved);
  }
  const capabilityIdentities = new Map<string, DesignSystemLibraryIdentity>();
  const releases: DesignSystemLibraryReleaseView[] = [];
  for (const catalogIdentity of input.model.catalogs) {
    const resolved = candidateForCatalog(catalogIdentity, input.catalogPackages);
    if (resolved === undefined) return freeze({ ok: false, reason: "package-missing" as const });
    const view = releaseView(resolved.identity, resolved.catalog);
    if (view === undefined) return freeze({ ok: false, reason: "metadata-invalid" as const });
    releases.push(view);
    const components = ownObject(own(resolved.catalog, "components"));
    if (components === undefined) return freeze({ ok: false, reason: "catalog-invalid" as const });
    for (const id of Object.keys(components)) {
      if (capabilityIdentities.has(id))
        return freeze({ ok: false, reason: "catalog-invalid" as const });
      capabilityIdentities.set(id, resolved.identity);
    }
  }
  const usage: DesignSystemLibraryUsageReference[] = [];
  for (const surface of input.model.surfaces) {
    if (!visitNode(input.projectId, surface.id, surface.root, capabilityIdentities, usage)) {
      return freeze({ ok: false, reason: "source-invalid" as const });
    }
  }
  return freeze({
    ok: true,
    value: freeze({
      projectId: input.projectId,
      projectName: input.projectName,
      releases: freeze(
        releases.sort((left, right) =>
          identityKey(left.identity).localeCompare(identityKey(right.identity), "en-US"),
        ),
      ),
      usage: freeze(usage),
    }),
  });
}

/** Builds an exact, local-only library/reverse-reference view for one or more projects. */
export function prepareDesignSystemLibrary(
  input: DesignSystemLibraryWorkspaceInput,
): DesignSystemLibraryResult {
  if (
    !Array.isArray(input.projects) ||
    input.projects.length === 0 ||
    input.projects.length > MAX_PROJECTS
  ) {
    return freeze({ ok: false, reason: "project-invalid" });
  }
  const projects: DesignSystemLibraryProjectSnapshot[] = [];
  const projectIds = new Set<string>();
  for (const projectInput of input.projects) {
    if (projectIds.has(projectInput.projectId))
      return freeze({ ok: false, reason: "project-invalid" });
    projectIds.add(projectInput.projectId);
    const prepared = prepareProject(projectInput);
    if (!prepared.ok) return prepared;
    projects.push(prepared.value);
  }
  const releasesByKey = new Map<string, DesignSystemLibraryReleaseView>();
  const references: DesignSystemLibraryUsageReference[] = [];
  for (const project of projects) {
    for (const release of project.releases)
      releasesByKey.set(identityKey(release.identity), release);
    references.push(...project.usage);
  }
  references.sort((left, right) =>
    `${left.projectId}/${left.surfaceId}/${left.nodeId}`.localeCompare(
      `${right.projectId}/${right.surfaceId}/${right.nodeId}`,
      "en-US",
    ),
  );
  const byLibraryDigest: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const reference of references) {
    byLibraryDigest[reference.library.packageDigest] =
      (byLibraryDigest[reference.library.packageDigest] ?? 0) + 1;
  }
  return freeze({
    ok: true,
    model: freeze({
      status: "ready",
      projects: freeze(projects),
      releases: freeze(
        [...releasesByKey.values()].sort((left, right) =>
          identityKey(left.identity).localeCompare(identityKey(right.identity), "en-US"),
        ),
      ),
      usageIndex: freeze({
        references: freeze(references),
        byLibraryDigest: freeze(byLibraryDigest),
      }),
    }),
  });
}

/** Convenience wrapper for the current App project. */
export function prepareProjectDesignSystemLibrary(
  project: DesignSystemLibraryProjectInput,
): DesignSystemLibraryResult {
  return prepareDesignSystemLibrary({ projects: [project] });
}

function componentMap(
  release: DesignSystemLibraryReleaseView,
): ReadonlyMap<string, DesignSystemLibraryComponent> {
  return new Map(release.components.map((component) => [component.id, component]));
}

/** Compares two exact releases and reports only the local Source references affected by changes. */
export function compareDesignSystemLibraryReleases(
  from: DesignSystemLibraryReleaseView,
  to: DesignSystemLibraryReleaseView,
  usage: readonly DesignSystemLibraryUsageReference[] = [],
): DesignSystemLibraryComparison {
  const previous = componentMap(from);
  const next = componentMap(to);
  const changes: DesignSystemLibraryComponentChange[] = [];
  const ids = new Set([...previous.keys(), ...next.keys()]);
  for (const id of [...ids].sort((left, right) => left.localeCompare(right, "en-US"))) {
    const before = previous.get(id);
    const after = next.get(id);
    if (before === undefined && after !== undefined) {
      changes.push(freeze({ componentId: id, kind: "added", from: undefined, to: after }));
      continue;
    }
    if (before !== undefined && after === undefined) {
      changes.push(freeze({ componentId: id, kind: "removed", from: before, to: undefined }));
      continue;
    }
    if (before === undefined || after === undefined) continue;
    if (before.contractDigest !== after.contractDigest) {
      changes.push(freeze({ componentId: id, kind: "changed", from: before, to: after }));
    }
    if (
      before.lifecycle.status !== after.lifecycle.status &&
      after.lifecycle.status === "deprecated"
    ) {
      changes.push(freeze({ componentId: id, kind: "deprecated", from: before, to: after }));
    }
    if (before.lifecycle.replacement !== after.lifecycle.replacement) {
      changes.push(freeze({ componentId: id, kind: "replacement", from: before, to: after }));
    }
  }
  const removedIds = new Set(
    changes.filter(({ kind }) => kind === "removed").map(({ componentId }) => componentId),
  );
  const affectedUsages = usage.filter(
    (reference) =>
      sameIdentity(reference.library, from.identity) && removedIds.has(reference.capabilityId),
  );
  const reasons: string[] = [];
  if (affectedUsages.length > 0) reasons.push("used-component-removed");
  for (const change of changes) {
    if (change.kind === "deprecated" && change.to?.lifecycle.replacement === undefined) {
      if (
        usage.some(
          (reference) =>
            reference.capabilityId === change.componentId &&
            sameIdentity(reference.library, from.identity),
        )
      ) {
        reasons.push(`used-component-deprecated:${change.componentId}`);
      }
    }
    if (
      change.kind === "replacement" &&
      change.to?.lifecycle.replacement !== undefined &&
      !next.has(change.to.lifecycle.replacement)
    ) {
      reasons.push(`replacement-missing:${change.componentId}`);
    }
  }
  return freeze({
    from: from.identity,
    to: to.identity,
    changes: freeze(changes),
    affectedUsages: freeze(affectedUsages),
    compatibility: reasons.length === 0 ? "compatible" : "incompatible",
    reasons: freeze([...new Set(reasons)]),
  });
}

/** Creates an explicit review proposal; no project or Source is changed. */
export function prepareDesignSystemLibraryAdoption(
  from: DesignSystemLibraryReleaseView,
  to: DesignSystemLibraryReleaseView,
  usage: readonly DesignSystemLibraryUsageReference[] = [],
): DesignSystemLibraryAdoptionPlan {
  return freeze({
    status: "review_required",
    previous: from.identity,
    candidate: to.identity,
    comparison: compareDesignSystemLibraryReleases(from, to, usage),
  });
}

/** Applies only an explicit reviewed decision to an immutable plan. */
export function decideDesignSystemLibraryAdoption(
  plan: DesignSystemLibraryAdoptionPlan,
  decision: "accept" | "reject",
): DesignSystemLibraryAdoptionResult {
  if (
    plan.status !== "review_required" ||
    !sameIdentity(plan.previous, plan.comparison.from) ||
    !sameIdentity(plan.candidate, plan.comparison.to)
  ) {
    return freeze({ ok: false, reason: "plan-invalid" });
  }
  if (decision === "reject") {
    return freeze({ ok: true, status: "rejected", current: plan.previous, plan });
  }
  if (plan.comparison.compatibility !== "compatible") {
    return freeze({ ok: false, reason: "incompatible" });
  }
  return freeze({
    ok: true,
    status: "adopted",
    previous: plan.previous,
    current: plan.candidate,
    plan,
  });
}

/** Restores the exact prior release after an accepted adoption; no latest lookup is performed. */
export function restoreDesignSystemLibraryRelease(
  result: Extract<DesignSystemLibraryAdoptionResult, { readonly status: "adopted" }>,
): DesignSystemLibraryIdentity {
  return result.previous;
}

/** Stable display fingerprint for a release comparison or audit receipt. */
export function fingerprintDesignSystemLibraryRelease(
  release: DesignSystemLibraryReleaseView,
): string {
  return digestCanonicalJson({
    identity: release.identity,
    components: release.components.map(({ id, contractDigest, lifecycle }) => ({
      id,
      contractDigest,
      lifecycle,
    })),
  });
}
