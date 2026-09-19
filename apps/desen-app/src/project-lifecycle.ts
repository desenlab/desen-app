/* eslint-disable @typescript-eslint/no-invalid-void-type -- This module deliberately exposes
 * receiver-independent external-store and host-port callbacks. */
import { migrateEditableProjectRecord } from "@desen/design-system-core";
import { canonicalizeJson } from "@desen/protocol";

import type { EditableProjectRecord } from "@desen/design-system-core";

/** Exact application-owned registry kind; it is distinct from a DESEN Source and T02 project. */
export const PROJECT_WORKSPACE_KIND = "desen.app.project-workspace" as const;

/** Only workspace registry version admitted by this application boundary. */
export const PROJECT_WORKSPACE_SCHEMA_VERSION = 1 as const;

/** Bounded ordinary-project registry limits. */
export const PROJECT_WORKSPACE_LIMITS = Object.freeze({
  maxProjects: 64,
  maxDeletedProjects: 64,
  maxLabelCodeUnits: 512,
});

const IDENTIFIER = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
const MAX_GENERATION = Number.MAX_SAFE_INTEGER;
const WORKSPACE_KEYS = Object.freeze(["kind", "schemaVersion", "projects", "deletedProjects"]);
const PROJECT_KEYS = Object.freeze(["id", "name", "record", "surfaceOrder", "surfaceNames"]);
const SURFACE_NAME_KEYS = Object.freeze(["id", "name"]);

/** One user-owned label associated with an admitted Source surface identity. */
export interface ProjectWorkspaceSurfaceName {
  /** Exact Source surface identifier. */
  readonly id: string;
  /** Human-facing name. */
  readonly name: string;
}

/** A Source-declared authoring frame, retained inside the immutable editable-project envelope. */
export interface ProjectWorkspaceSurfaceFrame {
  /** Horizontal canvas coordinate. */
  readonly x: number;
  /** Vertical canvas coordinate. */
  readonly y: number;
  /** Positive visible canvas width. */
  readonly width: number;
  /** Positive visible canvas height. */
  readonly height: number;
}

/** One editable project plus application-owned surface ordering and labels. */
export interface ProjectWorkspaceProject {
  /** Equals the immutable editable-project identity. */
  readonly id: string;
  /** Human-facing project name. */
  readonly name: string;
  /** Exact current editable-project envelope; this layer never rewrites admitted Source. */
  readonly record: EditableProjectRecord;
  /** Complete order of the Source surface identities. */
  readonly surfaceOrder: readonly string[];
  /** Complete one-to-one names for the Source surface identities. */
  readonly surfaceNames: readonly ProjectWorkspaceSurfaceName[];
}

/** Versioned, application-owned project registry persisted through a host storage port. */
export interface ProjectWorkspaceRecord {
  /** Fixed application registry discriminator. */
  readonly kind: typeof PROJECT_WORKSPACE_KIND;
  /** Fixed finite schema version. */
  readonly schemaVersion: typeof PROJECT_WORKSPACE_SCHEMA_VERSION;
  /** Currently visible projects, in deterministic user order. */
  readonly projects: readonly ProjectWorkspaceProject[];
  /** Recoverable deleted projects, newest first. */
  readonly deletedProjects: readonly ProjectWorkspaceProject[];
}

/** Stable reason that prevents a workspace candidate crossing the application boundary. */
export type ProjectWorkspaceAdmissionReason =
  | "invalid-workspace"
  | "unsupported-workspace-version"
  | "invalid-project"
  | "unsupported-project-version"
  | "invalid-surface-registry";

/** Successful workspace admission with a detached immutable registry. */
export interface ProjectWorkspaceAdmissionSuccess {
  /** Confirms a complete workspace is available. */
  readonly ok: true;
  /** Recursively immutable workspace data. */
  readonly workspace: ProjectWorkspaceRecord;
}

/** Failed workspace admission with no partial registry. */
export interface ProjectWorkspaceAdmissionFailure {
  /** Confirms no workspace was admitted. */
  readonly ok: false;
  /** Stable failure classification without echoing untrusted content. */
  readonly reason: ProjectWorkspaceAdmissionReason;
}

/** Result of admitting an unknown app workspace registry. */
export type ProjectWorkspaceAdmissionResult =
  ProjectWorkspaceAdmissionSuccess | ProjectWorkspaceAdmissionFailure;

/** Explicit host storage read result for one complete registry generation. */
export type ProjectWorkspaceOpenResult =
  | Readonly<{ readonly status: "missing" }>
  | Readonly<{
      readonly status: "opened";
      readonly generation: number;
      readonly workspace: unknown;
    }>
  | Readonly<{ readonly status: "failed" }>;

/** Explicit host storage write request; callers cannot omit the generation fence. */
export interface ProjectWorkspaceSaveRequest {
  /** Generation observed during the last admitted open, or null before creation. */
  readonly expectedGeneration: number | null;
  /** Complete admitted registry replacement. */
  readonly workspace: ProjectWorkspaceRecord;
}

