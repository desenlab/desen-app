import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import styles from "./application.module.css";
import { formatStructuredJson, parseStructuredJsonText } from "./structured-json.js";
import { isAuthoringInspectorStateCompatible } from "./authoring-inspector.js";

import type { FormEvent, KeyboardEvent, ReactNode, RefCallback } from "react";
import type { ComponentInspectorFallbackReason, JsonPrimitive } from "@desen/catalog-sdk";
import type {
  AuthoringInspectorEdit,
  AuthoringInspectorEditResult,
  AuthoringInspectorBindingEdit,
  AuthoringInspectorField,
  AuthoringInspectorModelResult,
  AuthoringInspectorStateOption,
} from "./authoring-inspector.js";
import type { StructuredJsonParseFailureReason } from "./structured-json.js";

interface InspectorPanelProps {
  readonly diagnosticsControls?: ReactNode;
  /** App-owned event and action controls retained in the right-sidebar Actions view. */
  readonly eventActionControls?: ReactNode;
  readonly hidden?: boolean | undefined;
  readonly inspector: AuthoringInspectorModelResult;
  readonly onEdit: (edit: AuthoringInspectorEdit) => AuthoringInspectorEditResult;
  readonly onBindingEdit?:
    ((edit: AuthoringInspectorBindingEdit) => AuthoringInspectorEditResult) | undefined;
  readonly previewControls?: ReactNode;
  /** App-owned local-state controls retained in the right-sidebar State view. */
  readonly stateControls?: ReactNode;
}

type InspectorTab = "inspector" | "state" | "actions";

function primitiveText(value: JsonPrimitive): string {
  if (value === null) return "Null";
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value);
}

function failureMessage(result: AuthoringInspectorEditResult): string {
  if (result.ok) return "";
  if (result.reason === "source-invalid") return "This value does not satisfy the Catalog schema.";
  if (result.reason === "binding-incompatible") {
    return "That local state cannot safely supply this property type.";
  }
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
        <small>{field.control.valuePointer || "/"}</small>
      </span>
      <span className={styles.propertyRequirement}>
        {field.control.required ? "Required" : "Optional"}
      </span>
    </span>
  );
}

function directStateName(field: AuthoringInspectorField): string | undefined {
  if (field.value.kind !== "dynamic") return undefined;
  const value = field.value.value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "$ref") return undefined;
  const reference = (value as Readonly<Record<string, unknown>>).$ref;
  return typeof reference === "string" && reference.startsWith("state.")
    ? reference.slice("state.".length)
    : undefined;
}

