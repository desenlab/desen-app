import { useEffect, useMemo, useState } from "react";

import styles from "./application.module.css";
import { isAuthoringInspectorStateCompatible } from "./authoring-inspector.js";
import { formatStructuredJson, parseInertJsonText } from "./structured-json.js";

import type { FormEvent } from "react";
import type { JsonValue } from "@desen/catalog-sdk";
import type { DesenEditorContentPredicate } from "@desen/editor-core";
import type { AuthoringConditionEditResult } from "./authoring-conditions.js";
import type { AuthoringConnectionResult } from "./authoring-connections.js";
import type {
  AuthoringInspectorModelResult,
  AuthoringInspectorStateOption,
} from "./authoring-inspector.js";

/** One operation result name found in the current surface's authored invoke actions. */
export interface AuthoringOperationAliasOption {
  readonly alias: string;
  readonly operationId: string;
}

interface InputConnectionControlProps {
  readonly connectedStateName: string | null;
  readonly inspector: AuthoringInspectorModelResult;
  readonly onConnect: (stateName: string) => AuthoringConnectionResult;
}

function connectionFailureMessage(result: AuthoringConnectionResult): string {
  if (result.ok) return "";
  if (result.reason === "connection-conflict") {
    return "This input already has a different state update. Review its Actions before reconnecting.";
  }
  if (result.reason === "connection-incompatible") {
    return "Choose a state whose type matches this input value.";
  }
  if (result.reason === "state-unavailable") return "That state is no longer available.";
  if (result.reason === "selection-invalid") return "This layer is no longer selected.";
  return "The complete input connection could not be applied safely.";
}

function directStateReference(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "$ref") return null;
  const reference = (value as Readonly<Record<string, unknown>>).$ref;
  return typeof reference === "string" && reference.startsWith("state.")
    ? reference.slice("state.".length)
    : null;
}