/** Explicit host storage write outcome for one generation-fenced registry replacement. */
export type ProjectWorkspaceSaveResult =
  | Readonly<{ readonly status: "created"; readonly generation: number }>
  | Readonly<{ readonly status: "updated"; readonly generation: number }>
  | Readonly<{ readonly status: "unchanged"; readonly generation: number }>
  | Readonly<{ readonly status: "conflict"; readonly currentGeneration: number | null }>
  | Readonly<{ readonly status: "indeterminate" }>
  | Readonly<{ readonly status: "failed" }>;

/** Explicit application storage authority for the complete project registry. */
export interface ProjectWorkspaceStoragePort {
  /** Reads at most one complete, host-authenticated workspace generation. */
  readonly openWorkspace: (this: void) => Promise<ProjectWorkspaceOpenResult>;
  /** Atomically replaces a complete registry only at the requested generation. */
  readonly saveWorkspace: (
    this: void,
    request: ProjectWorkspaceSaveRequest,
  ) => Promise<ProjectWorkspaceSaveResult>;
}

/** Immutable controller snapshot for project lifecycle UI and navigation guards. */
export interface ProjectLifecycleState {
  /** Current complete project registry. */
  readonly workspace: ProjectWorkspaceRecord;
  /** Last successfully saved registry, if any. */
  readonly savedWorkspace: ProjectWorkspaceRecord | null;
  /** Last successfully observed storage generation. */
  readonly generation: number | null;
  /** True whenever workspace differs from the last good registry. */
  readonly dirty: boolean;
  /** True after an indeterminate settlement; reopening is required before another save. */
  readonly reopenRequired: boolean;
  /** Lifecycle work in progress. */
  readonly pending: "opening" | "saving" | null;
  /** Last controlled lifecycle settlement. */
  readonly result: ProjectLifecycleResult | null;
  /** The save origin shown to users after the most recent save attempt. */
  readonly lastSaveMode: "autosave" | "explicit" | null;
  /** True after disposal; all future mutations fail closed. */
  readonly disposed: boolean;
}

/** A controlled lifecycle action settlement. */
export type ProjectLifecycleResult =
  | Readonly<{ readonly status: "opened"; readonly generation: number }>
  | Readonly<{ readonly status: "missing" }>
  | Readonly<{ readonly status: "created" | "updated" | "unchanged"; readonly generation: number }>
  | Readonly<{ readonly status: "conflict"; readonly currentGeneration: number | null }>
  | Readonly<{ readonly status: "indeterminate" }>
  | Readonly<{
      readonly status: "failed";
      readonly reason:
        | "disposed"
        | "operation-in-progress"
        | "port-invalid"
        | "reopen-required"
        | "storage-failed"
        | ProjectWorkspaceAdmissionReason;
    }>;

/** Receiver-independent lifecycle controller for React external-store consumers. */
export interface ProjectLifecycleController {
  /** Returns the stable immutable current snapshot. */
  readonly read: (this: void) => ProjectLifecycleState;
  /** Subscribes to state replacement notifications. */
  readonly subscribe: (this: void, listener: () => void) => () => void;
  /** Reloads one complete generation, leaving the current in-memory workspace intact on rejection. */
  readonly open: (this: void) => Promise<ProjectLifecycleResult>;
  /** Saves the complete registry with an explicit generation fence. */
  readonly save: (this: void) => Promise<ProjectLifecycleResult>;
  /** Performs a caller-scheduled automatic save through the identical generation fence. */
  readonly autosave: (this: void) => Promise<ProjectLifecycleResult>;
  /** Adds an already admitted project to the visible registry. */
  readonly createProject: (
    this: void,
    project: unknown,
    name: string,
    surfaceNames: readonly ProjectWorkspaceSurfaceName[],
  ) => ProjectLifecycleResult | null;
  /** Renames a visible project without rewriting its T02 envelope. */
  readonly renameProject: (
    this: void,
    projectId: string,
    name: string,
  ) => ProjectLifecycleResult | null;
  /** Replaces an existing project only if its surface registry remains coherent. */
  readonly replaceProjectRecord: (
    this: void,
    projectId: string,
    project: unknown,
  ) => ProjectLifecycleResult | null;
  /** Adds exactly one Source surface from a caller-supplied next T02 envelope. */
  readonly addSurface: (
    this: void,
    projectId: string,
    project: unknown,
    surfaceName: ProjectWorkspaceSurfaceName,
  ) => ProjectLifecycleResult | null;
  /** Removes exactly one non-entry Source surface from a caller-supplied next T02 envelope. */
  readonly deleteSurface: (
    this: void,
    projectId: string,
    project: unknown,
    surfaceId: string,
  ) => ProjectLifecycleResult | null;
  /** Changes only the deterministic surface order. */
  readonly reorderSurfaces: (
    this: void,
    projectId: string,
    surfaceOrder: readonly string[],
  ) => ProjectLifecycleResult | null;
  /** Changes one application-owned surface label. */
  readonly renameSurface: (
    this: void,
    projectId: string,
    surfaceId: string,
    name: string,
  ) => ProjectLifecycleResult | null;
  /** Selects a different existing entry surface from a caller-supplied next T02 envelope. */
  readonly selectEntrySurface: (
    this: void,
    projectId: string,
    project: unknown,
    surfaceId: string,
  ) => ProjectLifecycleResult | null;
  /** Replaces one Source-declared authoring frame through a caller-supplied next T02 envelope. */
  readonly updateSurfaceFrame: (
    this: void,
    projectId: string,
    project: unknown,
    surfaceId: string,
  ) => ProjectLifecycleResult | null;
  /** Moves a visible project to recoverable deletion. */
  readonly deleteProject: (this: void, projectId: string) => ProjectLifecycleResult | null;
  /** Restores one recoverably deleted project to the visible registry. */
  readonly recoverProject: (this: void, projectId: string) => ProjectLifecycleResult | null;
  /** Returns canonical, deterministic export bytes for one admitted editable project. */
  readonly exportProject: (this: void, projectId: string) => string | null;
  /** Restores the last good registry, or the initial empty registry before the first save. */
  readonly discardChanges: (this: void) => ProjectLifecycleResult | null;
  /** Stops notifications and rejects future lifecycle work. */
  readonly dispose: (this: void) => void;
}