function ValueSourceControl({
  field,
  localStates,
  onBindingEdit,
  onNotice,
}: Readonly<{
  readonly field: AuthoringInspectorField;
  readonly localStates: readonly AuthoringInspectorStateOption[];
  readonly onBindingEdit: (edit: AuthoringInspectorBindingEdit) => AuthoringInspectorEditResult;
  readonly onNotice: (message: string) => void;
}>) {
  const compatibleStates = localStates.filter((state) =>
    isAuthoringInspectorStateCompatible(field, state),
  );
  const currentState = directStateName(field);
  if (
    compatibleStates.length === 0 ||
    (field.value.kind === "dynamic" && !compatibleStates.some(({ name }) => name === currentState))
  ) {
    return null;
  }

  return (
    <label className={styles.valueSourceControl}>
      <span>Value source · {field.label}</span>
      <select
        aria-label={`${field.qualifiedLabel} value source`}
        onChange={(event) => {
          const stateName = event.currentTarget.value;
          const result =
            stateName === "__local__"
              ? onBindingEdit({ kind: "use-initial", valuePointer: field.control.valuePointer })
              : onBindingEdit({
                  kind: "bind",
                  stateName,
                  valuePointer: field.control.valuePointer,
                });
          onNotice(
            result.ok
              ? stateName === "__local__"
                ? `Restored ${field.qualifiedLabel} to the bound state's initial value.`
                : `Bound ${field.qualifiedLabel} to state.${stateName}.`
              : failureMessage(result),
          );
        }}
        value={currentState ?? "__local__"}
      >
        <option value="__local__">
          {currentState === undefined ? "Local value" : "Local value · use state initial"}
        </option>
        {compatibleStates.map((state) => (
          <option key={state.name} value={state.name}>
            State · {state.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function DynamicField({
  field,
  focusTargetRef,
  localStates,
  onBindingEdit,
  onNotice,
}: Readonly<{
  readonly field: AuthoringInspectorField;
  readonly focusTargetRef: RefCallback<HTMLElement>;
  readonly localStates: readonly AuthoringInspectorStateOption[];
  readonly onBindingEdit: (edit: AuthoringInspectorBindingEdit) => AuthoringInspectorEditResult;
  readonly onNotice: (message: string) => void;
}>) {
  if (field.value.kind !== "dynamic") return null;
  return (
    <div className={styles.inspectorField} data-control-kind={field.control.kind}>
      <FieldHeader field={field} />
      <div
        aria-label={`${field.qualifiedLabel} bound value`}
        className={styles.boundValue}
        ref={focusTargetRef}
        tabIndex={0}
      >
        <span className={styles.boundBadge}>Bound</span>
        <code>{field.value.reference ?? "Dynamic value"}</code>
      </div>
      <ValueSourceControl
        field={field}
        localStates={localStates}
        onBindingEdit={onBindingEdit}
        onNotice={onNotice}
      />
      <p className={styles.fieldHelp}>
        {directStateName(field) === undefined
          ? "This runtime or advanced binding is preserved as read-only."
          : "Choose another compatible state or restore this state's initial value."}
      </p>
    </div>
  );
}

interface FieldEditProps {
  readonly field: AuthoringInspectorField;
  readonly onEdit: InspectorPanelProps["onEdit"];
  readonly onNotice: (message: string) => void;
}

interface InspectorFieldProps extends FieldEditProps {
  readonly localStates: readonly AuthoringInspectorStateOption[];
  readonly onBindingEdit: (edit: AuthoringInspectorBindingEdit) => AuthoringInspectorEditResult;
}

interface ControlledFieldEditProps extends InspectorFieldProps {
  readonly focusTargetRef: RefCallback<HTMLElement>;
}

function ClearPropertyButton({ field, onEdit, onNotice }: Readonly<FieldEditProps>) {
  if (
    field.control.required ||
    field.containsDynamicValue ||
    field.value.kind === "absent" ||
    field.value.kind === "dynamic" ||
    field.control.valuePointer === ""
  ) {
    return null;
  }

  return (
    <button
      aria-label={`Unset ${field.qualifiedLabel}`}
      className={styles.unsetProperty}
      onClick={() => {
        const result = onEdit({ kind: "delete", valuePointer: field.control.valuePointer });
        onNotice(result.ok ? `Unset ${field.qualifiedLabel}.` : failureMessage(result));
      }}
      type="button"
    >
      Unset
    </button>
  );
}

function EnumField({
  field,
  focusTargetRef,
  onEdit,
  onNotice,
}: Readonly<ControlledFieldEditProps>) {
  const helpId = useId();
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
          aria-describedby={field.description === undefined ? undefined : helpId}
          aria-label={field.qualifiedLabel}
          aria-required={control.required}
          onChange={(event) => {
            const token = event.currentTarget.value;
            const result =
              token === "unset"
                ? onEdit({ kind: "delete", valuePointer: control.valuePointer })
                : onEdit({
                    kind: "set",
                    value: control.options[Number(token.slice("option:".length))] as JsonPrimitive,
                    valuePointer: control.valuePointer,
                  });
            onNotice(
              result.ok
                ? `${token === "unset" ? "Unset" : "Updated"} ${field.qualifiedLabel}.`
                : failureMessage(result),
            );
          }}
          ref={focusTargetRef}
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
        <p className={styles.fieldHelp} id={helpId}>
          {field.description}
        </p>
      )}
    </div>
  );
}

function BooleanField({
  field,
  focusTargetRef,
  onEdit,
  onNotice,
}: Readonly<ControlledFieldEditProps>) {
  const helpId = useId();
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
              aria-describedby={field.description === undefined ? undefined : helpId}
              aria-label={field.qualifiedLabel}
              aria-required={field.control.required}
              checked={checked}
              onChange={(event) => {
                const result = onEdit({
                  kind: "set",
                  value: event.currentTarget.checked,
                  valuePointer: field.control.valuePointer,
                });
                onNotice(result.ok ? `Updated ${field.qualifiedLabel}.` : failureMessage(result));
              }}
              ref={focusTargetRef}
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
          aria-describedby={field.description === undefined ? undefined : helpId}
          aria-label={`Set ${field.qualifiedLabel}`}
          className={styles.setProperty}
          onClick={() => {
            const result = onEdit({
              kind: "set",
              value: false,
              valuePointer: field.control.valuePointer,
            });
            onNotice(result.ok ? `Set ${field.qualifiedLabel} to Off.` : failureMessage(result));
          }}
          ref={focusTargetRef}
          type="button"
        >
          Set property
        </button>
      )}
      {field.description === undefined ? null : (
        <p className={styles.fieldHelp} id={helpId}>
          {field.description}
        </p>
      )}
    </div>
  );
}

