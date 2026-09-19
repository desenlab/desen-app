import { useEffect, useId, useState } from "react";

import styles from "./application.module.css";

import type { FormEvent } from "react";
import type { JsonPrimitive } from "@desen/catalog-sdk";
import type {
  AuthoringVariantEdit,
  AuthoringVariantEditResult,
  AuthoringVariantModelResult,
} from "./authoring-variants.js";

/** Inputs required to render the closed named-variant authoring panel. */
export interface VariantsPanelProps {
  readonly model: AuthoringVariantModelResult;
  readonly onEdit?: ((edit: AuthoringVariantEdit) => AuthoringVariantEditResult) | undefined;
}

function failureMessage(result: AuthoringVariantEditResult): string {
  if (result.ok) return "";
  if (result.reason === "name-invalid") return "Use a unique name beginning with a letter.";
  if (result.reason === "state-invalid")
    return "Choose a declared primitive state axis and a matching value.";
  if (result.reason === "variant-unavailable") return "That variant is no longer current.";
  if (result.reason === "source-invalid")
    return "The Source rejected this variant; no change was saved.";
  return "This variant change could not be applied safely.";
}

function parseValue(raw: string, sample: JsonPrimitive): JsonPrimitive | undefined {
  if (typeof sample === "string") return raw;
  if (typeof sample === "boolean")
    return raw === "true" ? true : raw === "false" ? false : undefined;
  if (typeof sample === "number") {
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }
  return undefined;
}

/** Renders named component presets without exposing arbitrary predicates or child mutations. */
export function VariantsPanel({ model, onEdit }: Readonly<VariantsPanelProps>) {
  const formId = useId();
  const [name, setName] = useState("");
  const [axisName, setAxisName] = useState("");
  const [axisValue, setAxisValue] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (model.status === "ready") {
      const first = model.localStateOptions[0];
      setAxisName((current) =>
        model.localStateOptions.some(({ name: candidate }) => candidate === current)
          ? current
          : (first?.name ?? ""),
      );
      setAxisValue((current) =>
        current.length > 0 ? current : first === undefined ? "" : String(first.value),
      );
    }
    setNotice("");
  }, [model]);

  if (model.status !== "ready") {
    return (
      <div className={styles.inspectorTabUnavailable}>
        <strong>{model.status === "idle" ? "Select a component" : "Variants unavailable"}</strong>
        <p>Named variants are available only for the current Catalog-backed Source selection.</p>
      </div>
    );
  }

  const selectedAxis = model.localStateOptions.find(({ name }) => name === axisName);
  const editingEnabled = onEdit !== undefined && selectedAxis !== undefined;

  function dispatch(edit: AuthoringVariantEdit): boolean {
    if (onEdit === undefined) {
      setNotice("Variant editing is unavailable for this workspace.");
      return false;
    }
    const result = onEdit(edit);
    if (!result.ok) {
      setNotice(failureMessage(result));
      return false;
    }
    setNotice(
      edit.kind === "delete"
        ? "Variant deleted."
        : edit.kind === "rename"
          ? "Variant renamed."
          : "Variant created.",
    );
    return true;
  }

  function create(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (selectedAxis === undefined) return;
    const value = parseValue(axisValue, selectedAxis.value);
    if (value === undefined) {
      setNotice("Enter a value matching the selected state axis.");
      return;
    }
    if (dispatch({ kind: "create", name, axisName, axisValue: value })) {
      setName("");
    }
  }

  return (
    <div className={styles.stylePanel} data-authoring-variants="true">
      <div className={styles.stylePanelIntro}>
        <span>
          <strong>{model.component.displayName}</strong>
          <small>Named component presets</small>
        </span>
        <span className={styles.styleLayerSummary}>{model.variants.length} variants</span>
      </div>
      <p className={styles.styleControlHelp}>
        Variants are persisted as conditional Source overlays. Children never change through a
        variant; visual states remain available from the Style tab.
      </p>
      <form className={styles.styleControl} id={formId} noValidate onSubmit={create}>
        <label className={styles.stateField} htmlFor={`${formId}-name`}>
          <span>Variant name</span>
          <input
            id={`${formId}-name`}
            maxLength={64}
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />
        </label>
        <label className={styles.stateField} htmlFor={`${formId}-axis`}>
          <span>State axis</span>
          <select
            id={`${formId}-axis`}
            disabled={model.localStateOptions.length === 0}
            onChange={(event) => {
              const next = model.localStateOptions.find(
                ({ name: candidate }) => candidate === event.currentTarget.value,
              );
              setAxisName(event.currentTarget.value);
              setAxisValue(next === undefined ? "" : String(next.value));
            }}
            value={axisName}
          >
            {model.localStateOptions.length === 0 ? (
              <option value="">No primitive state axes</option>
            ) : (
              model.localStateOptions.map(({ name: candidate }) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))
            )}
          </select>
        </label>
        <label className={styles.stateField} htmlFor={`${formId}-value`}>
          <span>Axis value</span>
          <input
            id={`${formId}-value`}
            onChange={(event) => setAxisValue(event.currentTarget.value)}
            value={axisValue}
          />
        </label>
        <button disabled={!editingEnabled || name.trim().length === 0} type="submit">
          Create variant
        </button>
      </form>
      {model.variants.length === 0 ? (
        <p className={styles.styleControlHelp}>No named variants yet.</p>
      ) : (
        <div className={styles.styleControls}>
          {model.variants.map((variant) => (
            <section className={styles.styleControl} key={`${variant.index}:${variant.name}`}>
              <div className={styles.styleControlHeading}>
                <span>
                  <strong>{variant.name}</strong>
                  <small>
                    {variant.axis.reference} = {String(variant.axis.value)}
                  </small>
                </span>
                <span className={styles.styleValueBadge}>Preset</span>
              </div>
              <button
                disabled={onEdit === undefined}
                onClick={() => dispatch({ kind: "delete", index: variant.index })}
                type="button"
              >
                Delete variant
              </button>
            </section>
          ))}
        </div>
      )}
      {model.unmanagedVariantCount > 0 ? (
        <p className={styles.styleUnmanagedNotice}>
          {model.unmanagedVariantCount} protocol variant(s) are preserved as unmanaged.
        </p>
      ) : null}
      {model.visualStates.length === 0 ? (
        <p className={styles.styleControlHelp}>
          This component declares no additional visual states.
        </p>
      ) : (
        <p className={styles.styleControlHelp}>
          Declared visual states: {model.visualStates.join(", ")}.
        </p>
      )}
      <p aria-live="polite" className={styles.styleNotice} role="status">
        {notice || "Variant edits remain local until Save source succeeds."}
      </p>
    </div>
  );
}
