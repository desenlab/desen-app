import type { ProjectLifecycleController } from "./project-lifecycle.js";

/** Explicit UI confirmation authority for one pending project-workspace navigation. */
export type ProjectLifecycleDiscardConfirmation = (destination: string) => boolean;

/**
 * Creates a fail-closed navigation guard for one project-lifecycle controller.
 *
 * @remarks A pending or indeterminate save cannot be discarded by navigation. A clean registry is
 * admitted immediately. A dirty registry requires an explicit caller-owned confirmation; accepted
 * discard restores the last good workspace before navigation proceeds.
 */
export function createProjectLifecycleNavigationGuard(
  controller: ProjectLifecycleController,
  confirmDiscard: ProjectLifecycleDiscardConfirmation,
): (destination: string) => boolean {
  return (destination: string): boolean => {
    if (typeof destination !== "string" || typeof confirmDiscard !== "function") return false;
    const state = controller.read();
    if (state.disposed || state.pending !== null || state.reopenRequired) return false;
    if (!state.dirty) return true;
    let confirmed: boolean;
    try {
      confirmed = confirmDiscard(destination) === true;
    } catch {
      return false;
    }
    if (!confirmed) return false;
    return controller.discardChanges() === null && !controller.read().dirty;
  };
}
