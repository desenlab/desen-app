import { AUTHORING_FIXTURE_CONTEXT_MODEL } from "./authoring-fixtures.js";
import styles from "./application.module.css";

import type { ChangeEvent } from "react";
import type {
  AuthoringOperationFixtureControllerSnapshot,
  AuthoringOperationFixtureOutcomeId,
  AuthoringOperationFixtureSnapshot,
} from "./authoring-fixtures.js";
import type {
  AuthoringScenarioModelResult,
  AuthoringScenarioValue,
} from "./authoring-scenarios.js";
import type { PreviewFidelityProjection } from "./preview-fidelity.js";
import type {
  AuthoringIntegrationControllerSnapshot,
  AuthoringIntegrationDescriptor,
} from "./authoring-integration.js";

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

function fixtureStatusText(operation: AuthoringOperationFixtureSnapshot): string {
  if (operation.status === "pending") {
    return "Pending · complete this fixture to settle the Runtime call.";
  }
  if (operation.status === "succeeded") return "Synthetic success completed.";
  if (operation.status === "failed") return "Synthetic public error completed.";
  if (operation.status === "unavailable") {
    return "This operation declares no synthetic outcome in its Catalog manifest.";
  }
  if (operation.status === "disposed") return "This fixture session is no longer active.";
  return "Trigger this operation in the preview to start a real pending Runtime lifecycle.";
}

/** Generic Run-only controls for Source-used, Catalog-authenticated operation fixtures. */
export function RunControls({
  executionContext = "synthetic",
  integration = null,
  integrationSnapshot = null,
  onContextChange,
  onRestart,
  onComplete,
  onSelectOutcome,
  snapshot,
  surfaceName,
}: Readonly<{
  readonly executionContext?: "synthetic" | "integration";
  readonly integration?: AuthoringIntegrationDescriptor | null;
  readonly integrationSnapshot?: AuthoringIntegrationControllerSnapshot | null;
  readonly onContextChange?: (context: "synthetic" | "integration") => void;
  readonly onRestart?: () => void;
  readonly surfaceName?: string;
  readonly onComplete: (alias: string) => void;
  readonly onSelectOutcome: (alias: string, outcomeId: AuthoringOperationFixtureOutcomeId) => void;
  readonly snapshot: AuthoringOperationFixtureControllerSnapshot;
}>) {
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
          {AUTHORING_FIXTURE_CONTEXT_MODEL.options.map((option) => {
            const available =
              option.id === "synthetic" ||
              (option.id === "integration" &&
                integration !== null &&
                onContextChange !== undefined);
            const active = available && option.id === executionContext;
            return (
              <label
                data-availability={available ? (active ? "active" : "available") : "unavailable"}
                key={option.id}
              >
                <input
                  checked={active}
                  disabled={!available}
                  name="fixture-context"
                  onChange={() => {
                    if (available && !active) onContextChange?.(option.id);
                  }}
                  type="radio"
                  value={option.id}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>
                    {!available ? "Unavailable · " : active ? "Active · " : "Available · "}
                    {option.id === "integration" && integration !== null
                      ? integration.description
                      : option.description}
                  </small>
                </span>
              </label>
            );
          })}
        </fieldset>
        {integration !== null ? (
          <p>
            Changing context restarts the preview. Use test data only; production is not connected.
          </p>
        ) : null}
        {surfaceName !== undefined && onRestart !== undefined ? (
          <section aria-label="Run navigation" className={styles.runNavigation}>
            <span>
              Preview surface · <strong>{surfaceName}</strong>
            </span>
            <button className={styles.fixtureCompleteButton} onClick={onRestart} type="button">
              Restart run
            </button>
            <small>Restarts from the design surface. Your authored Source is unchanged.</small>
          </section>
        ) : null}

        {executionContext === "integration" ? (
          <section aria-label="Connected host operations" className={styles.integrationOperations}>
            <h3>{integration?.label ?? "Connection unavailable"}</h3>
            {integrationSnapshot === null ? (
              <p role="alert">
                The exact Source could not be bound to this connection. No host call can run.
              </p>
            ) : integrationSnapshot.operations.length === 0 ? (
              <p>No operations on this surface. Add an Invoke operation action in Design mode.</p>
            ) : (
              integrationSnapshot.operations.map((operation) => (
                <fieldset
                  aria-label={`Host operation ${operation.alias}`}
                  className={styles.fixtureOperationGroup}
                  key={operation.alias}
                >
                  <legend>Operation · {operation.alias}</legend>
                  <small>
                    {operation.capabilityId} · {operation.effect}
                  </small>
                  <p aria-live="polite" role="status">
                    {!operation.bound
                      ? "Not connected · this capability has no approved host binding."
                      : operation.status === "pending"
                        ? "Waiting for the connected host…"
                        : operation.status === "responded"
                          ? "Host response received. Runtime validates the result before continuing."
                          : operation.status === "denied"
                            ? "The host call was stopped or denied."
                            : "Connected · trigger this operation in the preview."}
                  </p>
                </fieldset>
              ))
            )}
          </section>
        ) : snapshot.modelStatus === "rejected" ? (
          <p role="alert">
            Operation fixtures unavailable · the selected Source and Catalog could not be
            authenticated ({snapshot.rejectionReason}).
          </p>
        ) : snapshot.operations.length === 0 ? (
          <p role="status">
            No simulated operations · add an Invoke operation action in Design mode to expose its
            Catalog-declared outcomes here.
          </p>
        ) : (
          snapshot.operations.map((operation) => {
            const pending = operation.status === "pending";
            const canSelect = !snapshot.disposed && !pending && operation.outcomes.length > 0;
            return (
              <fieldset
                aria-label={`Operation ${operation.alias}`}
                className={styles.fixtureOperationGroup}
                key={operation.alias}
              >
                <legend>Operation · {operation.alias}</legend>
                <p className={styles.fixtureOperationIdentity}>
                  <strong>{operation.alias}</strong>
                  <br />
                  <small>
                    {operation.capabilityId} · {operation.effect}
                    {operation.description === undefined ? "" : ` · ${operation.description}`}
                  </small>
                </p>
                {operation.outcomes.length > 0 ? (
                  <label className={styles.fixtureOutcomeControl}>
                    <span>Next outcome for {operation.alias}</span>
                    <select
                      disabled={!canSelect}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                        onSelectOutcome(
                          operation.alias,
                          event.currentTarget.value as AuthoringOperationFixtureOutcomeId,
                        )
                      }
                      value={operation.selectedOutcomeId ?? ""}
                    >
                      {operation.outcomes.map((outcome) => (
                        <option key={outcome.id} value={outcome.id}>
                          {outcome.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <button
                  className={styles.fixtureCompleteButton}
                  disabled={!pending}
                  onClick={() => onComplete(operation.alias)}
                  type="button"
                >
                  Complete {operation.alias} fixture
                </button>
                <p
                  aria-atomic="true"
                  aria-live="polite"
                  className={styles.fixtureOperationStatus}
                  role="status"
                >
                  {fixtureStatusText(operation)}
                </p>
              </fieldset>
            );
          })
        )}
      </div>

      <p className={styles.runControlsBoundary}>
        {executionContext === "integration"
          ? "Explicit host connection · no fixture substitution. Production calls and Source writes remain off."
          : AUTHORING_FIXTURE_CONTEXT_MODEL.disclosure}
      </p>
    </aside>
  );
}
