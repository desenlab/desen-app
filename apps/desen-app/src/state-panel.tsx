import { useEffect, useId, useMemo, useRef, useState } from "react";

import styles from "./application.module.css";

import type { FormEvent } from "react";
import type { JsonValue } from "@desen/catalog-sdk";
import type {
  AuthoringStateDeclarationModel,
  AuthoringStateEdit,
  AuthoringStateEditResult,
  AuthoringStateModelResult,
  AuthoringStateValueType,
} from "./authoring-state.js";

interface StatePanelProps {
  readonly model: AuthoringStateModelResult;
  readonly onEdit: (edit: AuthoringStateEdit) => AuthoringStateEditResult;
  readonly surfaceName: string;
}

interface StateCardProps {
  readonly declaration: AuthoringStateDeclarationModel;
  readonly onEdit: StatePanelProps["onEdit"];
  readonly onNotice: (message: string) => void;
}

const STATE_TYPES = Object.freeze([
  "string",
  "boolean",
  "number",
  "integer",
] as const satisfies readonly AuthoringStateValueType[]);

const STATE_TYPE_LABELS: Readonly<Record<AuthoringStateValueType, string>> = Object.freeze({
  boolean: "Boolean",
  integer: "Integer",
  number: "Number",
  string: "String",
});

const ADDRESSABLE_STATE_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/u;

function compareStateNames(
  left: AuthoringStateDeclarationModel,
  right: AuthoringStateDeclarationModel,
): number {
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
}

function editFailureMessage(result: AuthoringStateEditResult): string {
  if (result.ok) return "";
  if (result.reason === "catalog-invalid") return "The Catalog is no longer available.";
  if (result.reason === "projection-limit") return "Local state is too large to edit safely.";
  if (result.reason === "preview-unavailable") {
    return "The exact adapter preview could not accept this state change.";
  }
  if (result.reason === "source-invalid") return "The Source could not accept this state change.";
  if (result.reason === "state-exists") return "A local state with this name already exists.";
  if (result.reason === "state-in-use") {
    return "This local state is still in use. Remove its bindings or actions first.";
  }
  if (result.reason === "state-not-found") return "This local state is no longer current.";
  return "This state change could not be applied safely.";
}

function defaultInitial(type: AuthoringStateValueType): string {
  return type === "boolean" ? "false" : type === "string" ? "" : "0";
}

function initialDraft(type: AuthoringStateValueType, initial: JsonValue): string {
  if (type === "string" && typeof initial === "string") return initial;
  if (type === "boolean" && typeof initial === "boolean") return initial ? "true" : "false";
  if ((type === "number" || type === "integer") && typeof initial === "number") {
    return String(initial);
  }
  return defaultInitial(type);
}

function parseInitial(
  type: AuthoringStateValueType,
  draft: string,
): Readonly<{ readonly ok: true; readonly value: JsonValue }> | Readonly<{ readonly ok: false }> {
  if (type === "string") return Object.freeze({ ok: true, value: draft });
  if (type === "boolean") return Object.freeze({ ok: true, value: draft === "true" });
  if (draft.trim().length === 0) return Object.freeze({ ok: false });
  const number = Number(draft);
  if (!Number.isFinite(number) || (type === "integer" && !Number.isInteger(number))) {
    return Object.freeze({ ok: false });
  }
  return Object.freeze({ ok: true, value: number });
}

function DeleteStateControl({ declaration, onEdit, onNotice }: Readonly<StateCardProps>) {
  const helpId = useId();
  const inUse = declaration.usageCount > 0;
  const usageLabel = `${declaration.usageCount} ${declaration.usageCount === 1 ? "use" : "uses"}`;

  return (
    <div className={styles.stateDeleteControl}>
      <button
        aria-describedby={helpId}
        aria-label={`Delete ${declaration.name} local state`}
        className={styles.stateDeleteButton}
        disabled={inUse}
        onClick={() => {
          const result = onEdit({ kind: "delete", name: declaration.name });
          onNotice(
            result.ok ? `Deleted ${declaration.name} local state.` : editFailureMessage(result),
          );
        }}
        type="button"
      >
        Delete
      </button>
      <small className={styles.stateDeleteHelp} id={helpId}>
        {inUse
          ? `Used states cannot be deleted. Remove ${usageLabel} first.`
          : "Unused state. It can be deleted from this session."}
      </small>
    </div>
  );
}