/** Trusted inputs captured once by a lifecycle controller. */
export interface ProjectLifecycleControllerOptions {
  /** Complete workspace used before the first successful host open. */
  readonly initialWorkspace: unknown;
  /** Explicit host storage authority; this module has no browser or filesystem authority. */
  readonly storagePort: ProjectWorkspaceStoragePort;
  /**
   * Optional trusted application preflight over the complete migrated workspace. Only literal
   * `true` admits it; exceptions or other results preserve the preceding workspace. Captured once
   * at construction, this callback cannot come from project data or choose storage authority.
   */
  readonly admitWorkspace?: (this: void, workspace: ProjectWorkspaceRecord) => boolean;
}

function ownRecord(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    )
      return undefined;
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor))
        return undefined;
      output[key] = descriptor.value;
    }
    return Object.freeze(output);
  } catch {
    return undefined;
  }
}

function label(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= PROJECT_WORKSPACE_LIMITS.maxLabelCodeUnits
    ? value
    : undefined;
}

function id(value: unknown): string | undefined {
  return typeof value === "string" && IDENTIFIER.test(value) ? value : undefined;
}

function generation(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAX_GENERATION
    ? value
    : undefined;
}

function sourceSurfaceIds(record: EditableProjectRecord): readonly string[] {
  const surfaces = (
    record.source as unknown as { readonly surfaces: Readonly<Record<string, unknown>> }
  ).surfaces;
  return Object.freeze(Object.keys(surfaces));
}

function sourceEntry(record: EditableProjectRecord): string {
  return (record.source as unknown as { readonly entry: string }).entry;
}

function sourceFrame(
  record: EditableProjectRecord,
  surfaceId: string,
): ProjectWorkspaceSurfaceFrame | undefined {
  const canvas = (
    record.source as unknown as {
      readonly authoring?: { readonly canvas?: Readonly<Record<string, unknown>> };
    }
  ).authoring?.canvas;
  const candidate = canvas?.[surfaceId];
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate))
    return undefined;
  const values = candidate as Readonly<Record<string, unknown>>;
  const numbers = [values.x, values.y, values.width, values.height];
  if (
    !numbers.every((value) => typeof value === "number" && Number.isFinite(value)) ||
    (values.width as number) <= 0 ||
    (values.height as number) <= 0
  )
    return undefined;
  return Object.freeze({
    x: values.x as number,
    y: values.y as number,
    width: values.width as number,
    height: values.height as number,
  });
}

function hasCoherentSourceReferences(record: EditableProjectRecord): boolean {
  const surfaces = sourceSurfaceIds(record);
  return (
    surfaces.length > 0 &&
    surfaces.includes(sourceEntry(record)) &&
    surfaces.every((surfaceId) => sourceFrame(record, surfaceId) !== undefined) &&
    record.connectionIntents.every((intent) => surfaces.includes(intent.surfaceId))
  );
}

function sameSet(first: readonly string[], second: readonly string[]): boolean {
  return (
    first.length === second.length &&
    new Set(first).size === first.length &&
    first.every((value) => second.includes(value))
  );
}

function admitProject(value: unknown): EditableProjectRecord | ProjectWorkspaceAdmissionReason {
  const migration = migrateEditableProjectRecord(value);
  if (!migration.ok) {
    return migration.diagnostics.some(
      (diagnostic) => diagnostic.code === "UNSUPPORTED_PROJECT_VERSION",
    )
      ? "unsupported-project-version"
      : "invalid-project";
  }
  return migration.record;
}

