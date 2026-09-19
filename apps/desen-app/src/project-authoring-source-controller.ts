import { canonicalizeJson } from "@desen/protocol";

import type {
  DesenEditorDocument,
  DesenEditorPersistenceDiagnostic,
  DesenEditorPersistencePort,
} from "@desen/editor-core";
import type { ProjectAuthoringController } from "./project-authoring-controller.js";
import type {
  AuthoringPersistenceController,
  AuthoringPersistenceOpenResult,
  AuthoringPersistenceRoute,
  AuthoringPersistenceSaveResult,
  AuthoringPersistenceState,
} from "./authoring-persistence-types.js";

type OpenReceipt =
  | Readonly<{ status: "missing" }>
  | Readonly<{ status: "opened"; generation: number; document: unknown }>
  | Readonly<{ status: "failed"; diagnostic: DesenEditorPersistenceDiagnostic }>;

/** Trusted construction inputs, authenticated by the owning persistence factory before use. */
export interface ProjectAuthoringSourceControllerOptions {
  /** The single source of project, Source, history, preview and dirty authority. */
  readonly project: ProjectAuthoringController;
  /** Factory-authenticated aggregate bridge; never a standalone Source store. */
  readonly port: DesenEditorPersistencePort;
  /** Profile-owned persistence identity. */
  readonly sourceKey: string;
  /** Exact admitted project/surface route. */
  readonly route: AuthoringPersistenceRoute;
  /** Shared strict capture of the existing Source port's open receipts. */
  readonly captureOpen: (input: unknown) => OpenReceipt | undefined;
  /** Shared strict capture of the existing Source port's generation-fenced save receipts. */
  readonly captureSave: (
    input: unknown,
    generation: number | null,
  ) => AuthoringPersistenceSaveResult | undefined;
}

/**
 * Adapts existing Source persistence UI to an authenticated aggregate bridge. The only retained
 * local data are transport receipts/lifetime, not a second editable Source, preview or history.
 * Port dispatch precedes observer delivery so the bridge acquires its existing aggregate lock
 * before a subscriber can react to a pending request.
 */