function PrimitiveStateEditor({ declaration, onEdit, onNotice }: Readonly<StateCardProps>) {
  const errorId = useId();
  const type = declaration.type ?? "string";

  const [draftType, setDraftType] = useState<AuthoringStateValueType>(type);
  const [draftInitial, setDraftInitial] = useState(() => initialDraft(type, declaration.initial));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraftType(type);
    setDraftInitial(initialDraft(type, declaration.initial));
    setDirty(false);
    setError("");
  }, [declaration.initial, declaration.name, type]);

  function apply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!dirty) return;
    const parsed = parseInitial(draftType, draftInitial);
    if (!parsed.ok) {
      const message =
        draftType === "integer"
          ? "Enter a whole finite number for the initial value."
          : "Enter a finite number for the initial value.";
      setError(message);
      onNotice(message);
      return;
    }

    const result = onEdit({
      kind: "update",
      name: declaration.name,
      type: draftType,
      initial: parsed.value,
    });
    if (!result.ok) {
      const message = editFailureMessage(result);
      setError(message);
      onNotice(message);
      return;
    }
    setDirty(false);
    setError("");
    onNotice(`Updated ${declaration.name} local state.`);
  }

  return (
    <form className={styles.stateEditor} noValidate onSubmit={apply}>
      <label className={styles.stateField}>
        <span>Type</span>
        <select
          aria-label={`${declaration.name} type`}
          onChange={(event) => {
            const nextType = event.currentTarget.value as AuthoringStateValueType;
            setDraftType(nextType);
            setDraftInitial(defaultInitial(nextType));
            setDirty(true);
            setError("");
            onNotice("");
          }}
          value={draftType}
        >
          {STATE_TYPES.map((stateType) => (
            <option key={stateType} value={stateType}>
              {STATE_TYPE_LABELS[stateType]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.stateField}>
        <span>Initial value</span>
        {draftType === "boolean" ? (
          <select
            aria-label={`${declaration.name} initial value`}
            onChange={(event) => {
              setDraftInitial(event.currentTarget.value);
              setDirty(true);
              setError("");
              onNotice("");
            }}
            value={draftInitial}
          >
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
        ) : (
          <input
            aria-describedby={error.length > 0 ? errorId : undefined}
            aria-invalid={error.length > 0}
            aria-label={`${declaration.name} initial value`}
            inputMode={draftType === "string" ? undefined : "decimal"}
            onChange={(event) => {
              setDraftInitial(event.currentTarget.value);
              setDirty(true);
              setError("");
              onNotice("");
            }}
            step={draftType === "integer" ? 1 : draftType === "number" ? "any" : undefined}
            type={draftType === "string" ? "text" : "number"}
            value={draftInitial}
          />
        )}
      </label>

      <button
        aria-label={`Apply ${declaration.name} local state`}
        className={styles.stateApplyButton}
        disabled={!dirty}
        type="submit"
      >
        Apply
      </button>
      {error.length > 0 ? (
        <p className={styles.stateFieldError} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function StateCard({ declaration, onEdit, onNotice }: Readonly<StateCardProps>) {
  return (
    <li className={styles.stateCard}>
      <div className={styles.stateCardHeader}>
        <div>
          <h3>{declaration.name}</h3>
          <small>
            {declaration.type === null ? "Custom schema" : STATE_TYPE_LABELS[declaration.type]}
          </small>
        </div>
        <span aria-label={`${declaration.name} usage count`} className={styles.stateUsageBadge}>
          Used by {declaration.usageCount}
        </span>
      </div>

      {declaration.type === null ? (
        <div aria-label={`${declaration.name} custom state`} className={styles.stateReadonly}>
          <strong>Read-only custom schema</strong>
          <p>This schema and its initial value are preserved unchanged by primitive controls.</p>
        </div>
      ) : (
        <PrimitiveStateEditor declaration={declaration} onEdit={onEdit} onNotice={onNotice} />
      )}

      <DeleteStateControl declaration={declaration} onEdit={onEdit} onNotice={onNotice} />
    </li>
  );
}

function NewStateForm({
  onEdit,
  onNotice,
}: Readonly<{
  readonly onEdit: StatePanelProps["onEdit"];
  readonly onNotice: (message: string) => void;
}>) {
  const helpId = useId();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<AuthoringStateValueType>("string");

  function add(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!ADDRESSABLE_STATE_NAME.test(normalizedName)) {
      onNotice(
        "Use a state name that starts with a letter and contains only letters, numbers, _ or -.",
      );
      return;
    }
    const result = onEdit({ kind: "insert", name: normalizedName, type });
    if (!result.ok) {
      onNotice(editFailureMessage(result));
      return;
    }
    setName("");
    nameRef.current?.focus();
    onNotice(`Added ${normalizedName} local state.`);
  }

  return (
    <form className={styles.stateNewForm} onSubmit={add}>
      <div className={styles.stateNewHeading}>
        <strong>Add local state</strong>
        <small id={helpId}>Start with a letter; then use letters, numbers, _ or -.</small>
      </div>
      <label className={styles.stateField}>
        <span>Name</span>
        <input
          aria-describedby={helpId}
          aria-label="New state name"
          autoComplete="off"
          maxLength={128}
          onChange={(event) => {
            setName(event.currentTarget.value);
            onNotice("");
          }}
          ref={nameRef}
          spellCheck={false}
          type="text"
          value={name}
        />
      </label>
      <label className={styles.stateField}>
        <span>Type</span>
        <select
          aria-label="New state type"
          onChange={(event) => {
            setType(event.currentTarget.value as AuthoringStateValueType);
            onNotice("");
          }}
          value={type}
        >
          {STATE_TYPES.map((stateType) => (
            <option key={stateType} value={stateType}>
              {STATE_TYPE_LABELS[stateType]}
            </option>
          ))}
        </select>
      </label>
      <button className={styles.stateAddButton} type="submit">
        Add
      </button>
    </form>
  );
}

/** App-owned surface-local state editor rendered outside the managed capability subtree. */
export function StatePanel({ model, onEdit, surfaceName }: Readonly<StatePanelProps>) {
  const titleId = useId();
  const [notice, setNotice] = useState("");
  const declarations = useMemo(
    () =>
      model.status === "ready"
        ? Object.freeze([...model.declarations].sort(compareStateNames))
        : Object.freeze([]),
    [model],
  );

  useEffect(() => {
    setNotice("");
  }, [model.status, model.status === "ready" ? model.route.surfaceId : null]);

  return (
    <section aria-labelledby={titleId} className={styles.statePanel}>
      <div className={styles.statePanelHeader}>
        <div>
          <h2 id={titleId}>Local state</h2>
          <small>Surface local</small>
        </div>
        <span className={styles.stateCountBadge}>
          {model.status === "ready" ? declarations.length : 0}
        </span>
      </div>
      <p className={styles.statePanelScope}>
        Values belong only to {surfaceName}. Changes stay in this authoring session; save and
        publication are not available here.
      </p>

      {model.status === "rejected" ? (
        <div className={styles.statePanelRejected} role="alert">
          <strong>Local state unavailable</strong>
          <p>
            {model.reason === "route-invalid"
              ? "The current surface is no longer a valid Source route."
              : "This surface has too much state to project safely."}
          </p>
        </div>
      ) : (
        <div className={styles.statePanelBody}>
          {declarations.length === 0 ? (
            <div className={styles.stateEmpty}>
              <strong>No local state yet</strong>
              <p>Add state to hold values for this surface.</p>
            </div>
          ) : (
            <ul aria-label={`${surfaceName} local state`} className={styles.stateList}>
              {declarations.map((declaration) => (
                <StateCard
                  declaration={declaration}
                  key={declaration.name}
                  onEdit={onEdit}
                  onNotice={setNotice}
                />
              ))}
            </ul>
          )}
          <NewStateForm onEdit={onEdit} onNotice={setNotice} />
        </div>
      )}

      <p aria-atomic="true" aria-live="polite" className={styles.stateNotice} role="status">
        {notice || "State edits remain local until Save source succeeds."}
      </p>
    </section>
  );
}
