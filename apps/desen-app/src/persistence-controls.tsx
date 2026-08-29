import { useEffect, useId, useRef, useState } from "react";

import styles from "./application.module.css";

/** Persistence operation whose latest settled result is projected by the App. */
export type PersistenceControlOperation = "open" | "save";

/** Closed, user-observable lifecycle projected into the Source persistence controls. */
export type PersistenceControlStatus =
  | Readonly<{ readonly state: "ready" }>
  | Readonly<{ readonly state: "unavailable" }>
  | Readonly<{ readonly state: "missing" }>
  | Readonly<{ readonly state: "opening" }>
  | Readonly<{ readonly state: "saving" }>
  | Readonly<{
      readonly operation: PersistenceControlOperation;
      readonly state: "success";
    }>
  | Readonly<{ readonly state: "conflict" }>
  | Readonly<{ readonly state: "indeterminate" }>
  | Readonly<{
      readonly operation: PersistenceControlOperation;
      readonly state: "failed";
    }>
  | Readonly<{ readonly state: "exhausted" }>;

/** Complete presentation state for one App-owned editable Source persistence identity. */
export interface PersistenceControlProjection {
  /** Last admitted positive storage generation, or `null` before a Source has been opened or saved. */
  readonly generation: number | null;
  /** Whether the authored Source differs from the last definitely opened or saved document. */
  readonly dirty: boolean;
  /** Whether another save is forbidden until storage is opened again. */
  readonly reopenRequired: boolean;
  /** Current controlled persistence lifecycle. */
  readonly status: PersistenceControlStatus;
}

/** Projection and admission callbacks consumed by the pure Source persistence control surface. */
export interface PersistenceControlsProps {
  /** Whether any App-owned operation currently blocks another persistence request. */
  readonly busy: boolean;
  /** Opaque identity of the exact persistence authority that a dirty-open confirmation may use. */
  readonly confirmationScope: object | null;
  /** Admits persistence only while the editor is in Design mode. */
  readonly designMode: boolean;
  /** Requests opening the fixed App-owned Source identity. */
  readonly onOpen: () => void;
  /** Requests generation-guarded saving of the authored Source. */
  readonly onSave: () => void;
  /** User-observable persistence state projected by the owning application. */
  readonly projection: PersistenceControlProjection;
}

function statusText(projection: PersistenceControlProjection): string {
  const { generation, status } = projection;
  const generationText =
    generation === null ? "No stored generation is open." : `Generation ${generation}.`;

  if (status.state === "unavailable") {
    return "Persistence unavailable. This environment cannot open or save Sources.";
  }
  if (status.state === "missing") {
    return "No stored Source exists yet. Save source will create generation 1.";
  }
  if (status.state === "opening") return "Opening Source…";
  if (status.state === "saving") return "Saving Source…";
  if (status.state === "success") {
    if (status.operation === "open") return `Source opened successfully. ${generationText}`;
    return projection.dirty
      ? `Source snapshot saved successfully. Newer changes remain unsaved. ${generationText}`
      : `Source saved successfully. ${generationText}`;
  }
  if (status.state === "conflict") {
    return "Save conflict. A newer stored generation exists; reopen before saving again.";
  }
  if (status.state === "indeterminate") {
    return "Save outcome is uncertain. Reopen to confirm the stored Source before saving again.";
  }
  if (status.state === "failed") {
    return status.operation === "open"
      ? "Open failed. The current session draft was preserved."
      : "Save failed. The current session draft was preserved.";
  }
  if (status.state === "exhausted") {
    return "Generation limit reached. This storage identity cannot accept another changed Source.";
  }
  if (projection.reopenRequired) return "Reopen required before another save.";
  if (projection.dirty) return `Unsaved changes. ${generationText}`;
  return generation === null
    ? "No stored Source is open."
    : `Saved Source is current. ${generationText}`;
}

function dirtyStateText(projection: PersistenceControlProjection): string {
  if (projection.status.state === "unavailable" && !projection.dirty) {
    return "Local draft unchanged";
  }
  return projection.dirty ? "Unsaved changes" : "Saved";
}

function requiresReopen(projection: PersistenceControlProjection): boolean {
  return (
    projection.reopenRequired ||
    projection.status.state === "conflict" ||
    projection.status.state === "indeterminate"
  );
}

