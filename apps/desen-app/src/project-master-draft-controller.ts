/* eslint-disable @typescript-eslint/no-invalid-void-type -- Receiver-independent external store. */
import {
  createEditableProjectHistory,
  createEditableProjectMasterDraft,
  prepareEditableProjectMasterDraftUpdate,
  prepareEditableProjectRecipeTransaction,
  recordEditableProjectHistory,
  redoEditableProjectHistory,
  undoEditableProjectHistory,
} from "@desen/design-system-core";

import { authenticateProjectAuthoringControllerProfile } from "./project-authoring-controller.js";
import { prepareProjectAuthoringSession } from "./project-authoring-session.js";
import { readProjectWorkspaceProfileAuthority } from "./project-workspace-profile.js";

import type { EditableProjectHistory, EditableProjectMasterDraft } from "@desen/design-system-core";
import type {
  ProjectAuthoringController,
  ProjectAuthoringFailureReason,
  ProjectAuthoringResult,
  ProjectAuthoringState,
} from "./project-authoring-controller.js";
import type { ProjectWorkspaceProfileHandle } from "./project-workspace-profile.js";

/** Isolated editor authority with no Save, Open, storage port, Run or publication method. */
export interface ProjectMasterDraftController {
  /** Authentic Core projection and its observed live-project identity. */
  readonly draft: EditableProjectMasterDraft;
  /** Stable preview/history snapshot belonging only to this temporary editing session. */
  readonly read: (this: void) => ProjectAuthoringState;
  /** Observes complete isolated transitions and live-project invalidation. */
  readonly subscribe: (this: void, listener: () => void) => () => void;
  /** Uses the normal Source edit boundary; conflicts reject before replacing the draft. */
  readonly replaceSource: (
    this: void,
    expectedDigest: string,
    source: unknown,
  ) => ProjectAuthoringResult;
  /** Only nested-instance operations are allowed; other definitions cannot be edited here. */
  readonly applyRecipe: (this: void, command: unknown) => ProjectAuthoringResult;
  /** Undoes one isolated draft edit without touching live project history. */
  readonly undo: (this: void, expectedDigest: string) => ProjectAuthoringResult;
  /** Redoes one isolated draft edit without touching live project history. */
  readonly redo: (this: void, expectedDigest: string) => ProjectAuthoringResult;
  /** Atomically applies to the observed live project, then revokes this draft on success. */
  readonly apply: (this: void, expectedDigest: string) => ProjectAuthoringResult;
  /** Discards only this draft and its subscriptions; the live project remains unchanged. */
  readonly dispose: (this: void) => void;
}

/** Construction either exposes one isolated controller or no partial draft/preview. */
export type ProjectMasterDraftControllerResult =
  | Readonly<{ ok: true; controller: ProjectMasterDraftController }>
  | Readonly<{ ok: false; reason: ProjectAuthoringFailureReason }>;

function rejected(
  reason: ProjectAuthoringFailureReason,
): Readonly<{ ok: false; reason: ProjectAuthoringFailureReason }> {
  return Object.freeze({ ok: false, reason });
}

/**
 * Creates a visual master session bound to an authentic profile and existing live aggregate.
 * No subscription is acquired until observed, and no temporary record can enter persistence.
 */