function admitSurfaceNames(
  value: unknown,
  surfaces: readonly string[],
): readonly ProjectWorkspaceSurfaceName[] | undefined {
  if (!Array.isArray(value) || value.length !== surfaces.length) return undefined;
  const names: ProjectWorkspaceSurfaceName[] = [];
  for (const candidate of value) {
    const captured = ownRecord(candidate, SURFACE_NAME_KEYS);
    const surfaceId = id(captured?.id);
    const name = label(captured?.name);
    if (surfaceId === undefined || name === undefined) return undefined;
    names.push(Object.freeze({ id: surfaceId, name }));
  }
  return sameSet(
    surfaces,
    names.map((entry) => entry.id),
  )
    ? Object.freeze(names)
    : undefined;
}

function admitWorkspaceProject(
  value: unknown,
): ProjectWorkspaceProject | ProjectWorkspaceAdmissionReason {
  const captured = ownRecord(value, PROJECT_KEYS);
  const projectId = id(captured?.id);
  const name = label(captured?.name);
  const record = admitProject(captured?.record);
  if (projectId === undefined || name === undefined || typeof record === "string")
    return typeof record === "string" ? record : "invalid-project";
  if (record.id !== projectId) return "invalid-project";
  const surfaces = sourceSurfaceIds(record);
  if (!hasCoherentSourceReferences(record)) return "invalid-surface-registry";
  const surfaceOrder =
    Array.isArray(captured?.surfaceOrder) &&
    captured.surfaceOrder.every((value) => id(value) !== undefined)
      ? (captured.surfaceOrder as readonly string[])
      : undefined;
  const surfaceNames = admitSurfaceNames(captured?.surfaceNames, surfaces);
  if (surfaceOrder === undefined || !sameSet(surfaces, surfaceOrder) || surfaceNames === undefined)
    return "invalid-surface-registry";
  return Object.freeze({
    id: projectId,
    name,
    record,
    surfaceOrder: Object.freeze([...surfaceOrder]),
    surfaceNames,
  });
}

/**
 * Re-admits an unknown project workspace as a finite application registry.
 *
 * @remarks A rejected registry never yields partial projects. Each embedded T02 record is
 * independently re-admitted, while source bytes and semantics stay entirely owned by T02.
 */
export function admitProjectWorkspaceRecord(value: unknown): ProjectWorkspaceAdmissionResult {
  const captured = ownRecord(value, WORKSPACE_KEYS);
  if (captured === undefined || captured.kind !== PROJECT_WORKSPACE_KIND)
    return Object.freeze({ ok: false, reason: "invalid-workspace" });
  if (captured.schemaVersion !== PROJECT_WORKSPACE_SCHEMA_VERSION)
    return Object.freeze({ ok: false, reason: "unsupported-workspace-version" });
  if (
    !Array.isArray(captured.projects) ||
    !Array.isArray(captured.deletedProjects) ||
    captured.projects.length > PROJECT_WORKSPACE_LIMITS.maxProjects ||
    captured.deletedProjects.length > PROJECT_WORKSPACE_LIMITS.maxDeletedProjects
  )
    return Object.freeze({ ok: false, reason: "invalid-workspace" });
  const projects: ProjectWorkspaceProject[] = [];
  const deletedProjects: ProjectWorkspaceProject[] = [];
  for (const candidate of captured.projects) {
    const project = admitWorkspaceProject(candidate);
    if (typeof project === "string") return Object.freeze({ ok: false, reason: project });
    projects.push(project);
  }
  for (const candidate of captured.deletedProjects) {
    const project = admitWorkspaceProject(candidate);
    if (typeof project === "string") return Object.freeze({ ok: false, reason: project });
    deletedProjects.push(project);
  }
  const ids = [...projects, ...deletedProjects].map((project) => project.id);
  if (new Set(ids).size !== ids.length)
    return Object.freeze({ ok: false, reason: "invalid-workspace" });
  return Object.freeze({
    ok: true,
    workspace: Object.freeze({
      kind: PROJECT_WORKSPACE_KIND,
      schemaVersion: PROJECT_WORKSPACE_SCHEMA_VERSION,
      projects: Object.freeze(projects),
      deletedProjects: Object.freeze(deletedProjects),
    }),
  });
}

/** Creates an empty, versioned workspace ready for its first ordinary project. */
export function createEmptyProjectWorkspace(): ProjectWorkspaceRecord {
  return Object.freeze({
    kind: PROJECT_WORKSPACE_KIND,
    schemaVersion: PROJECT_WORKSPACE_SCHEMA_VERSION,
    projects: Object.freeze([]),
    deletedProjects: Object.freeze([]),
  });
}

function capturePort(value: unknown): ProjectWorkspaceStoragePort | undefined {
  const captured = ownRecord(value, ["openWorkspace", "saveWorkspace"]);
  return typeof captured?.openWorkspace === "function" &&
    typeof captured.saveWorkspace === "function"
    ? Object.freeze({
        openWorkspace: captured.openWorkspace as ProjectWorkspaceStoragePort["openWorkspace"],
        saveWorkspace: captured.saveWorkspace as ProjectWorkspaceStoragePort["saveWorkspace"],
      })
    : undefined;
}