/** Compact, accessible Open/Save controls with no storage or editor authority of their own. */
export function PersistenceControls({
  busy,
  confirmationScope,
  designMode,
  onOpen,
  onSave,
  projection,
}: Readonly<PersistenceControlsProps>) {
  const statusId = useId();
  const admissionId = useId();
  const confirmationId = useId();
  const openButton = useRef<HTMLButtonElement>(null);
  const [confirmation, setConfirmation] = useState<Readonly<{
    readonly scope: object | null;
    readonly statusKey: string;
  }> | null>(null);
  const lifecycleBusy =
    projection.status.state === "opening" || projection.status.state === "saving";
  const unavailable = projection.status.state === "unavailable";
  const exhausted = projection.status.state === "exhausted";
  const reopen = requiresReopen(projection);
  const interactionBlocked = busy || lifecycleBusy || unavailable || !designMode;
  const openDisabled = interactionBlocked;
  const saveDisabled = interactionBlocked || !projection.dirty || reopen || exhausted;
  const status = statusText(projection);
  const statusKey =
    projection.status.state === "success" || projection.status.state === "failed"
      ? `${projection.status.state}:${projection.status.operation}`
      : projection.status.state;
  const confirmationVisible =
    confirmation?.statusKey === statusKey &&
    confirmation.scope === confirmationScope &&
    projection.dirty &&
    designMode &&
    !busy &&
    !lifecycleBusy &&
    !unavailable;

  useEffect(() => {
    setConfirmation(null);
  }, [busy, confirmationScope, designMode, projection.dirty, statusKey]);

  function requestOpen(): void {
    if (openDisabled) return;
    if (projection.dirty) {
      setConfirmation(Object.freeze({ scope: confirmationScope, statusKey }));
      return;
    }
    setConfirmation(null);
    onOpen();
  }

  function cancelOpen(): void {
    setConfirmation(null);
    openButton.current?.focus();
  }

  function confirmOpen(): void {
    if (!confirmationVisible) return;
    setConfirmation(null);
    openButton.current?.focus();
    onOpen();
  }

  return (
    <section
      aria-busy={busy || lifecycleBusy}
      aria-label="Source persistence"
      className={styles.persistenceControls}
      data-persistence-state={projection.status.state}
    >
      <div
        aria-label="Source persistence actions"
        className={styles.persistenceActions}
        role="group"
      >
        <button
          aria-controls={confirmationId}
          aria-describedby={`${statusId} ${admissionId}`}
          aria-expanded={confirmationVisible}
          disabled={openDisabled}
          onClick={requestOpen}
          ref={openButton}
          type="button"
        >
          Open source
        </button>
        <button
          aria-describedby={`${statusId} ${admissionId}`}
          disabled={saveDisabled}
          onClick={onSave}
          type="button"
        >
          Save source
        </button>
      </div>

      <div className={styles.persistenceMeta} aria-label="Source persistence state">
        <span>
          {projection.generation === null ? "Generation —" : `Generation ${projection.generation}`}
        </span>
        <span data-dirty={projection.dirty}>{dirtyStateText(projection)}</span>
        {reopen ? <span data-reopen-required="true">Reopen required</span> : null}
      </div>

      <p
        aria-atomic="true"
        aria-live="polite"
        className={styles.persistenceStatus}
        id={statusId}
        role="status"
      >
        {status}
      </p>
      <p className={styles.persistenceAdmission} id={admissionId}>
        {designMode
          ? unavailable
            ? "Storage is not configured for this environment."
            : "Open and save affect only the authored Source."
          : "Open and save are available in Design mode."}
      </p>

      <div
        className={styles.persistenceOpenConfirmation}
        hidden={!confirmationVisible}
        id={confirmationId}
        role="alert"
      >
        <span>
          <strong>Discard unsaved changes?</strong>
          <small>
            Opening the stored Source will replace the current authored Source in this session.
          </small>
        </span>
        <div aria-label="Confirm open source" role="group">
          <button onClick={cancelOpen} type="button">
            Cancel open
          </button>
          <button onClick={confirmOpen} type="button">
            Discard changes and open
          </button>
        </div>
      </div>
    </section>
  );
}
