import { useId } from "react";

import styles from "./application.module.css";

import type { AuthoringSourceDraftFailure } from "./authoring-source-draft.js";

/** Detached, explicit advanced input; its owner retains all Source and publication authority. */
export interface SourceDraftControlsProps {
  readonly disabled: boolean;
  readonly text: string | null;
  readonly failure: AuthoringSourceDraftFailure | null;
  readonly notice: string;
  readonly onOpen: () => void;
  readonly onChange: (text: string) => void;
  readonly onApply: () => void;
  readonly onDiscard: () => void;
}

function failureMessage(failure: AuthoringSourceDraftFailure): string {
  if (failure.reason === "invalid-json")
    return "Enter bounded, valid JSON without duplicate members.";
  if (failure.reason === "stale-draft")
    return "The Source changed after this draft opened. Discard it and start from the current Source.";
  if (failure.reason === "workspace-mismatch")
    return "This draft does not belong to the current workspace, surfaces, or Catalogs.";
  return "Source rejected. No Source was saved, no Bundle was emitted to the channel, and no host activation was requested. Correct the draft or discard it to continue.";
}

/** Optional expert workflow beside, never in place of, the normal visual authoring controls. */
export function SourceDraftControls({
  disabled,
  text,
  failure,
  notice,
  onOpen,
  onChange,
  onApply,
  onDiscard,
}: Readonly<SourceDraftControlsProps>) {
  const descriptionId = useId();
  return (
    <section
      aria-label="Advanced Source draft"
      className={styles.sourceDraftControls}
      data-source-draft-state={text === null ? "closed" : failure === null ? "editing" : "rejected"}
    >
      {text === null ? (
        <button disabled={disabled} onClick={onOpen} type="button">
          Advanced Source
        </button>
      ) : (
        <>
          <label className={styles.sourceDraftLabel}>
            <strong>Source JSON draft</strong>
            <textarea
              aria-describedby={descriptionId}
              autoCapitalize="off"
              autoComplete="off"
              disabled={disabled}
              onChange={(event) => onChange(event.currentTarget.value)}
              spellCheck={false}
              value={text}
            />
          </label>
          <p id={descriptionId}>
            Advanced input only. The canvas keeps the current valid Source. Save, Publish, Run and
            visual edits pause until this draft is applied or discarded. Validation does not save or
            publish.
          </p>
          <div className={styles.sourceDraftActions}>
            <button disabled={disabled} onClick={onApply} type="button">
              Validate and apply Source
            </button>
            <button disabled={disabled} onClick={onDiscard} type="button">
              Discard Source draft
            </button>
          </div>
        </>
      )}
      <p aria-live="polite" role="status">
        {failure === null ? notice : failureMessage(failure)}
      </p>
      {failure?.publicationFailure === undefined ? null : (
        <p>
          Publisher stopped at <code>{failure.publicationFailure.stage}</code>.{" "}
          {failure.validationReport?.documentFingerprint === null ||
          failure.validationReport === undefined
            ? failure.publicationFailure.diagnostics.map(({ code }) => code).join(", ")
            : "Inspect Validation in the right sidebar for node-linked issues."}
        </p>
      )}
    </section>
  );
}