export function createProjectAuthoringSourceController({
  project,
  port,
  sourceKey,
  route,
  captureOpen,
  captureSave,
}: ProjectAuthoringSourceControllerOptions): AuthoringPersistenceController {
  const listeners = new Set<() => void>();
  let receipt = Object.freeze({
    generation: null,
    savedDocument: null,
    reopenRequired: false,
    pending: null,
    openResult: null,
    saveResult: null,
    disposed: false,
  }) as Pick<
    AuthoringPersistenceState,
    | "generation"
    | "savedDocument"
    | "reopenRequired"
    | "pending"
    | "openResult"
    | "saveResult"
    | "disposed"
  >;
  let observedReceipt: typeof receipt | null = null;
  let observedProject: ReturnType<ProjectAuthoringController["read"]> | null = null;
  let snapshot: AuthoringPersistenceState;
  const read = (): AuthoringPersistenceState => {
    const current = project.read();
    if (observedReceipt !== receipt || observedProject !== current) {
      observedReceipt = receipt;
      observedProject = current;
      snapshot = Object.freeze({
        ...receipt,
        sourceKey,
        route,
        session: current.session,
        dirty: current.dirty || receipt.generation === null || receipt.reopenRequired,
        reopenRequired: receipt.reopenRequired || current.reopenRequired,
        pending: receipt.pending ?? current.pending,
        disposed: receipt.disposed || current.disposed || current.unavailable,
      });
    }
    return snapshot;
  };
  function emit(): void {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        /* Observers cannot interrupt a completed transition. */
      }
    }
  }
  let unsubscribe: (() => void) | null = null;
  const failure = (
    reason: "disposed" | "operation-in-progress" | "reopen-required" | "persistence-failed",
  ) => Object.freeze({ status: "failed" as const, reason, diagnostic: null });
  const indeterminate = (): AuthoringPersistenceSaveResult =>
    Object.freeze({
      status: "indeterminate",
      diagnostic: Object.freeze({
        code: "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE",
        message: "The project may have committed; reopen it before another save.",
      }),
    });
  const controller: AuthoringPersistenceController = Object.freeze({
    read,
    subscribe: (listener: () => void) => {
      if (read().disposed || typeof listener !== "function") return () => undefined;
      listeners.add(listener);
      unsubscribe ??= project.subscribe(emit);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribe?.();
          unsubscribe = null;
        }
      };
    },
    replaceAuthoredDocument: (document: DesenEditorDocument) => {
      if (read().disposed) return Object.freeze({ ok: false, reason: "disposed" });
      const current = project.read();
      const result = project.replaceSource(current.session.digest, document);
      return result.ok
        ? Object.freeze({ ok: true, session: result.state.session })
        : Object.freeze({ ok: false, reason: "document-invalid" });
    },
    open: async () => {
      if (read().disposed) return failure("disposed");
      if (read().pending !== null) return failure("operation-in-progress");
      receipt = Object.freeze({
        ...receipt,
        pending: "opening",
        openResult: null,
        saveResult: null,
      });
      let captured: OpenReceipt | undefined;
      try {
        const dispatched = port.openSource(sourceKey);
        emit();
        captured = captureOpen(await dispatched);
      } catch {
        captured = undefined;
      }
      if (read().disposed) return failure("disposed");
      let result: AuthoringPersistenceOpenResult;
      if (captured?.status === "opened") {
        const current = project.read();
        if (canonicalizeJson(captured.document) !== canonicalizeJson(current.session.document))
          result = failure("persistence-failed");
        else {
          result = Object.freeze({
            status: "opened",
            generation: captured.generation,
            session: current.session,
          });
          receipt = Object.freeze({
            ...receipt,
            generation: captured.generation,
            savedDocument: current.session.document,
            reopenRequired: false,
          });
        }
      } else if (captured?.status === "missing") {
        result = Object.freeze({ status: "missing" });
        receipt = Object.freeze({
          ...receipt,
          generation: null,
          savedDocument: null,
          reopenRequired: false,
        });
      } else
        result =
          captured?.status === "failed"
            ? Object.freeze({
                status: "failed",
                reason: "persistence-failed",
                diagnostic: captured.diagnostic,
              })
            : failure("persistence-failed");
      receipt = Object.freeze({ ...receipt, pending: null, openResult: result });
      emit();
      return result;
    },
    save: async () => {
      if (read().disposed) return failure("disposed");
      if (read().pending !== null) return failure("operation-in-progress");
      if (read().reopenRequired) return failure("reopen-required");
      const document = project.read().session.document;
      const generation = receipt.generation;
      receipt = Object.freeze({
        ...receipt,
        pending: "saving",
        openResult: null,
        saveResult: null,
      });
      let result: AuthoringPersistenceSaveResult;
      try {
        const dispatched = port.saveSource(
          Object.freeze({ sourceKey, document, expectedGeneration: generation }),
        );
        emit();
        result = captureSave(await dispatched, generation) ?? indeterminate();
      } catch {
        result = indeterminate();
      }
      if (read().disposed) return failure("disposed");
      if (
        result.status === "created" ||
        result.status === "updated" ||
        result.status === "unchanged"
      ) {
        receipt = Object.freeze({
          ...receipt,
          generation: result.generation,
          savedDocument: document,
          reopenRequired: false,
        });
      } else if (
        result.status === "conflict" ||
        result.status === "indeterminate" ||
        result.status === "generation-exhausted"
      ) {
        receipt = Object.freeze({ ...receipt, reopenRequired: true });
      }
      receipt = Object.freeze({ ...receipt, pending: null, saveResult: result });
      emit();
      return result;
    },
    dispose: () => {
      if (receipt.disposed) return;
      unsubscribe?.();
      unsubscribe = null;
      receipt = Object.freeze({ ...receipt, disposed: true, pending: null });
      emit();
      listeners.clear();
    },
  });
  return controller;
}
