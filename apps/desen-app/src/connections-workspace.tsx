import { useMemo, useState, useSyncExternalStore } from "react";

import {
  applyConnectionIntentDraft,
  discardConnectionIntentDraft,
  listConnectionIntentDrafts,
  listConnectionTargets,
  readConnectionIntentDraft,
  saveConnectionIntentDraft,
} from "./connection-intent-drafts.js";
import type {
  ConnectionIntentCandidateKind,
  ConnectionIntentDraft,
} from "./connection-intent-drafts.js";
import type { ProjectAuthoringController } from "./project-authoring-controller.js";
import type { EditableProjectRecord } from "@desen/design-system-core";

import styles from "./application.module.css";

const readUnavailable = () => null;
const subscribeUnavailable = () => () => undefined;

interface ConnectionsWorkspaceProps {
  readonly controller: ProjectAuthoringController | null;
  readonly hidden?: boolean;
  readonly record: EditableProjectRecord | null;
  readonly surfaceId: string;
  readonly surfaceName: string;
}

interface ConnectionFormState {
  readonly id: string;
  readonly nodeId: string;
  readonly label: string;
  readonly note: string;
  readonly candidateKind: ConnectionIntentCandidateKind;
  readonly candidateName: string;
}

function formFromDraft(draft: ConnectionIntentDraft): ConnectionFormState {
  return Object.freeze({
    id: draft.id,
    nodeId: draft.nodeId,
    label: draft.label,
    note: draft.note,
    candidateKind: draft.candidate.kind,
    candidateName: draft.candidate.name,
  });
}

function initialForm(record: EditableProjectRecord | null, surfaceId: string): ConnectionFormState {
  const target = record === null ? undefined : listConnectionTargets(record.source, surfaceId)[0];
  const nodeId = target?.id ?? "";
  return Object.freeze({
    id: nodeId === "" ? `intent.${surfaceId}` : `intent.${surfaceId}.${nodeId}`,
    nodeId,
    label: "New connection intent",
    note: "",
    candidateKind: "event",
    candidateName: "",
  });
}

function reasonMessage(reason: string): string {
  switch (reason) {
    case "stale-target":
      return "The selected Source node is stale. Reopen the current target before saving.";
    case "draft-invalid":
    case "candidate-invalid":
      return "The inert intent form is incomplete or contains unsupported executable data.";
    case "record-invalid":
      return "The project rejected the intent atomically; valid Source and existing drafts are unchanged.";
    case "intent-not-found":
      return "That intent is no longer present in this project.";
    case "project-stale":
      return "The project changed elsewhere. Reopen Connections before applying this form.";
    default:
      return "The intent could not be changed. No project data was overwritten.";
  }
}

/**
 * Project-scoped Connections workspace. Forms are durable project metadata and never become
 * executable Source until a later, explicitly-owned task introduces behavior wiring.
 */
