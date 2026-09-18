import { createDesenEditorPersistencePort } from "@desen/editor-core";

import type {
  DesenEditorPersistenceAdapter,
  DesenEditorPersistenceAdapterFailureReason,
  DesenEditorPersistenceAdapterWriteRequest,
  DesenEditorPersistenceAdapterWriteResult,
  DesenEditorPersistencePort,
} from "@desen/editor-core";
import type { EditableProjectRecord } from "@desen/design-system-core";
import type {
  ProjectLifecycleController,
  ProjectWorkspaceSurfaceName,
} from "./project-lifecycle.js";

const SOURCE_KEY = /^[a-z][a-z0-9-]{0,63}$/u;
const MAX_GENERATION = Number.MAX_SAFE_INTEGER;

/** Maps the first logical Source generation onto its later aggregate workspace generation. */
interface SourceGenerationAlias {
  readonly sourceGeneration: number;
  readonly aggregateGeneration: number;
}

/** Inputs that bind one profile-owned Source route to a single aggregate T02 workspace store. */
export interface ProjectWorkspaceAuthoringPersistenceOptions {
  /** The only aggregate persistence controller; no parallel Source store is used. */
  readonly lifecycle: ProjectLifecycleController;
  /** Project record used only to create this route's missing ordinary project. */
  readonly initialProject: EditableProjectRecord;
  /** Application-owned visible name for the initial lifecycle project. */
  readonly projectName: string;
  /** Complete Source surface label registry required by the lifecycle boundary. */
  readonly surfaceNames: readonly ProjectWorkspaceSurfaceName[];
  /** The profile's exact host storage route identity. */
  readonly sourceKey: string;
}

/** Controlled failure to create an aggregate-workspace-backed editor persistence port. */
export type ProjectWorkspaceAuthoringPersistenceCreationResult =
  | Readonly<{ readonly ok: true; readonly persistencePort: DesenEditorPersistencePort }>
  | Readonly<{ readonly ok: false }>;

function failure(reason: DesenEditorPersistenceAdapterFailureReason): Readonly<{
  readonly status: "failed";
  readonly reason: DesenEditorPersistenceAdapterFailureReason;
}> {
  return Object.freeze({ status: "failed", reason });
}

function sourceKeyAccepted(options: ProjectWorkspaceAuthoringPersistenceOptions): boolean {
  return (
    typeof options.sourceKey === "string" &&
    SOURCE_KEY.test(options.sourceKey) &&
    typeof options.projectName === "string" &&
    options.projectName.length > 0 &&
    Array.isArray(options.surfaceNames) &&
    typeof options.lifecycle?.open === "function" &&
    typeof options.lifecycle?.read === "function" &&
    typeof options.lifecycle?.save === "function" &&
    typeof options.lifecycle?.createProject === "function" &&
    typeof options.lifecycle?.replaceProjectRecord === "function" &&
    typeof options.initialProject?.id === "string"
  );
}

function decodeSource(bytes: Readonly<Uint8Array>): unknown | undefined {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return undefined;
  }
}

function findProject(
  lifecycle: ProjectLifecycleController,
  projectId: string,
): EditableProjectRecord | undefined {
  return lifecycle.read().workspace.projects.find(({ id }) => id === projectId)?.record;
}

function writeSettlement(
  result: Awaited<ReturnType<ProjectLifecycleController["save"]>>,
): DesenEditorPersistenceAdapterWriteResult {
  switch (result.status) {
    case "created":
      // Editor Core deliberately reserves generation one for the first Source creation. Do not
      // coerce a malformed aggregate-storage receipt into that stronger public guarantee.
      return result.generation === 1
        ? Object.freeze({ status: "created" as const, generation: 1 })
        : failure("storage-unavailable");
    case "updated":
      return Object.freeze({ status: "updated" as const, generation: result.generation });
    case "unchanged":
      return Object.freeze({ status: "unchanged" as const, generation: result.generation });
    case "conflict":
      return Object.freeze({ status: "conflict", currentGeneration: result.currentGeneration });
    case "indeterminate":
      return Object.freeze({ status: "indeterminate" });
    case "failed":
    case "missing":
    case "opened":
      return failure(
        result.status === "failed" && result.reason === "operation-in-progress"
          ? "storage-busy"
          : "storage-unavailable",
      );
  }
}

/**
 * Bridges the public Editor Core persistence port onto the same complete T02 workspace record
 * used by `ProjectLifecycleController`.
 *
 * @remarks The bridge never writes a Source key independently. Each editor compare-and-set first
 * replaces the selected `record.source` inside the admitted aggregate workspace, then commits the
 * complete workspace at the generation observed by the lifecycle controller. Thus a stored Source
 * and its design-system token sources cannot diverge into two local truth stores.
 */
