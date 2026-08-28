import { useEffect, useId, useState } from "react";

import styles from "./application.module.css";

import type { FormEvent, KeyboardEvent } from "react";
import type { JsonPrimitive } from "@desen/catalog-sdk";
import type {
  AuthoringInspectorEdit,
  AuthoringInspectorEditResult,
  AuthoringInspectorField,
  AuthoringInspectorModelResult,
} from "./authoring-inspector.js";

interface InspectorPanelProps {
  readonly inspector: AuthoringInspectorModelResult;
  readonly onEdit: (edit: AuthoringInspectorEdit) => AuthoringInspectorEditResult;
}

function primitiveText(value: JsonPrimitive): string {
  if (value === null) return "Null";
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value);
}

function failureMessage(result: AuthoringInspectorEditResult): string {
  if (result.ok) return "";
  if (result.reason === "source-invalid") return "This value does not satisfy the Catalog schema.";
  if (result.reason === "value-invalid") return "Enter a value supported by this control.";
  if (result.reason === "required-property") return "Required properties cannot be unset.";
  if (result.reason === "preview-unavailable") {
    return "This value is too large for the exact adapter preview.";
  }
  if (result.reason === "selection-invalid")
    return "The selected Source layer is no longer current.";
  return "This property could not be updated safely.";
}

function FieldHeader({ field }: Readonly<{ readonly field: AuthoringInspectorField }>) {
  return (
    <span className={styles.inspectorFieldHeading}>
      <span>
        <strong>{field.label}</strong>
        <small>{field.control.property}</small>
      </span>
      <span className={styles.propertyRequirement}>
        {field.control.required ? "Required" : "Optional"}
      </span>
    </span>
  );
}

function DynamicField({ field }: Readonly<{ readonly field: AuthoringInspectorField }>) {
  if (field.value.kind !== "dynamic") return null;
  return (
    <div className={styles.inspectorField} data-control-kind={field.control.kind}>
      <FieldHeader field={field} />
      <div aria-label={`${field.label} bound value`} className={styles.boundValue} tabIndex={0}>
        <span className={styles.boundBadge}>Bound</span>
        <code>{field.value.reference ?? "Dynamic value"}</code>
      </div>
      <p className={styles.fieldHelp}>Binding editing becomes available with M09-T08.</p>
    </div>
  );
}

interface FieldEditProps {
  readonly field: AuthoringInspectorField;
  readonly onEdit: InspectorPanelProps["onEdit"];
  readonly onNotice: (message: string) => void;
}

function ClearPropertyButton({ field, onEdit, onNotice }: Readonly<FieldEditProps>) {
  if (field.control.required || field.value.kind !== "literal") return null;

  return (
    <button
      aria-label={`Unset ${field.label}`}
      className={styles.unsetProperty}
      onClick={() => {
        const result = onEdit({ kind: "delete", property: field.control.property ?? "" });
        onNotice(result.ok ? `Unset ${field.label}.` : failureMessage(result));
      }}
      type="button"
    >
      Unset
    </button>
  );
}

function EnumField({ field, onEdit, onNotice }: Readonly<FieldEditProps>) {
  if (field.control.kind !== "enum" || field.control.property === null) return null;
  const control = field.control;
  const literalValue = field.value.kind === "literal" ? field.value.value : undefined;
  const selectedIndex =
    literalValue === undefined
      ? -1
      : control.options.findIndex((option) => option === literalValue);

  return (
    <div className={styles.inspectorField} data-control-kind="enum">
      <FieldHeader field={field} />
      <div className={styles.inspectorControlRow}>
        <select
          aria-label={field.label}
          onChange={(event) => {
            const token = event.currentTarget.value;
            const result =
              token === "unset"
                ? onEdit({ kind: "delete", property: control.property ?? "" })
                : onEdit({
                    kind: "set",
                    property: control.property ?? "",
                    value: control.options[Number(token.slice("option:".length))] as JsonPrimitive,
                  });
            onNotice(
              result.ok
                ? `${token === "unset" ? "Unset" : "Updated"} ${field.label}.`
                : failureMessage(result),
            );
          }}
          value={selectedIndex < 0 ? "unset" : `option:${selectedIndex}`}
        >
          {control.required ? null : <option value="unset">Not set</option>}
          {control.required && selectedIndex < 0 ? (
            <option disabled value="unset">
              Select a value
            </option>
          ) : null}
          {control.options.map((option, index) => (
            <option key={`${index}:${primitiveText(option)}`} value={`option:${index}`}>
              {primitiveText(option)}
            </option>
          ))}
        </select>
      </div>
      {field.description === undefined ? null : (
        <p className={styles.fieldHelp}>{field.description}</p>
      )}
    </div>
  );
}

