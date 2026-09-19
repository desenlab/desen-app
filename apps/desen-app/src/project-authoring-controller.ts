/* eslint-disable @typescript-eslint/no-invalid-void-type -- Receiver-independent external store. */
import {
  createEditableProjectHistory,
  prepareEditableProjectRecipeTransaction,
  recordEditableProjectHistory,
  redoEditableProjectHistory,
  undoEditableProjectHistory,
} from "@desen/design-system-core";
import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";
import { createDesenEditorDocument } from "@desen/editor-core";

import { prepareProjectAuthoringSession } from "./project-authoring-session.js";
import { readProjectWorkspaceProfileAuthority } from "./project-workspace-profile.js";

import type { EditableProjectHistory, EditableProjectRecord } from "@desen/design-system-core";
import type {
  ProjectAuthoringSession,
  ProjectAuthoringSessionFailureReason,
} from "./project-authoring-session.js";
import type { ProjectLifecycleController, ProjectLifecycleState } from "./project-lifecycle.js";
import type { ProjectWorkspaceProfileHandle } from "./project-workspace-profile.js";

/** Stable whole-project state retained above route-owned surface editors. */
export interface ProjectAuthoringState {
  /** One exact complete project and its already admitted ordinary-Source preview. */
  readonly session: ProjectAuthoringSession;
  /** Whole-project history, including Source-identical metadata operations. */
  readonly history: EditableProjectHistory;
  /** Last opened/saved project, or the initial local baseline before storage creation. */
  readonly baseline: EditableProjectRecord;
  /** Canonical whole-project difference from that baseline, not Source-only difference. */
  readonly dirty: boolean;
  /** The existing lifecycle controller's current storage operation, never a second generation. */
  readonly pending: ProjectLifecycleState["pending"];
  /** The existing lifecycle controller requires a fresh open before further edits or saves. */
  readonly reopenRequired: boolean;
  /** An incompatible lifecycle replacement cannot become authoring authority. */
  readonly unavailable: boolean;
  /** Disposed sessions cannot mutate or acquire a new storage generation. */
  readonly disposed: boolean;
}

/** Bounded rejection classification; failures contain no provisional project or preview. */
export type ProjectAuthoringFailureReason =
  | ProjectAuthoringSessionFailureReason
  | "operation-in-progress"
  | "reopen-required"
  | "disposed"
  | "project-stale"
  | "history-rejected"
  | "recipe-rejected";

/** Result of an atomic App-owned project/history transition. */
export type ProjectAuthoringResult =
  | Readonly<{ ok: true; changed: boolean; state: ProjectAuthoringState }>
  | Readonly<{ ok: false; reason: ProjectAuthoringFailureReason }>;

/** Construction requires a trusted profile and the one existing workspace persistence authority. */
export interface ProjectAuthoringControllerOptions {
  /** Exact installed profile; project data cannot substitute a handle. */
  readonly profile: ProjectWorkspaceProfileHandle;
  /** Initial complete project used only until storage is explicitly opened. */
  readonly initialProject: EditableProjectRecord;
  /** Must use matching profile admission before replacing its active workspace. */
  readonly lifecycle: ProjectLifecycleController;
}

/** Whole-project draft controller; persistence still belongs exclusively to the T10 lifecycle. */
export interface ProjectAuthoringController {
  /** Reads one stable, immutable project/history/preview/dirty snapshot. */
  readonly read: (this: void) => ProjectAuthoringState;
  /** Observes complete authoring transitions, never intermediate materializations. */
  readonly subscribe: (this: void, listener: () => void) => () => void;
  /** Admits an exact complete candidate before atomically replacing all authoring state. */
  readonly replaceProject: (
    this: void,
    expectedDigest: string,
    candidate: unknown,
  ) => ProjectAuthoringResult;
  /** Reconciles visual prop/style edits into explicit overrides before admitting the whole project. */
  readonly replaceSource: (
    this: void,
    expectedDigest: string,
    source: unknown,
  ) => ProjectAuthoringResult;
  /** Performs a structured master/instance operation with its required observed-project fence. */
  readonly applyRecipe: (this: void, command: unknown) => ProjectAuthoringResult;
  /** Restores one exact preceding project after fresh profile/Publisher preflight. */
  readonly undo: (this: void, expectedDigest: string) => ProjectAuthoringResult;
  /** Restores one exact next project after fresh profile/Publisher preflight. */
  readonly redo: (this: void, expectedDigest: string) => ProjectAuthoringResult;
  /** Restores the complete baseline and clears history; never repairs uncertain storage. */
  readonly discard: (this: void, expectedDigest: string) => ProjectAuthoringResult;
  /**
   * Captures the complete current project only for its exact ordinary Source bytes. The Source
   * bridge must persist this record, not reconstruct a project from unrelated Source/metadata.
   */
  readonly captureForSave: (this: void, source: unknown) => EditableProjectRecord | null;
  /**
   * Holds an edit lock from exact snapshot capture through the trusted bridge's settlement.
   * The callback still uses the existing lifecycle CAS; null means it was never invoked.
   */
  readonly saveSnapshot: <Result>(
    this: void,
    source: unknown,
    persist: (record: EditableProjectRecord) => Promise<Result>,
  ) => Promise<Result | null>;
  /** Revokes only this authoring lifetime; the shared lifecycle remains owned by its creator. */
  readonly dispose: (this: void) => void;
}