export function createProjectWorkspaceAuthoringPersistencePort(
  options: ProjectWorkspaceAuthoringPersistenceOptions,
): ProjectWorkspaceAuthoringPersistenceCreationResult {
  if (!sourceKeyAccepted(options)) return Object.freeze({ ok: false });
  const { initialProject, lifecycle, projectName, sourceKey, surfaceNames } = options;
  const projectId = initialProject.id;
  // A Source first inserted into an already-persisted aggregate is still Source generation one,
  // even though the aggregate advances from its own observed generation. Retain that mapping until
  // the next open observes a public generation directly from the aggregate.
  let sourceGenerationAlias: SourceGenerationAlias | undefined;

  const adapter: DesenEditorPersistenceAdapter = Object.freeze({
    readSource: async (requestedSourceKey: string) => {
      if (requestedSourceKey !== sourceKey) return failure("unsafe-storage");
      const opened = await lifecycle.open();
      if (opened.status === "missing") {
        sourceGenerationAlias = undefined;
        return Object.freeze({ status: "missing" });
      }
      if (opened.status !== "opened") {
        return failure(
          opened.status === "failed" && opened.reason === "operation-in-progress"
            ? "storage-busy"
            : "storage-unavailable",
        );
      }
      sourceGenerationAlias = undefined;
      const project = findProject(lifecycle, projectId);
      if (project === undefined) return Object.freeze({ status: "missing" });
      return Object.freeze({
        status: "found" as const,
        record: Object.freeze({
          sourceKey,
          generation: opened.generation,
          value: project.source,
        }),
      });
    },
    compareAndSetSource: async (request: DesenEditorPersistenceAdapterWriteRequest) => {
      if (request.sourceKey !== sourceKey) return failure("unsafe-storage");
      const snapshot = lifecycle.read();
      if (snapshot.pending !== null || snapshot.reopenRequired) return failure("storage-busy");
      const current = findProject(lifecycle, projectId);
      if (current === undefined) sourceGenerationAlias = undefined;
      const matchingAlias =
        current !== undefined &&
        sourceGenerationAlias?.sourceGeneration === request.expectedGeneration
          ? sourceGenerationAlias
          : undefined;
      if (
        current !== undefined &&
        sourceGenerationAlias !== undefined &&
        matchingAlias === undefined
      ) {
        return Object.freeze({
          status: "conflict" as const,
          currentGeneration: sourceGenerationAlias.sourceGeneration,
        });
      }
      const createsSourceInExistingAggregate =
        current === undefined &&
        request.expectedGeneration === null &&
        snapshot.generation !== null;
      const aggregateExpectedGeneration = createsSourceInExistingAggregate
        ? snapshot.generation
        : (matchingAlias?.aggregateGeneration ?? request.expectedGeneration);
      if (snapshot.generation !== aggregateExpectedGeneration) {
        return Object.freeze({
          status: "conflict" as const,
          currentGeneration: snapshot.generation,
        });
      }
      if (matchingAlias !== undefined && request.expectedGeneration === MAX_GENERATION) {
        return Object.freeze({
          status: "generation-exhausted" as const,
          generation: MAX_GENERATION,
        });
      }
      const source = decodeSource(request.bytes);
      if (source === undefined) return failure("source-invalid");
      if (current === undefined) {
        if (request.expectedGeneration !== null) {
          return Object.freeze({
            status: "conflict" as const,
            currentGeneration: snapshot.generation,
          });
        }
        const created = lifecycle.createProject(
          Object.freeze({ ...initialProject, source }),
          projectName,
          surfaceNames,
        );
        if (created !== null) return failure("source-invalid");
      } else {
        const replaced = lifecycle.replaceProjectRecord(
          projectId,
          Object.freeze({ ...current, source }),
        );
        if (replaced !== null) return failure("source-invalid");
      }
      const settlement = await lifecycle.save();
      if (createsSourceInExistingAggregate && settlement.status === "updated") {
        if (settlement.generation !== snapshot.generation + 1)
          return failure("storage-unavailable");
        sourceGenerationAlias = Object.freeze({
          sourceGeneration: 1,
          aggregateGeneration: settlement.generation,
        });
        return Object.freeze({ status: "created" as const, generation: 1 });
      }
      if (matchingAlias !== undefined && request.expectedGeneration !== null) {
        if (settlement.status === "updated") {
          if (settlement.generation !== matchingAlias.aggregateGeneration + 1) {
            return failure("storage-unavailable");
          }
          const nextSourceGeneration = request.expectedGeneration + 1;
          sourceGenerationAlias = Object.freeze({
            sourceGeneration: nextSourceGeneration,
            aggregateGeneration: settlement.generation,
          });
          return Object.freeze({ status: "updated" as const, generation: nextSourceGeneration });
        }
        if (settlement.status === "unchanged") {
          if (settlement.generation !== matchingAlias.aggregateGeneration) {
            return failure("storage-unavailable");
          }
          return Object.freeze({
            status: "unchanged" as const,
            generation: request.expectedGeneration,
          });
        }
      }
      return writeSettlement(settlement);
    },
  });

  try {
    return Object.freeze({ ok: true, persistencePort: createDesenEditorPersistencePort(adapter) });
  } catch {
    return Object.freeze({ ok: false });
  }
}
