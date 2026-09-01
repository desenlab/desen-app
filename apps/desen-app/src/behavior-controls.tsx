import { useEffect, useMemo, useState } from "react";

import styles from "./application.module.css";
import { isAuthoringInspectorStateCompatible } from "./authoring-inspector.js";
import { formatStructuredJson, parseInertJsonText } from "./structured-json.js";

import type { FormEvent } from "react";
import type { JsonValue } from "@desen/catalog-sdk";
import type { DesenEditorContentPredicate } from "@desen/editor-core";
import type { AuthoringConditionEditResult } from "./authoring-conditions.js";
import type {
  AuthoringConnectionResult,
  AuthoringOperationTriggerConnectionRecipe,
} from "./authoring-connections.js";
import type {
  AuthoringClosedAction,
  AuthoringEventActionModelResult,
  AuthoringOperationActionReferenceOption,
  AuthoringSchemaFieldReferenceOption,
  AuthoringStateActionReferenceOption,
} from "./authoring-event-actions.js";
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

type OperationAction = Extract<AuthoringClosedAction, { readonly type: "operation.invoke" }>;

type OperationConnectionNotice =
  | Readonly<{
      readonly text: string;
      readonly scope: Readonly<{ readonly kind: "authority"; readonly value: string }>;
    }>
  | Readonly<{
      readonly text: string;
      readonly scope: Readonly<{
        readonly kind: "connection";
        readonly value: string;
        readonly settledAuthority: string | null;
      }>;
    }>;

interface OperationConnectionControlProps {
  readonly inspector: AuthoringInspectorModelResult;
  readonly model: AuthoringEventActionModelResult;
  readonly operationAliases: readonly AuthoringOperationAliasOption[];
  readonly onConnect: (
    recipe: AuthoringOperationTriggerConnectionRecipe,
  ) => AuthoringConnectionResult;
}

function operationConnectionFailureMessage(result: AuthoringConnectionResult): string {
  if (result.ok) return "";
  if (result.reason === "connection-conflict") {
    return "This press event already contains a conflicting operation. Review it in Actions first.";
  }
  if (result.reason === "connection-incompatible") {
    return "Connect every required operation input to a compatible local state.";
  }
  if (result.reason === "operation-unavailable") {
    return "That operation is no longer declared by the current Catalog.";
  }
  if (result.reason === "state-unavailable") return "One mapped state is no longer available.";
  if (result.reason === "selection-invalid") return "This layer is no longer selected.";
  return "The complete operation connection could not be applied safely.";
}

function suggestedOperationAlias(
  operationId: string,
  reservedAliases: readonly string[],
  currentAlias: string | undefined,
): string {
  const segment = operationId.split("/").at(-1) ?? "operation";
  const normalized = segment.replace(/[^A-Za-z0-9_-]/gu, "-");
  const prefixed = /^[A-Za-z_]/u.test(normalized)
    ? normalized
    : normalized.length > 0
      ? `operation-${normalized}`
      : "operation";
  const base = prefixed.slice(0, 128);
  const reserved = new Set(reservedAliases.filter((alias) => alias !== currentAlias));
  if (!reserved.has(base)) return base;
  for (let index = 2; index <= reserved.size + 2; index += 1) {
    const suffix = `-${index}`;
    const candidate = `${base.slice(0, 128 - suffix.length)}${suffix}`;
    if (!reserved.has(candidate)) return candidate;
  }
  return "";
}

function operationFieldAcceptsState(
  field: AuthoringSchemaFieldReferenceOption,
  state: AuthoringStateActionReferenceOption,
): boolean {
  if (field.valueKind === "structured" || state.valueKind === "structured") {
    return (
      field.valueKind === "structured" &&
      state.valueKind === "structured" &&
      field.schemaKey === state.schemaKey
    );
  }
  return (
    field.valueKind === state.valueKind ||
    (field.valueKind === "number" && state.valueKind === "integer")
  );
}

function rootPressOperation(model: AuthoringEventActionModelResult): OperationAction | null {
  if (model.status !== "ready") return null;
  const press = model.events.find(({ event }) => event === "press");
  const operations = (press?.actionList.actions ?? []).flatMap(({ action }) =>
    action.type === "operation.invoke" ? [action] : [],
  );
  return operations.length === 1 ? (operations[0] as OperationAction) : null;
}