function TextOrNumberField({
  field,
  focusTargetRef,
  onEdit,
  onNotice,
}: Readonly<ControlledFieldEditProps>) {
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
  const helpId = useId();

  useEffect(() => {
    setDraft(current);
    setDirty(false);
    setError("");
  }, [current, field.control.kind, field.value.kind, property]);

  if (!supported || property === null) return null;

  function commit(event?: FormEvent<HTMLFormElement>): void {
    event?.preventDefault();
    if (!dirty) return;
    let value: JsonPrimitive = draft;
    if (numeric) {
      if (draft.trim() === "") {
        const message = "Enter a finite number.";
        setError(message);
        onNotice("");
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
        onNotice("");
        return;
      }
    }

    const result = onEdit({ kind: "set", value, valuePointer: field.control.valuePointer });
    if (!result.ok) {
      const message = failureMessage(result);
      setError(message);
      onNotice("");
      return;
    }
    setDraft(String(value));
    setDirty(false);
    setError("");
    onNotice(`Updated ${field.qualifiedLabel}.`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setDraft(current);
    setDirty(false);
    setError("");
    onNotice("");
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
          aria-describedby={
            [field.description === undefined ? null : helpId, error.length > 0 ? errorId : null]
              .filter((id): id is string => id !== null)
              .join(" ") || undefined
          }
          aria-invalid={error.length > 0}
          aria-label={field.qualifiedLabel}
          aria-required={field.control.required}
          inputMode={numeric ? "decimal" : undefined}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (nextTarget instanceof Node && event.currentTarget.form?.contains(nextTarget)) {
              return;
            }
            if (
              nextTarget instanceof Element &&
              nextTarget.closest("[data-preserve-inspector-draft='true']") !== null
            ) {
              return;
            }
            commit();
          }}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setDirty(true);
            setError("");
            onNotice("");
          }}
          onKeyDown={handleKeyDown}
          placeholder={field.value.kind === "absent" ? "Not set" : undefined}
          ref={focusTargetRef}
          step={field.control.kind === "integer" ? 1 : numeric ? "any" : undefined}
          type={numeric ? "number" : "text"}
          value={draft}
        />
        <button
          aria-label={`Apply ${field.qualifiedLabel}`}
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
      ) : null}
      {field.description === undefined ? null : (
        <p className={styles.fieldHelp} id={helpId}>
          {field.description}
        </p>
      )}
    </form>
  );
}

function structuredJsonFailureMessage(reason: StructuredJsonParseFailureReason): string {
  if (reason === "duplicate-member") return "Object member names must be unique.";
  if (reason === "dynamic-value") {
    return "Binding keys that start with $ stay locked until binding editing is available.";
  }
  if (reason === "invalid-unicode") return "Use valid Unicode scalar values.";
  if (reason === "limit-exceeded") return "This JSON exceeds the Publisher safety limits.";
  return "Enter valid JSON.";
}