const CONTROLLER_PROFILES = new WeakMap<
  ProjectAuthoringController,
  ProjectWorkspaceProfileHandle
>();
const CONTROLLER_LIFECYCLES = new WeakMap<ProjectAuthoringController, ProjectLifecycleController>();

/** Checks the sole durable lifecycle paired with this factory-created aggregate draft. */
export function authenticateProjectAuthoringControllerLifecycle(
  controller: ProjectAuthoringController,
  lifecycle: ProjectLifecycleController,
): boolean {
  return CONTROLLER_LIFECYCLES.get(controller) === lifecycle;
}

/** Authenticates a factory-created aggregate controller against the exact installed profile. */
export function authenticateProjectAuthoringControllerProfile(
  controller: unknown,
  profile: ProjectWorkspaceProfileHandle,
): controller is ProjectAuthoringController {
  return (
    typeof controller === "object" &&
    controller !== null &&
    CONTROLLER_PROFILES.get(controller as ProjectAuthoringController) === profile
  );
}

function rejected(reason: ProjectAuthoringFailureReason): ProjectAuthoringResult {
  return Object.freeze({ ok: false, reason });
}

function alignSession(
  session: ProjectAuthoringSession,
  history: EditableProjectHistory,
): ProjectAuthoringSession {
  // History re-admits its input. Keep one shared record/Source object in the published snapshot;
  // the preview and digest already authenticate these canonically identical bytes.
  return Object.freeze({ ...session, record: history.record, document: history.record.source });
}

/**
 * Creates one aggregate editing authority without writing storage or introducing a Source store.
 * Candidates, undo/redo and explicit discard preflight before one immutable state replacement.
 * Lifecycle Save/Open locks are shared; failed/stale work preserves history, dirty and preview.
 */