/** No-code boundary for the two halves of a controlled input connection. */
export function InputConnectionControl({
  connectedStateName,
  inspector,
  onConnect,
}: Readonly<InputConnectionControlProps>) {
  const valueField =
    inspector.status === "ready"
      ? inspector.fields.find(({ control }) => control.valuePointer === "/value")
      : undefined;
  const compatibleStates =
    inspector.status === "ready" && valueField !== undefined
      ? inspector.localStates.filter((state) =>
          isAuthoringInspectorStateCompatible(valueField, state),
        )
      : [];
  const boundState =
    valueField?.value.kind === "dynamic" ? directStateReference(valueField.value.value) : null;
  const compatibleStateNames = compatibleStates.map(({ name }) => name).join("\u0000");
  const [stateName, setStateName] = useState(boundState ?? compatibleStates[0]?.name ?? "");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setStateName((currentStateName) => {
      if (boundState !== null) return boundState;
      return compatibleStates.some(({ name }) => name === currentStateName)
        ? currentStateName
        : (compatibleStates[0]?.name ?? "");
    });
  }, [
    boundState,
    compatibleStateNames,
    inspector.status === "ready" ? inspector.selection.sourceNodeId : null,
  ]);

  useEffect(() => {
    setNotice("");
  }, [inspector.status === "ready" ? inspector.selection.sourceNodeId : null]);

  if (valueField === undefined) return null;

  return (
    <section aria-label="Input connection" className={styles.behaviorCard}>
      <div className={styles.behaviorCardHeading}>
        <span>
          <strong>Input connection</strong>
          <small>Controlled value</small>
        </span>
        <span className={styles.behaviorStatus} data-connected={connectedStateName !== null}>
          {connectedStateName === null ? "Not connected" : "Connected"}
        </span>
      </div>
      <p>
        Connects Value to state and writes every change back to that same state as one safe edit.
      </p>
      {compatibleStates.length === 0 ? (
        <div className={styles.behaviorEmpty}>
          Create a compatible local state in the State tab first.
        </div>
      ) : (
        <div className={styles.behaviorControlRow}>
          <label>
            <span>Local state</span>
            <select
              aria-label="Input connection state"
              onChange={(event) => {
                setStateName(event.currentTarget.value);
                setNotice("");
              }}
              value={stateName}
            >
              {compatibleStates.map((state) => (
                <option key={state.name} value={state.name}>
                  {state.name} · {state.type}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={stateName.length === 0}
            onClick={() => {
              const result = onConnect(stateName);
              setNotice(
                result.ok
                  ? `Connected Value and change to state.${stateName}.`
                  : connectionFailureMessage(result),
              );
            }}
            type="button"
          >
            {connectedStateName === stateName ? "Repair connection" : "Connect input"}
          </button>
        </div>
      )}
      {notice.length === 0 ? null : (
        <p aria-live="polite" className={styles.behaviorNotice} role="status">
          {notice}
        </p>
      )}
    </section>
  );
}

type VisibilityMode = "always" | "advanced" | "operation" | "state";

interface ParsedVisibility {
  readonly mode: VisibilityMode;
  readonly operationAlias: string;
  readonly operationStatus: string;
  readonly stateName: string;
  readonly stateValue: JsonValue;
}

function referenceText(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "$ref") return null;
  const reference = (value as Readonly<Record<string, unknown>>).$ref;
  return typeof reference === "string" ? reference : null;
}

function parseVisibility(when: JsonValue | null): ParsedVisibility {
  const fallback = Object.freeze({
    mode: when === null ? ("always" as const) : ("advanced" as const),
    operationAlias: "",
    operationStatus: "failed",
    stateName: "",
    stateValue: true,
  });
  if (when === null || typeof when !== "object" || Array.isArray(when)) return fallback;
  const object = when as Readonly<Record<string, JsonValue>>;
  if (!Array.isArray(object.args)) return fallback;
  const reference = referenceText(object.args[0]);
  if (object.op === "truthy" && object.args.length === 1 && reference?.startsWith("state.")) {
    return Object.freeze({
      ...fallback,
      mode: "state",
      stateName: reference.slice("state.".length),
      stateValue: true,
    });
  }
  if (object.op !== "eq" || object.args.length !== 2 || reference === null) return fallback;
  if (reference.startsWith("operation.") && reference.endsWith(".status")) {
    const status = object.args[1];
    if (typeof status !== "string") return fallback;
    return Object.freeze({
      ...fallback,
      mode: "operation",
      operationAlias: reference.slice("operation.".length, -".status".length),
      operationStatus: status,
    });
  }
  if (reference.startsWith("state.")) {
    return Object.freeze({
      ...fallback,
      mode: "state",
      stateName: reference.slice("state.".length),
      stateValue: object.args[1] ?? null,
    });
  }
  return fallback;
}

function conditionFailureMessage(result: AuthoringConditionEditResult): string {
  if (result.ok) return "";
  if (result.reason === "condition-absent") return "This layer is already always visible.";
  if (result.reason === "selection-invalid") return "This layer is no longer selected.";
  if (result.reason === "source-invalid")
    return "This condition is not valid for the current Source.";
  return "The visibility condition could not be applied safely.";
}

interface VisibilityControlProps {
  readonly currentWhen: JsonValue | null;
  readonly localStates: readonly AuthoringInspectorStateOption[];
  readonly onEdit: (
    edit:
      | Readonly<{ readonly kind: "clear" }>
      | Readonly<{ readonly kind: "set"; readonly when: DesenEditorContentPredicate }>,
  ) => AuthoringConditionEditResult;
  readonly operationAliases: readonly AuthoringOperationAliasOption[];
  readonly ownerId: string;
}

function stateTextValue(
  state: AuthoringInspectorStateOption | undefined,
  value: JsonValue,
): string {
  if (state?.type === "boolean") return value === false ? "false" : "true";
  if (state?.type === "integer" || state?.type === "number") {
    return typeof value === "number" ? String(value) : String(state.initial);
  }
  return typeof value === "string" ? value : String(state?.initial ?? "");
}

/** Visual condition builder with an explicit lossless advanced-JSON escape hatch. */
export function VisibilityControl({
  currentWhen,
  localStates,
  onEdit,
  operationAliases,
  ownerId,
}: Readonly<VisibilityControlProps>) {
  const parsed = useMemo(() => parseVisibility(currentWhen), [currentWhen]);
  const [mode, setMode] = useState<VisibilityMode>(parsed.mode);
  const [operationAlias, setOperationAlias] = useState(
    parsed.operationAlias || operationAliases[0]?.alias || "",
  );
  const [operationStatus, setOperationStatus] = useState(parsed.operationStatus);
  const [stateName, setStateName] = useState(parsed.stateName || localStates[0]?.name || "");
  const [stateValue, setStateValue] = useState<JsonValue>(parsed.stateValue);
  const [advancedDraft, setAdvancedDraft] = useState(
    currentWhen === null ? "" : formatStructuredJson(currentWhen),
  );
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setMode(parsed.mode);
    setOperationAlias(parsed.operationAlias || operationAliases[0]?.alias || "");
    setOperationStatus(parsed.operationStatus);
    setStateName(parsed.stateName || localStates[0]?.name || "");
    setStateValue(parsed.stateValue);
    setAdvancedDraft(currentWhen === null ? "" : formatStructuredJson(currentWhen));
  }, [currentWhen, ownerId, parsed, localStates, operationAliases]);

  useEffect(() => {
    setNotice("");
  }, [ownerId]);

  const selectedState = localStates.find(({ name }) => name === stateName);

  function apply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (mode === "always") {
      const result = onEdit({ kind: "clear" });
      setNotice(result.ok ? "This layer is now always visible." : conditionFailureMessage(result));
      return;
    }
    let when: DesenEditorContentPredicate | null = null;
    if (mode === "operation" && operationAlias.length > 0) {
      when = {
        op: "eq",
        args: [{ $ref: `operation.${operationAlias}.status` }, operationStatus],
      };
    }
    if (mode === "state" && stateName.length > 0) {
      when =
        selectedState?.type === "boolean" && stateValue === true
          ? { op: "truthy", args: [{ $ref: `state.${stateName}` }] }
          : { op: "eq", args: [{ $ref: `state.${stateName}` }, stateValue] };
    }
    if (mode === "advanced") {
      const result = parseInertJsonText(advancedDraft);
      if (
        result.ok &&
        typeof result.value === "object" &&
        result.value !== null &&
        !Array.isArray(result.value)
      ) {
        when = result.value as DesenEditorContentPredicate;
      } else {
        setNotice("Enter one valid predicate JSON object.");
        return;
      }
    }
    if (when === null) {
      setNotice("Choose a current operation result or local state.");
      return;
    }
    const result = onEdit({ kind: "set", when });
    setNotice(result.ok ? "Updated this layer's visibility." : conditionFailureMessage(result));
  }

  return (
    <section aria-label="Layer visibility" className={styles.behaviorCard}>
      <div className={styles.behaviorCardHeading}>
        <span>
          <strong>Visibility</strong>
          <small>Conditional presence</small>
        </span>
        <span className={styles.behaviorStatus} data-connected={currentWhen !== null}>
          {currentWhen === null ? "Always" : "Conditional"}
        </span>
      </div>
      <form className={styles.visibilityForm} onSubmit={apply}>
        <label>
          <span>Show this layer</span>
          <select
            aria-label="Layer visibility mode"
            onChange={(event) => {
              const nextMode = event.currentTarget.value as VisibilityMode;
              setMode(nextMode);
              setNotice("");
            }}
            value={mode}
          >
            <option value="always">Always</option>
            <option disabled={operationAliases.length === 0} value="operation">
              When an operation has a status
            </option>
            <option disabled={localStates.length === 0} value="state">
              When a local state matches
            </option>
            <option value="advanced">Advanced predicate</option>
          </select>
        </label>

        {mode === "operation" ? (
          <>
            <label>
              <span>Operation result</span>
              <select
                aria-label="Visibility operation result"
                onChange={(event) => setOperationAlias(event.currentTarget.value)}
                value={operationAlias}
              >
                {operationAliases.map((operation) => (
                  <option
                    key={`${operation.alias}:${operation.operationId}`}
                    value={operation.alias}
                  >
                    {operation.alias} · {operation.operationId}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                aria-label="Visibility operation status"
                onChange={(event) => setOperationStatus(event.currentTarget.value)}
                value={operationStatus}
              >
                <option value="failed">Failed</option>
                <option value="succeeded">Succeeded</option>
                <option value="pending">Pending</option>
                <option value="idle">Idle</option>
              </select>
            </label>
          </>
        ) : null}

        {mode === "state" ? (
          <>
            <label>
              <span>Local state</span>
              <select
                aria-label="Visibility local state"
                onChange={(event) => {
                  const next = localStates.find(({ name }) => name === event.currentTarget.value);
                  setStateName(event.currentTarget.value);
                  setStateValue(next?.type === "boolean" ? true : (next?.initial ?? ""));
                }}
                value={stateName}
              >
                {localStates.map((state) => (
                  <option key={state.name} value={state.name}>
                    {state.name} · {state.type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Equals</span>
              {selectedState?.type === "boolean" ? (
                <select
                  aria-label="Visibility state value"
                  onChange={(event) => setStateValue(event.currentTarget.value === "true")}
                  value={stateValue === false ? "false" : "true"}
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <input
                  aria-label="Visibility state value"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setStateValue(
                      selectedState?.type === "integer" || selectedState?.type === "number"
                        ? Number(value)
                        : value,
                    );
                  }}
                  step={selectedState?.type === "integer" ? 1 : "any"}
                  type={
                    selectedState?.type === "integer" || selectedState?.type === "number"
                      ? "number"
                      : "text"
                  }
                  value={stateTextValue(selectedState, stateValue)}
                />
              )}
            </label>
          </>
        ) : null}

        {mode === "advanced" ? (
          <label>
            <span>Predicate JSON</span>
            <textarea
              aria-label="Visibility predicate JSON"
              onChange={(event) => setAdvancedDraft(event.currentTarget.value)}
              spellCheck={false}
              value={advancedDraft}
            />
          </label>
        ) : null}

        <button disabled={mode === "always" && currentWhen === null} type="submit">
          {mode === "always" ? "Make always visible" : "Apply visibility"}
        </button>
      </form>
      {notice.length === 0 ? null : (
        <p aria-live="polite" className={styles.behaviorNotice} role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