const FALLBACK_REASON_LABELS: Readonly<Record<ComponentInspectorFallbackReason, string>> =
  Object.freeze({
    array: "Array schema",
    "open-object": "Open object schema",
    "multi-type": "Multiple JSON types",
    reference: "Referenced schema",
    combinator: "Combined schema",
    conditional: "Conditional schema",
    pattern: "Pattern properties",
    "unsupported-schema": "Unsupported schema shape",
    "derivation-limit": "Inspector derivation limit",
  });

function StructuredJsonField({
  field,
  focusTargetRef,
  onEdit,
  onNotice,
}: Readonly<ControlledFieldEditProps>) {
  if (field.control.kind !== "structured-json" && field.control.kind !== "group") return null;
  const control = field.control;
  const current = useMemo(
    () =>
      field.value.kind === "structured"
        ? formatStructuredJson(field.value.value)
        : control.kind === "group"
          ? "{}"
          : "",
    [control.kind, field.value],
  );
  const [draft, setDraft] = useState(current);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const helpId = useId();
  const descriptionId = useId();
  const errorId = useId();

  useEffect(() => {
    setDraft(current);
    setDirty(false);
    setError("");
  }, [control.kind, control.valuePointer, current, field.value.kind]);

  function apply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!dirty && field.value.kind !== "absent") return;
    const parsed = parseStructuredJsonText(draft);
    if (!parsed.ok) {
      const message = structuredJsonFailureMessage(parsed.reason);
      setError(message);
      onNotice("");
      return;
    }
    if (
      control.kind === "group" &&
      (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value))
    ) {
      const message = "Enter one complete JSON object for this group.";
      setError(message);
      onNotice("");
      return;
    }

    const result = onEdit({
      kind: "set",
      value: parsed.value,
      valuePointer: control.valuePointer,
    });
    if (!result.ok) {
      const message = failureMessage(result);
      setError(message);
      onNotice("");
      return;
    }
    setDraft(formatStructuredJson(parsed.value));
    setDirty(false);
    setError("");
    onNotice(`Updated ${field.qualifiedLabel}.`);
  }

  const fallbackLabel =
    control.kind === "structured-json"
      ? FALLBACK_REASON_LABELS[control.fallbackReason]
      : "Complete object required";

  return (
    <form className={styles.inspectorField} data-control-kind={control.kind} onSubmit={apply}>
      <FieldHeader field={field} />
      <div className={styles.structuredMeta} id={helpId}>
        <span>Structured JSON</span>
        <span>{fallbackLabel}</span>
      </div>
      <textarea
        aria-describedby={[
          helpId,
          field.description === undefined ? null : descriptionId,
          error.length > 0 ? errorId : null,
        ]
          .filter((id): id is string => id !== null)
          .join(" ")}
        aria-invalid={error.length > 0}
        aria-label={`${field.qualifiedLabel} JSON`}
        aria-required={control.required}
        className={styles.structuredTextarea}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
          setDirty(true);
          setError("");
          onNotice("");
        }}
        ref={focusTargetRef}
        spellCheck={false}
        value={draft}
      />
      <div className={styles.structuredActions}>
        <button
          aria-label={`Apply ${field.qualifiedLabel} JSON`}
          className={styles.applyProperty}
          disabled={!dirty && field.value.kind !== "absent"}
          type="submit"
        >
          Apply JSON
        </button>
        <button
          aria-label={`Reset ${field.qualifiedLabel} JSON`}
          className={styles.unsetProperty}
          disabled={!dirty}
          onClick={() => {
            setDraft(current);
            setDirty(false);
            setError("");
            onNotice("");
          }}
          type="button"
        >
          Reset
        </button>
        <ClearPropertyButton field={field} onEdit={onEdit} onNotice={onNotice} />
      </div>
      {error.length > 0 ? (
        <p className={styles.fieldError} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      {field.description === undefined ? null : (
        <p className={styles.fieldHelp} id={descriptionId}>
          {field.description}
        </p>
      )}
    </form>
  );
}

