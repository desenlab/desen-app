import styles from "./application.module.css";

import type {
  AuthoringDiagnosticOccurrence,
  AuthoringDiagnosticsViewModel,
} from "./authoring-diagnostics.js";

/** Current immutable diagnostics presentation and App-owned selection callbacks. */
export interface DiagnosticsPanelProps {
  readonly model: AuthoringDiagnosticsViewModel;
  readonly selectedSelectionKey: string | null;
  readonly onSelect: (selectionKey: string) => void;
  readonly onDismiss: () => void;
}

function targetLabel(occurrence: AuthoringDiagnosticOccurrence): string {
  const kind = occurrence.kind === "node" ? "Node" : "Behavior";
  return `Select ${kind} ${occurrence.subjectId} at ${occurrence.occurrencePointer}`;
}

function targetStatus(occurrence: AuthoringDiagnosticOccurrence): string {
  return occurrence.previewStatus === "materialized" ? "On canvas" : "Invalid placeholder";
}

/** App-owned, callback-light presentation for one current immutable diagnostics projection. */
export function DiagnosticsPanel({
  model,
  onDismiss,
  onSelect,
  selectedSelectionKey,
}: Readonly<DiagnosticsPanelProps>) {
  const issueCount = model.diagnostics.length;

  return (
    <section aria-label="Validation diagnostics" className={styles.diagnosticsPanel}>
      <div className={styles.diagnosticsHeader}>
        <span className={styles.diagnosticsHeading}>
          <strong>Validation</strong>
          <span aria-atomic="true" aria-live="polite" role="status">
            {issueCount} {issueCount === 1 ? "issue" : "issues"}
          </span>
        </span>
        <button
          aria-label="Dismiss validation diagnostics"
          className={styles.diagnosticsDismiss}
          onClick={onDismiss}
          type="button"
        >
          Dismiss
        </button>
      </div>

      {issueCount === 0 ? (
        <p className={styles.diagnosticsEmpty}>No validation issues in this snapshot.</p>
      ) : (
        <ol aria-label="Validation issues" className={styles.diagnosticsList}>
          {model.diagnostics.map((diagnostic, position) => {
            const linked = diagnostic.linkStatus === "linked" && diagnostic.occurrences.length > 0;
            return (
              <li
                className={styles.diagnosticsItem}
                data-diagnostic-index={diagnostic.index}
                key={`${model.documentFingerprint}:${diagnostic.index}`}
              >
                <div className={styles.diagnosticsItemHeader}>
                  <span aria-hidden="true" className={styles.diagnosticsOrdinal}>
                    {String(position + 1).padStart(2, "0")}
                  </span>
                  <code>{diagnostic.code}</code>
                  {!linked ? (
                    <span
                      className={styles.diagnosticsTargetState}
                      data-link-status={diagnostic.linkStatus}
                    >
                      {diagnostic.linkStatus === "unmapped"
                        ? "No Source target"
                        : "Outside this surface"}
                    </span>
                  ) : null}
                </div>
                <p className={styles.diagnosticsMessage}>{diagnostic.message}</p>
                {diagnostic.pointer === null ? null : (
                  <code className={styles.diagnosticsPointer}>{diagnostic.pointer}</code>
                )}

                {linked ? (
                  <div
                    aria-label={`Source targets for issue ${position + 1}`}
                    className={styles.diagnosticsTargets}
                    role="group"
                  >
                    {diagnostic.occurrences.map((occurrence) => (
                      <button
                        aria-current={
                          occurrence.selectionKey === selectedSelectionKey ? "true" : undefined
                        }
                        aria-label={targetLabel(occurrence)}
                        className={styles.diagnosticsTarget}
                        key={occurrence.selectionKey}
                        onClick={() => {
                          onSelect(occurrence.selectionKey);
                        }}
                        type="button"
                      >
                        <span aria-hidden="true" className={styles.diagnosticsTargetGlyph}>
                          {occurrence.kind === "node" ? "N" : "B"}
                        </span>
                        <span className={styles.diagnosticsTargetIdentity}>
                          <strong>{occurrence.subjectId}</strong>
                          <small>{occurrence.occurrencePointer}</small>
                        </span>
                        <span className={styles.diagnosticsPreviewState}>
                          {targetStatus(occurrence)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {model.obligations.length === 0 ? null : (
        <div className={styles.diagnosticsObligations}>
          <span>
            <strong>Runtime checks</strong>
            <small>{model.obligations.length} deferred</small>
          </span>
          <ul aria-label="Deferred runtime checks">
            {model.obligations.map((obligation) => (
              <li key={`${obligation.index}:${obligation.kind}:${obligation.pointer}`}>
                <code>{obligation.kind}</code>
                <small>{obligation.pointer}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