function BooleanField({ field, onEdit, onNotice }: Readonly<FieldEditProps>) {
  if (field.control.kind !== "boolean" || field.control.property === null) return null;
  const present = field.value.kind === "literal" && typeof field.value.value === "boolean";
  const checked = present && field.value.kind === "literal" ? field.value.value === true : false;

  return (
    <div className={styles.inspectorField} data-control-kind="boolean">
      <FieldHeader field={field} />
      {present || field.control.required ? (
        <div className={styles.inspectorControlRow}>
          <label className={styles.switchControl}>
            <input
              aria-label={field.label}
              checked={checked}
              onChange={(event) => {
                const result = onEdit({
                  kind: "set",
                  property: field.control.property ?? "",
                  value: event.currentTarget.checked,
                });
                onNotice(result.ok ? `Updated ${field.label}.` : failureMessage(result));
              }}
              role="switch"
              type="checkbox"
            />
            <span aria-hidden="true" className={styles.switchTrack} />
            <span>{checked ? "On" : "Off"}</span>
          </label>
          <ClearPropertyButton field={field} onEdit={onEdit} onNotice={onNotice} />
        </div>
      ) : (
        <button
          aria-label={`Set ${field.label}`}
          className={styles.setProperty}
          onClick={() => {
            const result = onEdit({
              kind: "set",
              property: field.control.property ?? "",
              value: false,
            });
            onNotice(result.ok ? `Set ${field.label} to Off.` : failureMessage(result));
          }}
          type="button"
        >
          Set property
        </button>
      )}
    </div>
  );
}

function TextOrNumberField({ field, onEdit, onNotice }: Readonly<FieldEditProps>) {
  const property = field.control.property;
  const numeric = field.control.kind === "number" || field.control.kind === "integer";
  const supported = field.control.kind === "string" || numeric;
  const current =
    field.value.kind === "literal" &&
    (typeof field.value.value === "string" || typeof field.value.value === "number")
      ? String(field.value.value)
      : "";
  const [draft, setDraft] = useState(current);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const errorId = useId();

  useEffect(() => {
    setDraft(current);
    setDirty(false);
    setError("");
  }, [current, field.control.kind, field.value.kind, property]);

  if (!supported || property === null) return null;
  const propertyName = property;

  function commit(event?: FormEvent<HTMLFormElement>): void {
    event?.preventDefault();
    if (!dirty) return;
    let value: JsonPrimitive = draft;
    if (numeric) {
      if (draft.trim() === "") {
        const message = "Enter a finite number.";
        setError(message);
        onNotice(message);
        return;
      }
      value = Number(draft);
      if (
        !Number.isFinite(value) ||
        (field.control.kind === "integer" && !Number.isInteger(value))
      ) {
        const message =
          field.control.kind === "integer" ? "Enter a whole number." : "Enter a finite number.";
        setError(message);
        onNotice(message);
        return;
      }
    }

    const result = onEdit({ kind: "set", property: propertyName, value });
    if (!result.ok) {
      const message = failureMessage(result);
      setError(message);
      onNotice(message);
      return;
    }
    setDirty(false);
    setError("");
    onNotice(`Updated ${field.label}.`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setDraft(current);
    setDirty(false);
    setError("");
  }

  return (
    <form
      className={styles.inspectorField}
      data-control-kind={field.control.kind}
      onSubmit={commit}
    >
      <FieldHeader field={field} />
      <div className={styles.inspectorControlRow}>
        <input
          aria-describedby={error.length > 0 ? errorId : undefined}
          aria-invalid={error.length > 0}
          aria-label={field.label}
          inputMode={numeric ? "decimal" : undefined}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (nextTarget instanceof Node && event.currentTarget.form?.contains(nextTarget)) {
              return;
            }
            commit();
          }}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setDirty(true);
            setError("");
          }}
          onKeyDown={handleKeyDown}
          placeholder={field.value.kind === "absent" ? "Not set" : undefined}
          step={field.control.kind === "integer" ? 1 : numeric ? "any" : undefined}
          type={numeric ? "number" : "text"}
          value={draft}
        />
        <button
          aria-label={`Apply ${field.label}`}
          className={styles.applyProperty}
          disabled={!dirty}
          type="submit"
        >
          Apply
        </button>
        <ClearPropertyButton field={field} onEdit={onEdit} onNotice={onNotice} />
      </div>
      {error.length > 0 ? (
        <p className={styles.fieldError} id={errorId} role="alert">
          {error}
        </p>
      ) : field.description === undefined ? null : (
        <p className={styles.fieldHelp}>{field.description}</p>
      )}
    </form>
  );
}