function GroupField(props: Readonly<ControlledFieldEditProps>) {
  const { field, focusTargetRef, localStates, onBindingEdit, onEdit, onNotice } = props;
  const helpId = useId();
  if (field.control.kind !== "group") return null;
  if (field.value.kind === "absent") return <StructuredJsonField {...props} />;
  if (field.value.kind !== "structured") return null;

  return (
    <fieldset
      aria-describedby={field.description === undefined ? undefined : helpId}
      className={styles.inspectorGroup}
      data-control-kind="group"
      ref={focusTargetRef}
      tabIndex={-1}
    >
      <legend className={styles.visuallyHidden}>{field.qualifiedLabel} group</legend>
      <div className={styles.inspectorGroupHeader}>
        <FieldHeader field={field} />
        <ClearPropertyButton field={field} onEdit={onEdit} onNotice={onNotice} />
      </div>
      {field.description === undefined ? null : (
        <p className={styles.fieldHelp} id={helpId}>
          {field.description}
        </p>
      )}
      <div className={styles.inspectorGroupChildren}>
        {field.children.map((child) => (
          <InspectorField
            field={child}
            key={child.control.valuePointer}
            localStates={localStates}
            onBindingEdit={onBindingEdit}
            onEdit={onEdit}
            onNotice={onNotice}
          />
        ))}
      </div>
    </fieldset>
  );
}

function InspectorField(props: Readonly<InspectorFieldProps>) {
  const { field, localStates, onBindingEdit, onNotice } = props;
  const focusTarget = useRef<HTMLElement | null>(null);
  const previousValueKind = useRef(field.value.kind);
  const focusTargetRef = useCallback<RefCallback<HTMLElement>>((node) => {
    focusTarget.current = node;
  }, []);

  useLayoutEffect(() => {
    if (previousValueKind.current !== field.value.kind) focusTarget.current?.focus();
    previousValueKind.current = field.value.kind;
  }, [field.value.kind]);

  const controlledProps = { ...props, focusTargetRef };
  if (field.value.kind === "dynamic") {
    return (
      <DynamicField
        field={field}
        focusTargetRef={focusTargetRef}
        localStates={localStates}
        onBindingEdit={onBindingEdit}
        onNotice={onNotice}
      />
    );
  }
  const fieldControl =
    field.control.kind === "group" ? (
      <GroupField {...controlledProps} />
    ) : field.control.kind === "structured-json" ? (
      <StructuredJsonField {...controlledProps} />
    ) : field.control.kind === "enum" ? (
      <EnumField {...controlledProps} />
    ) : field.control.kind === "boolean" ? (
      <BooleanField {...controlledProps} />
    ) : field.control.kind === "string" ||
      field.control.kind === "number" ||
      field.control.kind === "integer" ? (
      <TextOrNumberField {...controlledProps} />
    ) : null;
  if (fieldControl === null) return null;
  return (
    <>
      {fieldControl}
      <ValueSourceControl
        field={field}
        localStates={localStates}
        onBindingEdit={onBindingEdit}
        onNotice={onNotice}
      />
    </>
  );
}