function captureOpenResult(value: unknown): ProjectWorkspaceOpenResult {
  const basic = ownRecord(value, ["status"]);
  if (basic?.status === "missing" || basic?.status === "failed") {
    return Object.freeze({ status: basic.status });
  }
  const opened = ownRecord(value, ["status", "generation", "workspace"]);
  return opened?.status === "opened"
    ? Object.freeze({
        status: "opened",
        generation: opened.generation as number,
        workspace: opened.workspace,
      })
    : Object.freeze({ status: "failed" });
}

function captureSaveResult(value: unknown): ProjectWorkspaceSaveResult {
  const basic = ownRecord(value, ["status"]);
  if (basic?.status === "failed" || basic?.status === "indeterminate") {
    return Object.freeze({ status: basic.status });
  }
  const written = ownRecord(value, ["status", "generation"]);
  if (
    written !== undefined &&
    (written.status === "created" || written.status === "updated" || written.status === "unchanged")
  ) {
    return Object.freeze({ status: written.status, generation: written.generation as number });
  }
  const conflict = ownRecord(value, ["status", "currentGeneration"]);
  return conflict?.status === "conflict"
    ? Object.freeze({
        status: "conflict",
        currentGeneration: conflict.currentGeneration as number | null,
      })
    : Object.freeze({ status: "indeterminate" });
}

function captureInitial(value: unknown): ProjectWorkspaceRecord | undefined {
  const admitted = admitProjectWorkspaceRecord(value);
  return admitted.ok ? admitted.workspace : undefined;
}

function resultFailure(
  reason: Extract<ProjectLifecycleResult, { readonly status: "failed" }>["reason"],
): ProjectLifecycleResult {
  return Object.freeze({ status: "failed", reason });
}

function sourceSetsEqual(first: EditableProjectRecord, second: EditableProjectRecord): boolean {
  return sameSet(sourceSurfaceIds(first), sourceSurfaceIds(second));
}

/**
 * Creates an isolated, generation-fenced controller for ordinary project lifecycle operations.
 *
 * @remarks The controller has no implicit persistence. It preserves the last admitted workspace
 * across invalid opens, stale writes and interrupted saves; after an indeterminate write callers
 * must reopen before attempting another save.
 */