function DeferredField({ field }: Readonly<{ readonly field: AuthoringInspectorField }>) {
  if (field.control.kind !== "group" && field.control.kind !== "structured-json") return null;
  return (
    <div className={styles.inspectorField} data-control-kind={field.control.kind}>
      <FieldHeader field={field} />
      <div className={styles.deferredControl}>
        <strong>Structured value</strong>
        <span>Nested and structured JSON editing follows in M09-T06.</span>
      </div>
    </div>
  );
}

function InspectorField(props: Readonly<FieldEditProps>) {
  const { field } = props;
  if (field.value.kind === "dynamic") return <DynamicField field={field} />;
  if (field.control.kind === "enum") return <EnumField {...props} />;
  if (field.control.kind === "boolean") return <BooleanField {...props} />;
  if (
    field.control.kind === "string" ||
    field.control.kind === "number" ||
    field.control.kind === "integer"
  ) {
    return <TextOrNumberField {...props} />;
  }
  return <DeferredField field={field} />;
}

/** App-owned property inspector rendered outside the managed capability subtree. */
export function InspectorPanel({ inspector, onEdit }: Readonly<InspectorPanelProps>) {
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setNotice("");
  }, [inspector.status, inspector.status === "ready" ? inspector.selection.sourceNodeId : null]);

  return (
    <aside aria-label="Inspector" className={styles.inspectorPanel} data-authoring-inspector="true">
      <div className={styles.inspectorHeader}>
        <span>
          <strong>Inspector</strong>
          <small>Schema driven</small>
        </span>
        <span aria-hidden="true" className={styles.inspectorMark} />
      </div>

      {inspector.status !== "ready" ? (
        <div className={styles.inspectorEmpty}>
          <span aria-hidden="true" className={styles.inspectorEmptyGlyph} />
          <strong>
            {inspector.status === "idle" ? "Select a layer" : "Selection unavailable"}
          </strong>
          <p>
            {inspector.status === "idle"
              ? "Choose a Source layer to edit its Catalog properties."
              : "The current route no longer admits this Source identity."}
          </p>
        </div>
      ) : (
        <>
          <div className={styles.inspectorIdentity}>
            <span aria-hidden="true" className={styles.componentGlyph}>
              {inspector.selection.displayName.slice(0, 1)}
            </span>
            <span>
              <strong>{inspector.selection.displayName}</strong>
              <small>{inspector.selection.sourceNodeId}</small>
              <code>{inspector.selection.capabilityId}</code>
            </span>
            {inspector.selection.conditional ? (
              <span className={styles.conditionalBadge}>Conditional</span>
            ) : null}
          </div>
          <div className={styles.inspectorBody}>
            <div className={styles.panelSectionHeading}>
              <span>Properties</span>
              <small>{inspector.fields.length} controls</small>
            </div>
            <div className={styles.inspectorFields}>
              {inspector.fields.map((field) => (
                <InspectorField
                  field={field}
                  key={`${inspector.selection.sourceNodeId}:${field.control.valuePointer}`}
                  onEdit={onEdit}
                  onNotice={setNotice}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <p aria-live="polite" className={styles.inspectorNotice} role="status">
        {notice || "Edits stay in this session until save is implemented."}
      </p>
    </aside>
  );
}