/** App-owned property inspector rendered outside the managed capability subtree. */
export function InspectorPanel({
  diagnosticsControls,
  eventActionControls,
  hidden = false,
  inspector,
  onBindingEdit,
  onEdit,
  previewControls,
  stateControls,
}: Readonly<InspectorPanelProps>) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("inspector");
  const [notice, setNotice] = useState("");
  const panelId = useId();
  const inspectorTab = useRef<HTMLButtonElement>(null);
  const stateTab = useRef<HTMLButtonElement>(null);
  const actionsTab = useRef<HTMLButtonElement>(null);
  const applyBindingEdit =
    onBindingEdit ??
    (() => Object.freeze({ ok: false as const, reason: "control-unavailable" as const }));

  useEffect(() => {
    setNotice("");
  }, [inspector.status, inspector.status === "ready" ? inspector.selection.sourceNodeId : null]);

  function selectTab(nextTab: InspectorTab): void {
    setActiveTab(nextTab);
    (nextTab === "inspector"
      ? inspectorTab
      : nextTab === "state"
        ? stateTab
        : actionsTab
    ).current?.focus();
  }

  function selectAdjacentTab(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs: readonly InspectorTab[] = ["inspector", "state", "actions"];
    const currentIndex = tabs.indexOf(activeTab);
    const nextTab =
      event.key === "Home"
        ? "inspector"
        : event.key === "End"
          ? "actions"
          : (tabs[
              (currentIndex + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length
            ] ?? "inspector");
    selectTab(nextTab);
  }

  return (
    <aside
      aria-label="Inspector"
      className={styles.inspectorPanel}
      data-active-tab={activeTab}
      data-authoring-inspector="true"
      hidden={hidden}
    >
      <div className={styles.inspectorHeader}>
        <span>
          <strong>Inspector</strong>
          <small>Schema driven</small>
        </span>
        <span aria-hidden="true" className={styles.inspectorMark} />
      </div>
      <div aria-label="Inspector views" className={styles.inspectorTabs} role="tablist">
        <button
          aria-controls={`${panelId}-inspector-panel`}
          aria-selected={activeTab === "inspector"}
          id={`${panelId}-inspector-tab`}
          onClick={() => selectTab("inspector")}
          onKeyDown={selectAdjacentTab}
          ref={inspectorTab}
          role="tab"
          tabIndex={activeTab === "inspector" ? 0 : -1}
          type="button"
        >
          Inspector
        </button>
        <button
          aria-controls={`${panelId}-state-panel`}
          aria-selected={activeTab === "state"}
          id={`${panelId}-state-tab`}
          onClick={() => selectTab("state")}
          onKeyDown={selectAdjacentTab}
          ref={stateTab}
          role="tab"
          tabIndex={activeTab === "state" ? 0 : -1}
          type="button"
        >
          State
        </button>
        <button
          aria-controls={`${panelId}-actions-panel`}
          aria-selected={activeTab === "actions"}
          id={`${panelId}-actions-tab`}
          onClick={() => selectTab("actions")}
          onKeyDown={selectAdjacentTab}
          ref={actionsTab}
          role="tab"
          tabIndex={activeTab === "actions" ? 0 : -1}
          type="button"
        >
          Actions
        </button>
      </div>

      <div
        aria-labelledby={`${panelId}-inspector-tab`}
        className={styles.inspectorTabPanel}
        hidden={activeTab !== "inspector"}
        id={`${panelId}-inspector-panel`}
        role="tabpanel"
        tabIndex={activeTab === "inspector" ? 0 : -1}
      >
        {previewControls}
        {diagnosticsControls}

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
                <small>{inspector.controlCount} controls</small>
              </div>
              <div className={styles.inspectorFields}>
                {inspector.fields.map((field) => (
                  <InspectorField
                    field={field}
                    key={`${inspector.selection.sourceNodeId}:${field.control.valuePointer}`}
                    localStates={inspector.localStates}
                    onBindingEdit={applyBindingEdit}
                    onEdit={onEdit}
                    onNotice={setNotice}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <p aria-live="polite" className={styles.inspectorNotice} role="status">
          {notice || "Edits remain local until Save source succeeds."}
        </p>
      </div>
      <div
        aria-labelledby={`${panelId}-state-tab`}
        className={styles.inspectorTabPanel}
        hidden={activeTab !== "state"}
        id={`${panelId}-state-panel`}
        role="tabpanel"
        tabIndex={activeTab === "state" ? 0 : -1}
      >
        {stateControls ?? (
          <div className={styles.inspectorTabUnavailable}>
            <strong>State controls unavailable</strong>
            <p>This surface does not expose local state controls.</p>
          </div>
        )}
      </div>
      <div
        aria-labelledby={`${panelId}-actions-tab`}
        className={styles.inspectorTabPanel}
        hidden={activeTab !== "actions"}
        id={`${panelId}-actions-panel`}
        role="tabpanel"
        tabIndex={activeTab === "actions" ? 0 : -1}
      >
        {eventActionControls ?? (
          <div className={styles.inspectorTabUnavailable}>
            <strong>Action controls unavailable</strong>
            <p>This surface does not expose event and action controls.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