export function createProjectAuthoringController({
  profile,
  initialProject,
  lifecycle,
}: ProjectAuthoringControllerOptions): ProjectAuthoringController | null {
  const authority = readProjectWorkspaceProfileAuthority(profile);
  const initial = prepareProjectAuthoringSession(profile, initialProject);
  if (authority.status !== "read" || !initial.ok || lifecycle.read().disposed) return null;
  const initialSession = initial.session;
  const initialHistory = createEditableProjectHistory(initialSession.record);
  if (initialHistory === undefined) return null;
  let observedLifecycle: ProjectLifecycleState | null = null;
  let executing = false;
  let savingSnapshot = false;
  let transactionState: ProjectAuthoringState | null = null;
  let notifying = false;
  const listeners = new Set<() => void>();
  let state: ProjectAuthoringState = Object.freeze({
    session: alignSession(initialSession, initialHistory),
    history: initialHistory,
    baseline: initialHistory.record,
    dirty: false,
    pending: null,
    reopenRequired: false,
    unavailable: false,
    disposed: false,
  });
  function emit(): void {
    notifying = true;
    try {
      for (const listener of listeners) {
        try {
          listener();
        } catch {
          /* A UI subscriber cannot invalidate a completed commit. */
        }
      }
    } finally {
      notifying = false;
    }
  }
  function syncLifecycle(notify: boolean): void {
    const current = lifecycle.read();
    if (state.disposed || current === observedLifecycle) return;
    const previous = observedLifecycle;
    observedLifecycle = current;
    let next = {
      ...state,
      pending: current.pending ?? (savingSnapshot ? ("saving" as const) : null),
      reopenRequired: current.reopenRequired,
      disposed: current.disposed,
    };
    const opened = current.result?.status === "opened" && current.result !== previous?.result;
    if (opened) {
      const record =
        current.workspace.projects.find(({ id }) => id === initialSession.record.id)?.record ??
        initialSession.record;
      const prepared = prepareProjectAuthoringSession(profile, record);
      const history = prepared.ok
        ? createEditableProjectHistory(prepared.session.record)
        : undefined;
      if (!prepared.ok || history === undefined) next.unavailable = true;
      else
        next = {
          ...next,
          session: alignSession(prepared.session, history),
          history,
          baseline: history.record,
          dirty: false,
          unavailable: false,
        };
    } else if (
      current.savedWorkspace !== previous?.savedWorkspace &&
      current.savedWorkspace !== null
    ) {
      const saved = current.savedWorkspace.projects.find(
        ({ id }) => id === initialSession.record.id,
      )?.record;
      if (saved !== undefined)
        next = {
          ...next,
          baseline: saved,
          dirty: digestCanonicalJson(saved) !== next.session.digest,
        };
    }
    state = Object.freeze(next);
    if (notify) emit();
  }
  function guard(expectedDigest?: string): ProjectAuthoringFailureReason | null {
    syncLifecycle(false);
    if (state.disposed) return "disposed";
    if (executing || notifying || state.pending !== null) return "operation-in-progress";
    if (state.reopenRequired) return "reopen-required";
    if (state.unavailable) return "project-invalid";
    if (expectedDigest !== undefined && expectedDigest !== state.session.digest)
      return "project-stale";
    return null;
  }
  function commit(
    candidate: unknown,
    historyTransition?: EditableProjectHistory,
  ): ProjectAuthoringResult {
    syncLifecycle(false);
    if (state.disposed) return rejected("disposed");
    if (state !== transactionState) return rejected("project-stale");
    const observed = state;
    const prepared = prepareProjectAuthoringSession(profile, candidate);
    if (!prepared.ok) return rejected(prepared.reason);
    const recorded =
      historyTransition === undefined
        ? recordEditableProjectHistory(state.history, prepared.session.record)
        : { ok: true as const, history: historyTransition };
    if (!recorded.ok) return rejected("history-rejected");
    syncLifecycle(false);
    if (state.disposed) return rejected("disposed");
    if (state !== observed) return rejected("project-stale");
    const changed = state.session.digest !== prepared.session.digest;
    if (!changed && recorded.history === state.history)
      return Object.freeze({ ok: true, changed: false, state });
    state = Object.freeze({
      ...state,
      session: alignSession(prepared.session, recorded.history),
      history: recorded.history,
      dirty: prepared.session.digest !== digestCanonicalJson(state.baseline),
    });
    emit();
    return Object.freeze({ ok: true, changed, state });
  }
  function perform(
    expectedDigest: string | undefined,
    operation: () => ProjectAuthoringResult,
    checksDigest = true,
  ): ProjectAuthoringResult {
    const failure = guard();
    if (failure !== null) return rejected(failure);
    if (checksDigest && expectedDigest !== state.session.digest) return rejected("project-stale");
    executing = true;
    transactionState = state;
    try {
      return operation();
    } finally {
      executing = false;
      transactionState = null;
    }
  }
  const unsubscribe = lifecycle.subscribe(() => syncLifecycle(true));
  syncLifecycle(false);
  const controller: ProjectAuthoringController = Object.freeze({
    read: () => {
      syncLifecycle(false);
      return state;
    },
    subscribe: (listener: () => void) => {
      if (state.disposed || typeof listener !== "function") return () => undefined;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    replaceProject: (expectedDigest: string, candidate: unknown) =>
      perform(expectedDigest, () => commit(candidate)),
    replaceSource: (expectedDigest: string, source: unknown) =>
      perform(expectedDigest, () => {
        const candidate = prepareEditableProjectRecipeTransaction(
          state.session.record,
          { type: "source.apply", expectedProjectDigest: expectedDigest, source },
          authority.profile.catalogs,
        );
        return candidate.ok ? commit(candidate.record) : rejected("recipe-rejected");
      }),
    applyRecipe: (command: unknown) =>
      perform(
        undefined,
        () => {
          const candidate = prepareEditableProjectRecipeTransaction(
            state.session.record,
            command,
            authority.profile.catalogs,
          );
          return candidate.ok ? commit(candidate.record) : rejected("recipe-rejected");
        },
        false,
      ),
    undo: (expectedDigest: string) =>
      perform(expectedDigest, () => {
        const result = undoEditableProjectHistory(state.history);
        return result.ok
          ? commit(result.history.record, result.history)
          : rejected("history-rejected");
      }),
    redo: (expectedDigest: string) =>
      perform(expectedDigest, () => {
        const result = redoEditableProjectHistory(state.history);
        return result.ok
          ? commit(result.history.record, result.history)
          : rejected("history-rejected");
      }),
    discard: (expectedDigest: string) =>
      perform(expectedDigest, () => {
        const history = createEditableProjectHistory(state.baseline);
        return history === undefined
          ? rejected("history-rejected")
          : commit(history.record, history);
      }),
    captureForSave: (source: unknown) => {
      if (guard() !== null) return null;
      executing = true;
      const observed = state;
      try {
        const captured = createDesenEditorDocument(source);
        const match =
          captured.ok &&
          canonicalizeJson(captured.document) === canonicalizeJson(observed.session.document);
        syncLifecycle(false);
        return match && state === observed && !state.disposed ? observed.session.record : null;
      } catch {
        return null;
      } finally {
        executing = false;
      }
    },
    saveSnapshot: async <Result>(
      source: unknown,
      persist: (record: EditableProjectRecord) => Promise<Result>,
    ) => {
      const snapshot = controller.captureForSave(source);
      if (snapshot === null || typeof persist !== "function") return null;
      savingSnapshot = true;
      state = Object.freeze({ ...state, pending: "saving" });
      emit();
      try {
        if (state.disposed) return null;
        return await persist(snapshot);
      } finally {
        savingSnapshot = false;
        if (!state.disposed) {
          state = Object.freeze({ ...state, pending: lifecycle.read().pending });
          emit();
        }
      }
    },
    dispose: () => {
      if (state.disposed) return;
      unsubscribe();
      state = Object.freeze({ ...state, disposed: true, pending: null });
      emit();
      listeners.clear();
    },
  });
  CONTROLLER_PROFILES.set(controller, profile);
  CONTROLLER_LIFECYCLES.set(controller, lifecycle);
  return controller;
}