export function ConnectionsWorkspace({
  controller,
  hidden = false,
  record,
  surfaceId,
  surfaceName,
}: Readonly<ConnectionsWorkspaceProps>) {
  const state = useSyncExternalStore(
    controller?.subscribe ?? subscribeUnavailable,
    controller?.read ?? readUnavailable,
    controller?.read ?? readUnavailable,
  );
  const currentRecord = state?.session.record ?? record;
  const targets = useMemo(
    () =>
      currentRecord === null
        ? Object.freeze([])
        : listConnectionTargets(currentRecord.source, surfaceId),
    [currentRecord, surfaceId],
  );
  const intents = useMemo(
    () =>
      currentRecord === null
        ? Object.freeze([])
        : listConnectionIntentDrafts(currentRecord, surfaceId),
    [currentRecord, surfaceId],
  );
  const [form, setForm] = useState(() => initialForm(currentRecord, surfaceId));
  const [notice, setNotice] = useState("");

  function updateForm(update: Partial<ConnectionFormState>): void {
    setForm((current) => Object.freeze({ ...current, ...update }));
  }

  function candidateValue(): unknown {
    return Object.freeze({
      id: form.id,
      surfaceId,
      nodeId: form.nodeId,
      label: form.label,
      note: form.note,
      candidate: Object.freeze({ kind: form.candidateKind, name: form.candidateName }),
    });
  }

  function replaceProject(next: EditableProjectRecord): void {
    if (controller === null || state === null) {
      setNotice("This workspace is read-only until an aggregate project controller is installed.");
      return;
    }
    const result = controller.replaceProject(state.session.digest, next);
    setNotice(
      result.ok
        ? "Saved in the project as inert Connections metadata. Source remains unchanged."
        : reasonMessage(result.reason),
    );
  }

  function save(phase: "pending" | "applied"): void {
    if (currentRecord === null) {
      setNotice("No admitted project is available for Connections.");
      return;
    }
    const outcome =
      phase === "pending"
        ? saveConnectionIntentDraft(currentRecord, candidateValue())
        : applyConnectionIntentDraft(currentRecord, candidateValue());
    if (!outcome.ok) {
      setNotice(reasonMessage(outcome.reason));
      return;
    }
    replaceProject(outcome.record);
  }

  function reopen(id: string): void {
    if (currentRecord === null) return;
    const reopened = readConnectionIntentDraft(currentRecord, id);
    if (reopened === undefined) {
      setNotice("This intent is foreign or no longer available; it was not interpreted.");
      return;
    }
    setForm(formFromDraft(reopened));
    setNotice(
      `Reopened ${reopened.id}. It is still ${intents.find((item) => item.id === id)?.phase ?? "pending"}.`,
    );
  }

  function discard(): void {
    if (currentRecord === null) return;
    const outcome = discardConnectionIntentDraft(currentRecord, form.id);
    if (!outcome.ok) {
      setNotice(reasonMessage(outcome.reason));
      return;
    }
    replaceProject(outcome.record);
    setNotice("Intent discarded. The valid Source and unrelated intents are unchanged.");
  }

  return (
    <section
      aria-labelledby="connections-workspace-title"
      className={styles.connectionsWorkspace}
      data-connections-workspace="true"
      hidden={hidden}
    >
      <header className={styles.connectionsWorkspaceHeader}>
        <div>
          <p className={styles.eyebrow}>Separate authoring workspace</p>
          <h2 id="connections-workspace-title">Connections</h2>
          <p>
            Prepare node-linked intent for {surfaceName}. Incomplete forms persist beside the valid
            Source and never execute host or behavior code.
          </p>
        </div>
        <span className={styles.previewBadge}>{intents.length} saved intents</span>
      </header>

      {controller === null || currentRecord === null ? (
        <p className={styles.previewNotice} role="status">
          Connections is unavailable in this embedding because no aggregate project authority was
          provided.
        </p>
      ) : (
        <div className={styles.connectionsWorkspaceGrid}>
          <form
            aria-label="Connection intent form"
            className={styles.connectionsIntentForm}
            onSubmit={(event) => {
              event.preventDefault();
              save("pending");
            }}
          >
            <label>
              Draft id
              <input
                aria-label="Connection draft id"
                onChange={(event) => updateForm({ id: event.currentTarget.value })}
                value={form.id}
              />
            </label>
            <label>
              Source node
              <select
                aria-label="Connection Source node"
                onChange={(event) => updateForm({ nodeId: event.currentTarget.value })}
                value={form.nodeId}
              >
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.displayName} · {target.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Label
              <input
                aria-label="Connection label"
                onChange={(event) => updateForm({ label: event.currentTarget.value })}
                value={form.label}
              />
            </label>
            <label>
              Candidate kind
              <select
                aria-label="Connection candidate kind"
                onChange={(event) =>
                  updateForm({
                    candidateKind: event.currentTarget.value as ConnectionIntentCandidateKind,
                  })
                }
                value={form.candidateKind}
              >
                <option value="event">Event</option>
                <option value="state">State</option>
                <option value="action">Action</option>
                <option value="navigation">Navigation</option>
              </select>
            </label>
            <label>
              Candidate name
              <input
                aria-label="Connection candidate name"
                onChange={(event) => updateForm({ candidateName: event.currentTarget.value })}
                value={form.candidateName}
              />
            </label>
            <label>
              Note
              <textarea
                aria-label="Connection note"
                onChange={(event) => updateForm({ note: event.currentTarget.value })}
                value={form.note}
              />
            </label>
            <div className={styles.connectionsIntentActions}>
              <button className={styles.primaryButton} type="submit">
                Save incomplete draft
              </button>
              <button
                className={styles.secondaryButton}
                onClick={() => save("applied")}
                type="button"
              >
                Apply inert intent
              </button>
              <button className={styles.secondaryButton} onClick={discard} type="button">
                Discard
              </button>
            </div>
          </form>

          <aside aria-label="Saved connection intents" className={styles.connectionsIntentList}>
            <h3>Saved intents</h3>
            {intents.length === 0 ? (
              <p className={styles.diagnosticsEmpty}>No Connections drafts saved yet.</p>
            ) : (
              <ul>
                {intents.map((intent) => (
                  <li key={intent.id}>
                    <button onClick={() => reopen(intent.id)} type="button">
                      <strong>{intent.label || intent.id}</strong>
                      <small>
                        {intent.phase} · {intent.candidate.kind} · {intent.nodeId}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
      <p aria-live="polite" className={styles.connectionsWorkspaceNotice} role="status">
        {notice}
      </p>
    </section>
  );
}
