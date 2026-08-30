import { useId } from "react";

import styles from "./application.module.css";

/** Exact publication stage currently owned by the App workflow. */
export type PublicationControlStage = "publisher" | "channel" | "activation";

/** Closed, user-observable lifecycle for one saved Source publication. */
export type PublicationControlStatus =
  | Readonly<{ readonly state: "unavailable" }>
  | Readonly<{ readonly state: "save-required" }>
  | Readonly<{ readonly state: "ready"; readonly sourceGeneration: number }>
  | Readonly<{
      readonly state: "pending";
      readonly stage: PublicationControlStage;
      readonly sourceGeneration: number;
      readonly revision: string | null;
    }>
  | Readonly<{
      readonly state: "active";
      readonly relationship: "activated" | "preserved" | "recovered";
      readonly revision: string;
      readonly sourceGeneration: number;
      readonly channelGeneration: number;
      readonly activationGeneration: number;
    }>
  | Readonly<{
      readonly state: "conflict";
      readonly currentChannelGeneration: number | null;
      readonly sourceGeneration: number;
      readonly revision: string;
    }>
  | Readonly<{
      readonly state: "preserved";
      readonly activeRevision: string | null;
      readonly publishedRevision: string;
      readonly sourceGeneration: number;
      readonly channelGeneration: number;
    }>
  | Readonly<{
      readonly state: "indeterminate";
      readonly stage: PublicationControlStage;
      readonly sourceGeneration: number;
      readonly revision: string | null;
    }>
  | Readonly<{
      readonly state: "failed";
      readonly stage: PublicationControlStage;
      readonly sourceGeneration: number | null;
      readonly revision: string | null;
    }>
  | Readonly<{ readonly state: "stale"; readonly sourceGeneration: number }>;

/** Complete presentation state for the fixed preview-channel publication workflow. */
export interface PublicationControlProjection {
  readonly channelName: "preview";
  readonly status: PublicationControlStatus;
}

/** Pure publication controls; the owning application retains every publication authority. */
export interface PublicationControlsProps {
  readonly busy: boolean;
  readonly designMode: boolean;
  readonly onPublish: () => void;
  readonly projection: PublicationControlProjection;
}

function compactRevision(revision: string): string {
  return `${revision.slice(0, 10)}…${revision.slice(-6)}`;
}

function statusText(status: PublicationControlStatus): string {
  switch (status.state) {
    case "unavailable":
      return "Publishing is not configured in this environment.";
    case "save-required":
      return "Save the current Source before publishing.";
    case "ready":
      return `Saved generation ${status.sourceGeneration} is ready to publish.`;
    case "pending":
      if (status.stage === "publisher") {
        return `Validating saved generation ${status.sourceGeneration} with the Publisher…`;
      }
      if (status.stage === "channel") {
        return `Writing immutable revision ${status.revision === null ? "" : compactRevision(status.revision)} to the preview channel…`;
      }
      return `The reference host is verifying and activating ${status.revision === null ? "the published revision" : compactRevision(status.revision)}…`;
    case "active":
      return `Revision ${compactRevision(status.revision)} is active in the reference host.`;
    case "conflict":
      return status.currentChannelGeneration === null
        ? "The preview channel changed concurrently. Nothing was activated; publish again from the current saved Source."
        : `The preview channel moved to generation ${status.currentChannelGeneration} concurrently. Nothing was activated; publish again.`;
    case "preserved":
      return status.activeRevision === null
        ? "The channel was updated, but the reference host could not activate this revision. No active revision is reported."
        : `The channel was updated, but the reference host preserved ${compactRevision(status.activeRevision)} as last known good.`;
    case "indeterminate":
      return status.stage === "activation"
        ? "The channel was updated, but the host activation outcome is uncertain. Refresh the host before publishing again."
        : "The publication outcome is uncertain. Inspect the preview channel before publishing again.";
    case "failed":
      if (status.stage === "publisher") {
        return "Publisher validation rejected the saved Source. No Bundle or channel update was emitted.";
      }
      if (status.stage === "channel") {
        return "The control plane rejected the publication. The reference host was not asked to activate it.";
      }
      return "The reference host could not verify and activate the published revision.";
    case "stale":
      return `Saved generation ${status.sourceGeneration} may have completed in the background, but the current draft changed and is not marked active.`;
  }
}

