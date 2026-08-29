import {
  AUTHORING_FIXTURE_CONTEXT_MODEL,
  AUTHORING_SIGN_IN_FIXTURE_OUTCOMES,
} from "./authoring-fixtures.js";
import styles from "./application.module.css";

import type { ChangeEvent } from "react";
import type {
  AuthoringSignInFixtureControllerSnapshot,
  AuthoringSignInFixtureOutcomeId,
} from "./authoring-fixtures.js";
import type {
  AuthoringScenarioModelResult,
  AuthoringScenarioValue,
} from "./authoring-scenarios.js";
import type { PreviewFidelityProjection } from "./preview-fidelity.js";

function fidelityLabel(projection: PreviewFidelityProjection): string {
  if (projection.status !== "ready") return "Fidelity unavailable";
  if (projection.kind === "same") return "Same production adapters";
  if (projection.kind === "equivalent") return "Equivalent preview";
  if (projection.kind === "approximate") return "Approximate preview";
  return "Fidelity not declared";
}

/** Persistent context and adapter-fidelity disclosure shared by Design and Run. */
export function PreviewContextDisclosure({
  fidelity,
}: Readonly<{ readonly fidelity: PreviewFidelityProjection }>) {
  const differences =
    fidelity.status === "ready"
      ? fidelity.entries.flatMap((entry) =>
          entry.differences.map((difference) =>
            Object.freeze({
              capabilityId: entry.capabilityId,
              displayName: entry.displayName,
              difference,
            }),
          ),
        )
      : [];
  const undeclared =
    fidelity.status === "ready"
      ? fidelity.entries.filter((entry) => entry.kind === "undeclared")
      : [];

  return (
    <section
      aria-label="Preview context and fidelity"
      className={styles.previewDisclosure}
      data-fidelity={fidelity.status === "ready" ? fidelity.kind : "unavailable"}
    >
      <div className={styles.previewDisclosureSummary}>
        <span>
          <strong>Synthetic preview</strong>
          <small>Catalog fixtures · no live calls</small>
        </span>
        <span className={styles.fidelityBadge}>{fidelityLabel(fidelity)}</span>
      </div>

      {fidelity.status !== "ready" ? (
        <p role="alert">Adapter fidelity could not be authenticated for this surface.</p>
      ) : fidelity.kind === "approximate" ? (
        <div className={styles.fidelityDetails} role="alert">
          <strong>Known preview differences</strong>
          <ul>
            {differences.map((entry, index) => (
              <li key={`${entry.capabilityId}:${entry.difference}:${index}`}>
                <span>{entry.displayName}</span> · {entry.difference}
              </li>
            ))}
          </ul>
          {undeclared.length > 0 ? (
            <p>
              Fidelity not declared for{" "}
              {undeclared.map(({ displayName }) => displayName).join(", ")}.
            </p>
          ) : null}
        </div>
      ) : fidelity.kind === "undeclared" ? (
        <p role="alert">
          Fidelity not declared for {undeclared.map(({ displayName }) => displayName).join(", ")}.
        </p>
      ) : differences.length > 0 ? (
        <div className={styles.fidelityDetails}>
          <strong>Declared preview differences</strong>
          <ul>
            {differences.map((entry, index) => (
              <li key={`${entry.capabilityId}:${entry.difference}:${index}`}>
                <span>{entry.displayName}</span> · {entry.difference}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** Inspector-owned selector for ephemeral, authoring-only Catalog scenarios. */
export function ScenarioPreviewControl({
  model,
  onChange,
  value,
}: Readonly<{
  readonly model: AuthoringScenarioModelResult;
  readonly onChange: (value: AuthoringScenarioValue) => void;
  readonly value: AuthoringScenarioValue;
}>) {
  const ready = model.status === "ready";
  const selectedValue =
    ready && model.options.some((option) => option.value === value) ? value : "source";

  return (
    <section aria-label="Scenario preview" className={styles.scenarioControl}>
      <div className={styles.panelSectionHeading}>
        <span>Scenario</span>
        <small>Preview only</small>
      </div>
      <label>
        <span>Component values</span>
        <select
          disabled={!ready || model.options.length <= 1}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onChange(event.currentTarget.value as AuthoringScenarioValue)
          }
          value={selectedValue}
        >
          {ready ? (
            model.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          ) : (
            <option value="source">
              {model.status === "idle" ? "Select a component" : "Scenarios unavailable"}
            </option>
          )}
        </select>
      </label>
      <p>
        {ready
          ? (model.options.find((option) => option.value === selectedValue)?.description ??
            "Catalog-declared component values.")
          : model.status === "idle"
            ? "Select a Source component to inspect its scenarios."
            : "This Catalog scenario could not be projected safely."}
      </p>
      <small>Preview only · not saved or published</small>
    </section>
  );
}

function fixtureStatusText(snapshot: AuthoringSignInFixtureControllerSnapshot): string {
  if (snapshot.status === "pending") return "Pending · choose Complete fixture to settle the call.";
  if (snapshot.status === "succeeded") {
    return "Success fixture completed. Production navigation remains blocked.";
  }
  if (snapshot.status === "failed") {
    return "Invalid credentials fixture completed. The managed Alert shows the public failure.";
  }
  if (snapshot.status === "disposed") return "This fixture session is no longer active.";
  return "Fill the form and press Sign in to start a real pending Runtime lifecycle.";
}

/** Compact Run-only controls for the exact synthetic sign-in fixture lifetime. */
export function RunControls({
  onComplete,
  onSelectOutcome,
  snapshot,
}: Readonly<{
  readonly onComplete: () => void;
  readonly onSelectOutcome: (outcomeId: AuthoringSignInFixtureOutcomeId) => void;
  readonly snapshot: AuthoringSignInFixtureControllerSnapshot;
}>) {
  const pending = snapshot.status === "pending";
  const active = snapshot.status !== "disposed";

  return (
    <aside aria-label="Run controls" className={styles.runControls}>
      <div className={styles.inspectorHeader}>
        <span>
          <strong>Run controls</strong>
          <small>Controlled preview</small>
        </span>
        <span aria-hidden="true" className={styles.runControlMark} />
      </div>

      <div className={styles.runControlsBody}>
        <fieldset className={styles.fixtureContextGroup}>
          <legend>Execution context</legend>
          {AUTHORING_FIXTURE_CONTEXT_MODEL.options.map((option) => (
            <label data-availability={option.availability} key={option.id}>
              <input
                checked={option.id === AUTHORING_FIXTURE_CONTEXT_MODEL.activeId}
                disabled={option.availability === "unavailable"}
                name="fixture-context"
                onChange={() => undefined}
                type="radio"
                value={option.id}
              />
              <span>
                <strong>{option.label}</strong>
                <small>
                  {option.availability === "unavailable" ? "Unavailable · " : "Active · "}
                  {option.description}
                </small>
              </span>
            </label>
          ))}
        </fieldset>

        <label className={styles.fixtureOutcomeControl}>
          <span>Next sign-in outcome</span>
          <select
            disabled={!active || pending}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onSelectOutcome(event.currentTarget.value as AuthoringSignInFixtureOutcomeId)
            }
            value={snapshot.selectedOutcomeId}
          >
            {AUTHORING_SIGN_IN_FIXTURE_OUTCOMES.map((outcome) => (
              <option key={outcome.id} value={outcome.id}>
                {outcome.label}
              </option>
            ))}
          </select>
        </label>

        <button disabled={!pending} onClick={onComplete} type="button">
          Complete fixture
        </button>

        <p aria-atomic="true" aria-live="polite" role="status">
          {fixtureStatusText(snapshot)}
        </p>
      </div>

      <p className={styles.runControlsBoundary}>{AUTHORING_FIXTURE_CONTEXT_MODEL.disclosure}</p>
    </aside>
  );
}