export function createProjectMasterDraftController(
  project: ProjectAuthoringController,
  profile: ProjectWorkspaceProfileHandle,
  masterId: string,
  surfaceId: string,
  expectedProjectDigest: string,
): ProjectMasterDraftControllerResult {
  if (!authenticateProjectAuthoringControllerProfile(project, profile))
    return rejected("profile-invalid");
  const authority = readProjectWorkspaceProfileAuthority(profile);
  if (authority.status !== "read") return rejected("profile-invalid");
  const catalogs = authority.profile.catalogs;
  const live = project.read();
  if (live.disposed) return rejected("disposed");
  if (live.pending !== null) return rejected("operation-in-progress");
  if (live.reopenRequired) return rejected("reopen-required");
  if (live.unavailable) return rejected("project-invalid");
  const opened = createEditableProjectMasterDraft(
    live.session.record,
    {
      masterId,
      surfaceId,
      expectedProjectDigest,
    },
    authority.profile.catalogs,
  );
  if (!opened.ok)
    return rejected(
      live.session.digest !== expectedProjectDigest ? "project-stale" : "recipe-rejected",
    );
  const draft = opened.draft;
  const prepared = prepareProjectAuthoringSession(profile, draft.record);
  if (!prepared.ok) return rejected(prepared.reason);
  const initialSession = prepared.session;
  const initialHistory = createEditableProjectHistory(prepared.session.record);
  if (initialHistory === undefined) return rejected("history-rejected");
  let state: ProjectAuthoringState = Object.freeze({
    session: Object.freeze({
      ...initialSession,
      record: initialHistory.record,
      document: initialHistory.record.source,
    }),
    history: initialHistory,
    baseline: initialHistory.record,
    dirty: false,
    pending: null,
    reopenRequired: false,
    unavailable: false,
    disposed: false,
  });
  let executing = false;
  let notificationDepth = 0;
  let unsubscribe: (() => void) | null = null;
  const listeners = new Set<() => void>();
  function emit(): void {
    notificationDepth++;
    try {
      for (const listener of listeners) {
        try {
          listener();
        } catch {
          /* Observers cannot undo a committed draft. */
        }
      }
    } finally {
      notificationDepth--;
    }
  }
  function sync(notify: boolean): void {
    if (state.disposed) return;
    const current = project.read();
    const unavailable =
      current.unavailable ||
      current.disposed ||
      current.session.digest !== draft.expectedProjectDigest;
    if (
      state.pending === current.pending &&
      state.reopenRequired === current.reopenRequired &&
      state.unavailable === unavailable
    )
      return;
    state = Object.freeze({
      ...state,
      pending: current.pending,
      reopenRequired: current.reopenRequired,
      unavailable,
    });
    if (notify) emit();
  }
  function perform(
    expectedDigest: string | undefined,
    operation: () => ProjectAuthoringResult,
    checkDigest = true,
  ): ProjectAuthoringResult {
    sync(false);
    if (state.disposed) return rejected("disposed");
    if (executing || notificationDepth > 0 || state.pending !== null)
      return rejected("operation-in-progress");
    if (state.reopenRequired) return rejected("reopen-required");
    if (state.unavailable || (checkDigest && expectedDigest !== state.session.digest))
      return rejected("project-stale");
    executing = true;
    try {
      return operation();
    } catch {
      return rejected("recipe-rejected");
    } finally {
      executing = false;
    }
  }
  function commit(candidate: unknown, history?: EditableProjectHistory): ProjectAuthoringResult {
    const observed = state;
    // Check the complete eventual update before exposing a draft edit. This includes foreign
    // surface/metadata edits, recursive nesting and loss of a live instance's explicit override.
    const result = prepareEditableProjectMasterDraftUpdate(
      project.read().session.record,
      draft,
      candidate,
      catalogs,
    );
    if (!result.ok) return rejected("recipe-rejected");
    const next = prepareProjectAuthoringSession(profile, candidate);
    if (!next.ok) return rejected(next.reason);
    const recorded =
      history === undefined
        ? recordEditableProjectHistory(state.history, next.session.record)
        : { ok: true as const, history };
    if (!recorded.ok) return rejected("history-rejected");
    sync(false);
    if (state.disposed) return rejected("disposed");
    if (state !== observed) return rejected("project-stale");
    const changed = state.session.digest !== next.session.digest;
    if (!changed && recorded.history === state.history)
      return Object.freeze({ ok: true, changed: false, state });
    state = Object.freeze({
      ...state,
      session: Object.freeze({
        ...next.session,
        record: recorded.history.record,
        document: recorded.history.record.source,
      }),
      history: recorded.history,
      dirty: next.session.digest !== initialSession.digest,
    });
    emit();
    return Object.freeze({ ok: true, changed, state });
  }
  const controller: ProjectMasterDraftController = Object.freeze({
    draft,
    read: () => {
      sync(false);
      return state;
    },
    subscribe: (listener: () => void) => {
      if (state.disposed || typeof listener !== "function") return () => undefined;
      listeners.add(listener);
      if (unsubscribe === null) unsubscribe = project.subscribe(() => sync(true));
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribe?.();
          unsubscribe = null;
        }
      };
    },
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
          const descriptor =
            command !== null && typeof command === "object"
              ? Object.getOwnPropertyDescriptor(command, "type")
              : undefined;
          if (
            descriptor === undefined ||
            !("value" in descriptor) ||
            ![
              "instance.insert",
              "instance.override",
              "instance.reset",
              "instance.detach",
              "instance.delete",
            ].includes(descriptor.value as string)
          )
            return rejected("recipe-rejected");
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
    apply: (expectedDigest: string) =>
      perform(expectedDigest, () => {
        const candidate = prepareEditableProjectMasterDraftUpdate(
          project.read().session.record,
          draft,
          state.session.record,
          authority.profile.catalogs,
        );
        if (!candidate.ok) return rejected("recipe-rejected");
        const result = project.replaceProject(draft.expectedProjectDigest, candidate.record);
        if (result.ok) controller.dispose();
        return result;
      }),
    dispose: () => {
      if (state.disposed) return;
      unsubscribe?.();
      unsubscribe = null;
      state = Object.freeze({ ...state, disposed: true });
      emit();
      listeners.clear();
    },
  });
  return Object.freeze({ ok: true, controller });
}