function sourceStage(status: PublicationControlStatus): "blocked" | "done" {
  return status.state === "unavailable" || status.state === "save-required" ? "blocked" : "done";
}

function channelStage(status: PublicationControlStatus): "blocked" | "current" | "done" | "failed" {
  if (status.state === "pending") return status.stage === "activation" ? "done" : "current";
  if (status.state === "active" || status.state === "preserved") return "done";
  if (
    status.state === "conflict" ||
    (status.state === "failed" && status.stage === "channel") ||
    (status.state === "indeterminate" && status.stage !== "activation")
  ) {
    return "failed";
  }
  return status.state === "failed" && status.stage === "activation" ? "done" : "blocked";
}

function activationStage(
  status: PublicationControlStatus,
): "blocked" | "current" | "done" | "failed" {
  if (status.state === "pending" && status.stage === "activation") return "current";
  if (status.state === "active") return "done";
  if (
    status.state === "preserved" ||
    (status.state === "failed" && status.stage === "activation") ||
    (status.state === "indeterminate" && status.stage === "activation")
  ) {
    return "failed";
  }
  return "blocked";
}

/** Compact Design-mode Publish action with explicit Source, channel, and host activation stages. */
export function PublicationControls({
  busy,
  designMode,
  onPublish,
  projection,
}: Readonly<PublicationControlsProps>) {
  const statusId = useId();
  const admissionId = useId();
  const status = projection.status;
  const pending = status.state === "pending";
  const disabled =
    busy ||
    pending ||
    !designMode ||
    status.state === "unavailable" ||
    status.state === "save-required" ||
    status.state === "indeterminate";
  const label =
    status.state === "pending"
      ? status.stage === "activation"
        ? "Activating…"
        : "Publishing…"
      : "Publish";

  return (
    <section
      aria-busy={busy || pending}
      aria-label="Publish saved Source"
      className={styles.publicationControls}
      data-publication-state={status.state}
    >
      <div className={styles.publicationHeading}>
        <span>
          <small>Release</small>
          <strong>Preview channel</strong>
        </span>
        <button
          aria-describedby={`${statusId} ${admissionId}`}
          disabled={disabled}
          onClick={onPublish}
          type="button"
        >
          {label}
        </button>
      </div>

      <ol aria-label="Publication stages" className={styles.publicationStages}>
        <li data-stage-state={sourceStage(status)}>
          <span aria-hidden="true" />
          <small>1</small>
          <strong>Saved Source</strong>
        </li>
        <li data-stage-state={channelStage(status)}>
          <span aria-hidden="true" />
          <small>2</small>
          <strong>{projection.channelName} channel</strong>
        </li>
        <li data-stage-state={activationStage(status)}>
          <span aria-hidden="true" />
          <small>3</small>
          <strong>Reference host</strong>
        </li>
      </ol>

      <p
        aria-atomic="true"
        aria-live="polite"
        className={styles.publicationStatus}
        id={statusId}
        role="status"
      >
        {statusText(status)}
      </p>
      <p className={styles.publicationAdmission} id={admissionId}>
        {designMode
          ? "Only the exact saved Source is published. Preview scenarios and fixture data stay local."
          : "Publish is available in Design mode."}
      </p>

      {status.state === "active" ? (
        <dl className={styles.publicationReceipt}>
          <div>
            <dt>Revision</dt>
            <dd title={status.revision}>{compactRevision(status.revision)}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>g{status.sourceGeneration}</dd>
          </div>
          <div>
            <dt>Channel</dt>
            <dd>g{status.channelGeneration}</dd>
          </div>
          <div>
            <dt>Activation</dt>
            <dd>g{status.activationGeneration}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