function exactPendingReference(value: JsonValue, alias: string): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const object = value as Readonly<Record<string, JsonValue>>;
  const keys = Object.keys(value).sort();
  return (
    keys.length === 2 &&
    keys[0] === "$ref" &&
    keys[1] === "fallback" &&
    object.$ref === `operation.${alias}.pending` &&
    object.fallback === false
  );
}

function operationInputState(action: OperationAction | null, inputName: string): string | null {
  const value = action?.input[inputName];
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const object = value as Readonly<Record<string, JsonValue>>;
  const keys = Object.keys(value);
  const reference = keys.length === 1 && keys[0] === "$ref" ? object.$ref : null;
  return typeof reference === "string" && reference.startsWith("state.")
    ? reference.slice("state.".length)
    : null;
}

function initialOperationMappings(
  operation: AuthoringOperationActionReferenceOption,
  states: readonly AuthoringStateActionReferenceOption[],
  current: OperationAction | null,
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      operation.inputFields.map((field) => {
        const compatible = states.filter((state) => operationFieldAcceptsState(field, state));
        const currentState = operationInputState(current, field.value);
        if (current !== null && current.operation === operation.value) {
          if (!Object.hasOwn(current.input, field.value)) return [field.value, ""];
          return [field.value, compatible.find(({ value }) => value === currentState)?.value ?? ""];
        }
        const selected = compatible.find(({ value }) => value === field.value)?.value ?? "";
        return [field.value, selected];
      }),
    ),
  );
}

function unrepresentableOperationInputNames(
  operation: AuthoringOperationActionReferenceOption | undefined,
  states: readonly AuthoringStateActionReferenceOption[],
  current: OperationAction | null,
): readonly string[] {
  if (operation === undefined || current === null || current.operation !== operation.value) {
    return Object.freeze([]);
  }
  const declaredInputNames = new Set(operation.inputFields.map(({ value }) => value));
  return Object.freeze(
    [
      ...operation.inputFields.flatMap((field) => {
        if (!Object.hasOwn(current.input, field.value)) return [];
        const currentState = operationInputState(current, field.value);
        return states.some(
          (state) => state.value === currentState && operationFieldAcceptsState(field, state),
        )
          ? []
          : [field.value];
      }),
      ...Object.keys(current.input).filter((inputName) => !declaredInputNames.has(inputName)),
    ].sort(),
  );
}

function operationConnectionSignature(
  operationId: string,
  alias: string,
  concurrency: "queue" | "reject" | "replace" | undefined,
  inputs: Readonly<Record<string, JsonValue>>,
  loading: JsonValue | null,
): string {
  return JSON.stringify([
    operationId,
    alias,
    concurrency ?? null,
    Object.keys(inputs)
      .sort()
      .map((name) => [name, inputs[name]]),
    loading,
  ]);
}

function recipeConnectionSignature(recipe: AuthoringOperationTriggerConnectionRecipe): string {
  return operationConnectionSignature(
    recipe.operationId,
    recipe.alias,
    recipe.concurrency,
    Object.fromEntries(
      recipe.inputs.map(({ inputName, stateName }) => [
        inputName,
        Object.freeze({ $ref: `state.${stateName}` }),
      ]),
    ),
    recipe.connectLoading
      ? Object.freeze({ $ref: `operation.${recipe.alias}.pending`, fallback: false })
      : null,
  );
}