export function createProjectLifecycleController(
  options: ProjectLifecycleControllerOptions,
): ProjectLifecycleController | null {
  const capturedOptions =
    ownRecord(options, ["initialWorkspace", "storagePort"]) ??
    ownRecord(options, ["initialWorkspace", "storagePort", "admitWorkspace"]);
  const initialWorkspace = captureInitial(capturedOptions?.initialWorkspace);
  const storagePort = capturePort(capturedOptions?.storagePort);
  if (initialWorkspace === undefined || storagePort === undefined) return null;
  const admission = capturedOptions?.admitWorkspace;
  if (admission !== undefined && typeof admission !== "function") return null;
  let checkingWorkspace = false;
  const acceptsWorkspace = (workspace: ProjectWorkspaceRecord): boolean => {
    if (checkingWorkspace) return false;
    checkingWorkspace = true;
    try {
      return admission === undefined || admission(workspace) === true;
    } catch {
      return false;
    } finally {
      checkingWorkspace = false;
    }
  };
  if (!acceptsWorkspace(initialWorkspace)) return null;
  const openWorkspace = storagePort.openWorkspace;
  const saveWorkspace = storagePort.saveWorkspace;
  const listeners = new Set<() => void>();
  let state: ProjectLifecycleState = Object.freeze({
    workspace: initialWorkspace,
    savedWorkspace: null,
    generation: null,
    dirty: initialWorkspace.projects.length > 0 || initialWorkspace.deletedProjects.length > 0,
    reopenRequired: false,
    pending: null,
    result: null,
    lastSaveMode: null,
    disposed: false,
  });
  let requestedSaveMode: "autosave" | "explicit" | null = null;
  const replace = (
    next: Omit<ProjectLifecycleState, "disposed"> & { readonly disposed?: boolean },
  ): void => {
    state = Object.freeze({ ...next, disposed: next.disposed ?? state.disposed });
    for (const listener of listeners) listener();
  };
  const mutate = (workspace: ProjectWorkspaceRecord): ProjectLifecycleResult | null => {
    if (state.disposed) return resultFailure("disposed");
    if (state.pending !== null || checkingWorkspace) return resultFailure("operation-in-progress");
    const observed = state;
    const accepted = acceptsWorkspace(workspace);
    if (state.disposed) return resultFailure("disposed");
    if (state !== observed) return resultFailure("operation-in-progress");
    if (!accepted) return resultFailure("invalid-workspace");
    replace({
      ...state,
      workspace,
      dirty:
        state.savedWorkspace === null ||
        canonicalizeJson(workspace) !== canonicalizeJson(state.savedWorkspace),
      result: null,
    });
    return null;
  };
  const controller: ProjectLifecycleController = Object.freeze({
    read: () => state,
    subscribe: (listener: () => void) => {
      if (state.disposed || typeof listener !== "function") return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open: async () => {
      if (state.disposed) return resultFailure("disposed");
      if (state.pending !== null || checkingWorkspace)
        return resultFailure("operation-in-progress");
      replace({ ...state, pending: "opening", result: null });
      if (state.disposed) return resultFailure("disposed");
      let outcome: ProjectWorkspaceOpenResult;
      try {
        outcome = captureOpenResult(await openWorkspace());
      } catch {
        outcome = { status: "failed" };
      }
      if (state.disposed) return resultFailure("disposed");
      if (outcome.status === "missing") {
        const result = Object.freeze({ status: "missing" } as const);
        replace({ ...state, pending: null, result });
        return result;
      }
      if (outcome.status !== "opened" || generation(outcome.generation) === undefined) {
        const result = resultFailure("storage-failed");
        replace({ ...state, pending: null, result });
        return result;
      }
      const admitted = admitProjectWorkspaceRecord(outcome.workspace);
      if (state.disposed) return resultFailure("disposed");
      if (!admitted.ok) {
        const result = resultFailure(admitted.reason);
        replace({ ...state, pending: null, result });
        return result;
      }
      const accepted = acceptsWorkspace(admitted.workspace);
      if (state.disposed) return resultFailure("disposed");
      if (!accepted) {
        const result = resultFailure("invalid-workspace");
        replace({ ...state, pending: null, result });
        return result;
      }
      const result = Object.freeze({ status: "opened", generation: outcome.generation } as const);
      replace({
        workspace: admitted.workspace,
        savedWorkspace: admitted.workspace,
        generation: outcome.generation,
        dirty: false,
        reopenRequired: false,
        pending: null,
        result,
        lastSaveMode: state.lastSaveMode,
      });
      return result;
    },
    save: async () => {
      if (state.disposed) return resultFailure("disposed");
      if (state.pending !== null || checkingWorkspace)
        return resultFailure("operation-in-progress");
      if (state.reopenRequired) return resultFailure("reopen-required");
      const lastSaveMode = requestedSaveMode ?? "explicit";
      requestedSaveMode = null;
      const request = Object.freeze({
        expectedGeneration: state.generation,
        workspace: state.workspace,
      });
      replace({ ...state, pending: "saving", result: null, lastSaveMode });
      if (state.disposed) return resultFailure("disposed");
      let outcome: ProjectWorkspaceSaveResult;
      try {
        outcome = captureSaveResult(await saveWorkspace(request));
      } catch {
        // A rejected promise cannot prove that the already dispatched write did not commit.
        outcome = { status: "indeterminate" };
      }
      if (state.disposed) return resultFailure("disposed");
      if (
        (outcome.status === "created" ||
          outcome.status === "updated" ||
          outcome.status === "unchanged") &&
        generation(outcome.generation) !== undefined &&
        (outcome.status === "created"
          ? request.expectedGeneration === null && outcome.generation === 1
          : outcome.status === "updated"
            ? request.expectedGeneration !== null &&
              request.expectedGeneration < MAX_GENERATION &&
              outcome.generation === request.expectedGeneration + 1
            : request.expectedGeneration !== null &&
              outcome.generation === request.expectedGeneration &&
              state.savedWorkspace !== null &&
              canonicalizeJson(request.workspace) === canonicalizeJson(state.savedWorkspace))
      ) {
        const result = Object.freeze({
          status: outcome.status,
          generation: outcome.generation,
        } as const);
        replace({
          ...state,
          savedWorkspace: request.workspace,
          generation: outcome.generation,
          dirty: false,
          pending: null,
          result,
        });
        return result;
      }
      if (
        outcome.status === "conflict" &&
        (outcome.currentGeneration === null || generation(outcome.currentGeneration) !== undefined)
      ) {
        const result = Object.freeze({
          status: "conflict",
          currentGeneration: outcome.currentGeneration,
        } as const);
        replace({ ...state, pending: null, reopenRequired: true, result });
        return result;
      }
      if (outcome.status !== "failed") {
        const result = Object.freeze({ status: "indeterminate" } as const);
        replace({ ...state, pending: null, reopenRequired: true, result });
        return result;
      }
      const result = resultFailure("storage-failed");
      replace({ ...state, pending: null, result });
      return result;
    },
    autosave: async () => {
      if (state.disposed) return resultFailure("disposed");
      if (state.pending !== null || checkingWorkspace)
        return resultFailure("operation-in-progress");
      if (state.reopenRequired) return resultFailure("reopen-required");
      requestedSaveMode = "autosave";
      return controller.save();
    },
    createProject: (
      candidate: unknown,
      name: string,
      surfaceNames: readonly ProjectWorkspaceSurfaceName[],
    ) => {
      const record = admitProject(candidate);
      const projectName = label(name);
      if (typeof record === "string") return resultFailure(record);
      if (projectName === undefined) return resultFailure("invalid-project");
      if (
        !hasCoherentSourceReferences(record) ||
        state.workspace.projects.some((project) => project.id === record.id) ||
        state.workspace.deletedProjects.some((project) => project.id === record.id) ||
        state.workspace.projects.length >= PROJECT_WORKSPACE_LIMITS.maxProjects
      )
        return resultFailure("invalid-workspace");
      const surfaces = sourceSurfaceIds(record);
      const names = admitSurfaceNames(surfaceNames, surfaces);
      if (names === undefined) return resultFailure("invalid-surface-registry");
      const project = Object.freeze({
        id: record.id,
        name: projectName,
        record,
        surfaceOrder: surfaces,
        surfaceNames: names,
      });
      return mutate(
        Object.freeze({
          ...state.workspace,
          projects: Object.freeze([...state.workspace.projects, project]),
        }),
      );
    },
    renameProject: (projectId: string, name: string) => {
      const projectName = label(name);
      if (id(projectId) === undefined || projectName === undefined)
        return resultFailure("invalid-project");
      if (!state.workspace.projects.some((project) => project.id === projectId))
        return resultFailure("invalid-project");
      return mutate(
        Object.freeze({
          ...state.workspace,
          projects: Object.freeze(
            state.workspace.projects.map((project) =>
              project.id === projectId ? Object.freeze({ ...project, name: projectName }) : project,
            ),
          ),
        }),
      );
    },
    replaceProjectRecord: (projectId: string, candidate: unknown) => {
      const record = admitProject(candidate);
      if (typeof record === "string") return resultFailure(record);
      const previous = state.workspace.projects.find((project) => project.id === projectId);
      if (
        previous === undefined ||
        record.id !== projectId ||
        !hasCoherentSourceReferences(record) ||
        !sourceSetsEqual(previous.record, record)
      )
        return resultFailure("invalid-surface-registry");
      return mutate(
        Object.freeze({
          ...state.workspace,
          projects: Object.freeze(
            state.workspace.projects.map((project) =>
              project.id === projectId ? Object.freeze({ ...project, record }) : project,
            ),
          ),
        }),
      );
    },
    addSurface: (
      projectId: string,
      candidate: unknown,
      surfaceName: ProjectWorkspaceSurfaceName,
    ) => {
      const record = admitProject(candidate);
      const previous = state.workspace.projects.find((project) => project.id === projectId);
      const addedId = id(surfaceName?.id);
      const name = label(surfaceName?.name);
      if (typeof record === "string") return resultFailure(record);
      if (
        previous === undefined ||
        record.id !== projectId ||
        !hasCoherentSourceReferences(record) ||
        addedId === undefined ||
        name === undefined
      )
        return resultFailure("invalid-surface-registry");
      const previousIds = sourceSurfaceIds(previous.record);
      const nextIds = sourceSurfaceIds(record);
      if (
        nextIds.length !== previousIds.length + 1 ||
        !nextIds.includes(addedId) ||
        previousIds.some((surfaceId) => !nextIds.includes(surfaceId)) ||
        sourceFrame(record, addedId) === undefined
      )
        return resultFailure("invalid-surface-registry");
      const project = Object.freeze({
        ...previous,
        record,
        surfaceOrder: Object.freeze([...previous.surfaceOrder, addedId]),
        surfaceNames: Object.freeze([
          ...previous.surfaceNames,
          Object.freeze({ id: addedId, name }),
        ]),
      });
      return mutate(
        Object.freeze({
          ...state.workspace,
          projects: Object.freeze(
            state.workspace.projects.map((item) => (item.id === projectId ? project : item)),
          ),
        }),
      );
    },
    deleteSurface: (projectId: string, candidate: unknown, surfaceId: string) => {
      const record = admitProject(candidate);
      const previous = state.workspace.projects.find((project) => project.id === projectId);
      if (typeof record === "string") return resultFailure(record);
      if (
        previous === undefined ||
        record.id !== projectId ||
        !hasCoherentSourceReferences(record) ||
        id(surfaceId) === undefined ||
        sourceEntry(previous.record) === surfaceId
      )
        return resultFailure("invalid-surface-registry");
      const previousIds = sourceSurfaceIds(previous.record);
      const nextIds = sourceSurfaceIds(record);
      if (
        !previousIds.includes(surfaceId) ||
        nextIds.length !== previousIds.length - 1 ||
        nextIds.includes(surfaceId) ||
        nextIds.some((item) => !previousIds.includes(item)) ||
        !nextIds.includes(sourceEntry(record))
      )
        return resultFailure("invalid-surface-registry");
      const project = Object.freeze({
        ...previous,
        record,
        surfaceOrder: Object.freeze(previous.surfaceOrder.filter((item) => item !== surfaceId)),
        surfaceNames: Object.freeze(previous.surfaceNames.filter((item) => item.id !== surfaceId)),
      });
      return mutate(
        Object.freeze({
          ...state.workspace,
          projects: Object.freeze(
            state.workspace.projects.map((item) => (item.id === projectId ? project : item)),
          ),
        }),
      );
    },
    reorderSurfaces: (projectId: string, surfaceOrder: readonly string[]) => {
      const project = state.workspace.projects.find((candidate) => candidate.id === projectId);
      if (
        project === undefined ||
        !Array.isArray(surfaceOrder) ||
        !surfaceOrder.every((surfaceId) => id(surfaceId) !== undefined) ||
        !sameSet(sourceSurfaceIds(project.record), surfaceOrder)
      )
        return resultFailure("invalid-surface-registry");
      return mutate(
        Object.freeze({
          ...state.workspace,
          projects: Object.freeze(
            state.workspace.projects.map((candidate) =>
              candidate.id === projectId
                ? Object.freeze({ ...candidate, surfaceOrder: Object.freeze([...surfaceOrder]) })
                : candidate,
            ),
          ),
        }),
      );
    },
    renameSurface: (projectId: string, surfaceId: string, name: string) => {
      const project = state.workspace.projects.find((candidate) => candidate.id === projectId);
      const surfaceName = label(name);
      if (
        project === undefined ||
        !sourceSurfaceIds(project.record).includes(surfaceId) ||
        surfaceName === undefined
      )
        return resultFailure("invalid-surface-registry");
      return mutate(
        Object.freeze({
          ...state.workspace,
          projects: Object.freeze(
            state.workspace.projects.map((candidate) =>
              candidate.id === projectId
                ? Object.freeze({
                    ...candidate,
                    surfaceNames: Object.freeze(
                      candidate.surfaceNames.map((entry) =>
                        entry.id === surfaceId
                          ? Object.freeze({ id: entry.id, name: surfaceName })
                          : entry,
                      ),
                    ),
                  })
                : candidate,
            ),
          ),
        }),
      );
    },
    selectEntrySurface: (projectId: string, candidate: unknown, surfaceId: string) => {
      const record = admitProject(candidate);
      const previous = state.workspace.projects.find((project) => project.id === projectId);
      if (typeof record === "string") return resultFailure(record);
      if (
        previous === undefined ||
        record.id !== projectId ||
        !hasCoherentSourceReferences(record) ||
        !sourceSetsEqual(previous.record, record) ||
        sourceEntry(record) !== surfaceId ||
        !sourceSurfaceIds(record).includes(surfaceId)
      )
        return resultFailure("invalid-surface-registry");
      return mutate(
        Object.freeze({
          ...state.workspace,
          projects: Object.freeze(
            state.workspace.projects.map((item) =>
              item.id === projectId ? Object.freeze({ ...item, record }) : item,
            ),
          ),
        }),
      );
    },
    updateSurfaceFrame: (projectId: string, candidate: unknown, surfaceId: string) => {
      const record = admitProject(candidate);
      const previous = state.workspace.projects.find((project) => project.id === projectId);
      if (typeof record === "string") return resultFailure(record);
      if (
        previous === undefined ||
        record.id !== projectId ||
        !hasCoherentSourceReferences(record) ||
        !sourceSetsEqual(previous.record, record) ||
        sourceFrame(record, surfaceId) === undefined
      )
        return resultFailure("invalid-surface-registry");
      return mutate(
        Object.freeze({
          ...state.workspace,
          projects: Object.freeze(
            state.workspace.projects.map((item) =>
              item.id === projectId ? Object.freeze({ ...item, record }) : item,
            ),
          ),
        }),
      );
    },
    deleteProject: (projectId: string) => {
      const project = state.workspace.projects.find((candidate) => candidate.id === projectId);
      if (
        project === undefined ||
        state.workspace.deletedProjects.length >= PROJECT_WORKSPACE_LIMITS.maxDeletedProjects
      )
        return resultFailure("invalid-project");
      return mutate(
        Object.freeze({
          ...state.workspace,
          projects: Object.freeze(
            state.workspace.projects.filter((candidate) => candidate.id !== projectId),
          ),
          deletedProjects: Object.freeze([project, ...state.workspace.deletedProjects]),
        }),
      );
    },
    recoverProject: (projectId: string) => {
      const project = state.workspace.deletedProjects.find(
        (candidate) => candidate.id === projectId,
      );
      if (
        project === undefined ||
        state.workspace.projects.length >= PROJECT_WORKSPACE_LIMITS.maxProjects
      )
        return resultFailure("invalid-project");
      return mutate(
        Object.freeze({
          ...state.workspace,
          projects: Object.freeze([...state.workspace.projects, project]),
          deletedProjects: Object.freeze(
            state.workspace.deletedProjects.filter((candidate) => candidate.id !== projectId),
          ),
        }),
      );
    },
    exportProject: (projectId: string) => {
      const project = state.workspace.projects.find((candidate) => candidate.id === projectId);
      return project === undefined ? null : canonicalizeJson(project.record);
    },
    discardChanges: () => {
      if (state.disposed) return resultFailure("disposed");
      if (state.pending !== null || checkingWorkspace)
        return resultFailure("operation-in-progress");
      if (state.reopenRequired) return resultFailure("reopen-required");
      const workspace = state.savedWorkspace ?? initialWorkspace;
      replace({
        ...state,
        workspace,
        dirty: false,
        reopenRequired: false,
        result: null,
      });
      return null;
    },
    dispose: () => {
      if (!state.disposed) {
        state = Object.freeze({ ...state, disposed: true, pending: null });
        listeners.clear();
      }
    },
  });
  return controller;
}