/** No-code press → operation recipe with a real Runtime-backed pending/loading connection. */
export function OperationConnectionControl({
  inspector,
  model,
  operationAliases: surfaceOperationAliases,
  onConnect,
}: Readonly<OperationConnectionControlProps>) {
  const press =
    model.status === "ready" ? model.events.find(({ event }) => event === "press") : null;
  const loadingField =
    inspector.status === "ready"
      ? inspector.fields.find(
          ({ control }) => control.valuePointer === "/loading" && control.kind === "boolean",
        )
      : undefined;
  const operations = model.status === "ready" ? model.referenceOptions.operations : [];
  const states = model.status === "ready" ? model.referenceOptions.states : [];
  const current = rootPressOperation(model);
  const reservedAliases = surfaceOperationAliases.map(({ alias }) => alias);
  const defaultOperation =
    operations.find(({ value }) => value === current?.operation) ?? operations[0];
  const [operationId, setOperationId] = useState(defaultOperation?.value ?? "");
  const [alias, setAlias] = useState(
    current?.as ??
      (defaultOperation === undefined
        ? ""
        : suggestedOperationAlias(defaultOperation.value, reservedAliases, current?.as)),
  );
  const [concurrency, setConcurrency] = useState<"queue" | "reject" | "replace">(
    current?.concurrency ?? "reject",
  );
  const [mappings, setMappings] = useState<Readonly<Record<string, string>>>(() =>
    defaultOperation === undefined
      ? Object.freeze({})
      : initialOperationMappings(defaultOperation, states, current),
  );
  const [notice, setNotice] = useState<OperationConnectionNotice | null>(null);
  const selectedOperation = operations.find(({ value }) => value === operationId);
  const unrepresentableInputs = unrepresentableOperationInputNames(
    selectedOperation,
    states,
    current,
  ).filter((inputName) => (mappings[inputName] ?? "").length === 0);
  const loadingConnected =
    current !== null &&
    loadingField?.value.kind === "dynamic" &&
    exactPendingReference(loadingField.value.value, current.as);
  const ownerId = model.status === "ready" ? model.owner.ownerId : null;
  const currentConnectionSignature =
    current === null
      ? ""
      : operationConnectionSignature(
          current.operation,
          current.as,
          current.concurrency,
          current.input,
          loadingField?.value.kind === "dynamic" ? loadingField.value.value : null,
        );
  const authoritySignature = JSON.stringify([
    ownerId,
    currentConnectionSignature,
    operations.map(({ inputFields, value }) => [
      value,
      inputFields.map(({ required, schemaKey, value: field, valueKind }) => [
        field,
        required,
        valueKind,
        schemaKey,
      ]),
    ]),
    states.map(({ schemaKey, value, valueKind }) => [value, valueKind, schemaKey]),
    surfaceOperationAliases.map(({ alias, operationId }) => [alias, operationId]),
  ]);

  useEffect(() => {
    const nextOperation =
      operations.find(({ value }) => value === current?.operation) ?? operations[0];
    setOperationId(nextOperation?.value ?? "");
    setAlias(
      current?.as ??
        (nextOperation === undefined
          ? ""
          : suggestedOperationAlias(nextOperation.value, reservedAliases, current?.as)),
    );
    setConcurrency(current?.concurrency ?? "reject");
    setMappings(
      nextOperation === undefined
        ? Object.freeze({})
        : initialOperationMappings(nextOperation, states, current),
    );
    setNotice((currentNotice) => {
      if (currentNotice === null) return null;
      if (currentNotice.scope.kind === "authority") {
        return currentNotice.scope.value === authoritySignature ? currentNotice : null;
      }
      if (currentNotice.scope.value !== currentConnectionSignature) return null;
      if (currentNotice.scope.settledAuthority === null) {
        return Object.freeze({
          ...currentNotice,
          scope: Object.freeze({
            ...currentNotice.scope,
            settledAuthority: authoritySignature,
          }),
        });
      }
      return currentNotice.scope.settledAuthority === authoritySignature ? currentNotice : null;
    });
  }, [authoritySignature]);

  if (
    model.status !== "ready" ||
    inspector.status !== "ready" ||
    press === undefined ||
    loadingField === undefined ||
    operations.length === 0
  ) {
    return null;
  }

  const missingRequired =
    selectedOperation?.inputFields.some(
      (field) => field.required && (mappings[field.value] ?? "").length === 0,
    ) ?? true;
  const aliasValid = /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/u.test(alias);
  const aliasAvailable = alias === current?.as || !reservedAliases.includes(alias);

  return (
    <section aria-label="Operation connection" className={styles.behaviorCard}>
      <div className={styles.behaviorCardHeading}>
        <span>
          <strong>Operation connection</strong>
          <small>Press &amp; pending</small>
        </span>
        <span className={styles.behaviorStatus} data-connected={loadingConnected}>
          {loadingConnected ? "Connected" : "Not connected"}
        </span>
      </div>
      <p>
        Invokes one Catalog operation from Press and reflects its real pending lifecycle through
        this component&apos;s Loading property.
      </p>
      <div className={styles.operationConnectionForm}>
        <label>
          <span>Catalog operation</span>
          <select
            aria-label="Operation connection Catalog operation"
            onChange={(event) => {
              const next = operations.find(({ value }) => value === event.currentTarget.value);
              if (next === undefined) return;
              setOperationId(next.value);
              setAlias(suggestedOperationAlias(next.value, reservedAliases, current?.as));
              setMappings(
                initialOperationMappings(
                  next,
                  states,
                  next.value === current?.operation ? current : null,
                ),
              );
              setNotice(null);
            }}
            value={operationId}
          >
            {operations.map((operation) => (
              <option key={operation.value} value={operation.value}>
                {operation.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Result name</span>
          <input
            aria-label="Operation connection result name"
            onChange={(event) => {
              setAlias(event.currentTarget.value);
              setNotice(null);
            }}
            type="text"
            value={alias}
          />
        </label>
        {aliasAvailable ? null : (
          <p className={styles.operationPendingDisclosure} role="alert">
            This result name is already used on this surface. Choose a unique name.
          </p>
        )}
        {selectedOperation?.inputFields.map((field) => {
          const compatibleStates = states.filter((state) =>
            operationFieldAcceptsState(field, state),
          );
          return (
            <label key={field.value}>
              <span>
                {field.label} {field.required ? <small>Required</small> : <small>Optional</small>}
              </span>
              <select
                aria-label={`Operation connection ${field.label}`}
                onChange={(event) => {
                  const stateName = event.currentTarget.value;
                  setMappings((currentMappings) =>
                    Object.freeze({
                      ...currentMappings,
                      [field.value]: stateName,
                    }),
                  );
                  setNotice(null);
                }}
                value={mappings[field.value] ?? ""}
              >
                <option value="">Choose state…</option>
                {compatibleStates.map((state) => (
                  <option key={state.value} value={state.value}>
                    {state.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        <label>
          <span>If operation is already running</span>
          <select
            aria-label="Operation connection concurrency"
            onChange={(event) => {
              setConcurrency(event.currentTarget.value as "queue" | "reject" | "replace");
              setNotice(null);
            }}
            value={concurrency}
          >
            <option value="reject">Ignore while running</option>
            <option value="replace">Replace current run</option>
            <option value="queue">Queue another run</option>
          </select>
        </label>
        {unrepresentableInputs.length === 0 ? null : (
          <p className={styles.operationPendingDisclosure} role="alert">
            Advanced input values are preserved. Choose replacement states for{" "}
            {unrepresentableInputs.join(", ")} before repairing, or keep them unchanged in Actions.
          </p>
        )}
        <p className={styles.operationPendingDisclosure}>
          Pending → Loading · this control blocks activation while pending. Concurrency governs
          another invocation of the same result.
        </p>
        <button
          disabled={
            selectedOperation === undefined ||
            missingRequired ||
            unrepresentableInputs.length > 0 ||
            !aliasValid ||
            !aliasAvailable
          }
          onClick={() => {
            if (selectedOperation === undefined) return;
            const recipe = Object.freeze({
              alias,
              concurrency,
              connectLoading: true,
              inputs: Object.freeze(
                selectedOperation.inputFields.flatMap((field) => {
                  const stateName = mappings[field.value] ?? "";
                  return stateName.length === 0
                    ? []
                    : [Object.freeze({ inputName: field.value, stateName })];
                }),
              ),
              operationId: selectedOperation.value,
            });
            const result = onConnect(recipe);
            setNotice(
              result.ok
                ? Object.freeze({
                    text: `Connected Press, operation.${alias}, and Loading pending.`,
                    scope: Object.freeze({
                      kind: "connection" as const,
                      value: recipeConnectionSignature(recipe),
                      settledAuthority:
                        recipeConnectionSignature(recipe) === currentConnectionSignature
                          ? authoritySignature
                          : null,
                    }),
                  })
                : Object.freeze({
                    text: operationConnectionFailureMessage(result),
                    scope: Object.freeze({
                      kind: "authority" as const,
                      value: authoritySignature,
                    }),
                  }),
            );
          }}
          type="button"
        >
          {loadingConnected ? "Repair operation" : "Connect operation"}
        </button>
      </div>
      {notice === null ? null : (
        <p aria-live="polite" className={styles.behaviorNotice} role="status">
          {notice.text}
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
