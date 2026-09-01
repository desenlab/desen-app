import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import styles from "./application.module.css";
import { formatStructuredJson, parseInertJsonText } from "./structured-json.js";

import type { FormEvent, Ref } from "react";
import type { JsonValue } from "@desen/catalog-sdk";
import type {
  AuthoringActionListModel,
  AuthoringActionModel,
  AuthoringEventActionEdit,
  AuthoringEventActionEditResult,
  AuthoringEventActionModelResult,
  AuthoringEventActionReferenceOptions,
  AuthoringEventHandlerModel,
  AuthoringPrimitiveValueKind,
  AuthoringSchemaFieldReferenceOption,
} from "./authoring-event-actions.js";
import type { StructuredJsonParseFailureReason } from "./structured-json.js";

interface EventActionPanelProps {
  readonly model: AuthoringEventActionModelResult;
  readonly onEdit: (edit: AuthoringEventActionEdit) => AuthoringEventActionEditResult;
  readonly surfaceName: string;
}

type AuthoringAction = Extract<
  AuthoringEventActionEdit,
  { readonly kind: "insert-action" }
>["action"];

type ActionType =
  | "component.command"
  | "event.emit"
  | "navigate"
  | "operation.invoke"
  | "resource.refresh"
  | "state.set"
  | "state.toggle";

const ACTION_TYPES = Object.freeze([
  "state.set",
  "state.toggle",
  "navigate",
  "operation.invoke",
  "resource.refresh",
  "component.command",
  "event.emit",
] as const satisfies readonly ActionType[]);

const ACTION_TYPE_LABELS: Readonly<Record<ActionType, string>> = Object.freeze({
  "component.command": "Component command",
  "event.emit": "Emit event",
  navigate: "Navigate",
  "operation.invoke": "Invoke operation",
  "resource.refresh": "Refresh resource",
  "state.set": "Set state",
  "state.toggle": "Toggle state",
});

interface ActionDraftSuccess {
  readonly ok: true;
  readonly action: AuthoringAction;
}

interface ActionDraftFailure {
  readonly ok: false;
  readonly message: string;
}

type ActionDraftResult = ActionDraftFailure | ActionDraftSuccess;

function editFailureMessage(result: AuthoringEventActionEditResult): string {
  if (result.ok) return "";
  if (result.reason === "catalog-invalid") return "The Catalog is no longer available.";
  if (result.reason === "event-exists") return "This event already has a handler.";
  if (result.reason === "event-not-found") return "This event handler is no longer current.";
  if (result.reason === "owner-invalid") return "The selected component is no longer current.";
  if (result.reason === "path-invalid") return "This action list is no longer current.";
  if (result.reason === "position-invalid") return "This action position is no longer current.";
  if (result.reason === "preview-unavailable") {
    return "The exact adapter preview could not accept this Source change.";
  }
  if (result.reason === "projection-limit") {
    return "These events and actions are too large to edit safely.";
  }
  if (result.reason === "source-invalid") {
    return "This complete action does not satisfy the Source contract.";
  }
  return "This event or action change could not be applied safely.";
}

function jsonFailureMessage(reason: StructuredJsonParseFailureReason): string {
  if (reason === "duplicate-member") return "Object member names must be unique.";
  if (reason === "invalid-unicode") return "Use valid Unicode scalar values.";
  if (reason === "limit-exceeded") return "This JSON exceeds the Publisher safety limits.";
  return "Enter valid JSON for one complete action.";
}

function isActionType(value: unknown): value is ActionType {
  return typeof value === "string" && ACTION_TYPES.some((type) => type === value);
}

function actionTypeIsAvailable(
  type: ActionType,
  references: AuthoringEventActionReferenceOptions,
): boolean {
  if (type === "state.set") return references.states.length > 0;
  if (type === "state.toggle") {
    return references.states.some(({ valueKind }) => valueKind === "boolean");
  }
  if (type === "navigate") {
    return references.surfaces.some(({ value }) => value !== references.currentSurfaceId);
  }
  if (type === "operation.invoke") return references.operations.length > 0;
  if (type === "resource.refresh") return references.resources.length > 0;
  if (type === "component.command") return references.componentCommands.length > 0;
  return true;
}

function firstAvailableActionType(references: AuthoringEventActionReferenceOptions): ActionType {
  return ACTION_TYPES.find((type) => actionTypeIsAvailable(type, references)) ?? "event.emit";
}

function parseActionDraft(draft: string): ActionDraftResult {
  const parsed = parseInertJsonText(draft);
  if (!parsed.ok) return Object.freeze({ ok: false, message: jsonFailureMessage(parsed.reason) });
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) {
    return Object.freeze({ ok: false, message: "Enter one complete JSON action object." });
  }
  const object = parsed.value as Readonly<Record<string, JsonValue>>;
  if (!isActionType(object.type)) {
    return Object.freeze({
      ok: false,
      message: "Choose one of the seven supported action types in the JSON object.",
    });
  }
  return Object.freeze({ ok: true, action: parsed.value as AuthoringAction });
}

function firstValue(
  options: readonly Readonly<{ readonly value: string }>[] | undefined,
  fallback: string,
): string {
  return options?.[0]?.value ?? fallback;
}

function starterAction(
  type: ActionType,
  references: AuthoringEventActionReferenceOptions,
  payloadFields: readonly AuthoringSchemaFieldReferenceOption[] = [],
): AuthoringAction {
  if (type === "state.set") {
    const target = references.states[0];
    const eventField = payloadFields.find(
      (field) => target !== undefined && valueSchemasAreCompatible(target, field),
    );
    return {
      type,
      path: target?.value ?? "stateName",
      value: eventField === undefined ? null : { $ref: `event.${eventField.value}` },
    } as AuthoringAction;
  }
  if (type === "state.toggle") {
    return {
      type,
      path:
        references.states.find(({ valueKind }) => valueKind === "boolean")?.value ??
        firstValue(references.states, "stateName"),
    } as AuthoringAction;
  }
  if (type === "navigate") {
    const destination = references.surfaces.find(
      ({ value }) => value !== references.currentSurfaceId,
    );
    return { type, surface: destination?.value ?? "" } as AuthoringAction;
  }
  if (type === "operation.invoke") {
    const operation = references.operations[0];
    const input = Object.fromEntries(
      (operation?.inputFields ?? []).flatMap((field) => {
        const state = references.states.find(
          (candidate) =>
            candidate.value === field.value && valueSchemasAreCompatible(field, candidate),
        );
        return state === undefined ? [] : [[field.value, { $ref: `state.${state.value}` }]];
      }),
    );
    return {
      type,
      operation: operation?.value ?? "operationId",
      as: uniqueOperationAlias(operation?.value ?? "operation", references.operationAliases ?? []),
      input,
      concurrency: "reject",
    } as AuthoringAction;
  }
  if (type === "resource.refresh") {
    return {
      type,
      resource: firstValue(references.resources, "resourceId"),
    } as AuthoringAction;
  }
  if (type === "component.command") {
    const command = references.componentCommands[0];
    return {
      type,
      target: command?.targetId ?? "componentId",
      command: command?.command ?? "commandName",
    } as AuthoringAction;
  }
  return { type, name: "custom.event" } as AuthoringAction;
}

function operationAlias(operationId: string): string {
  const segment = operationId.split("/").at(-1) ?? "operation";
  const normalized = segment.replace(/[^A-Za-z0-9_-]/gu, "-");
  if (/^[A-Za-z_]/u.test(normalized)) return normalized;
  return normalized.length > 0 ? `operation-${normalized}` : "operation";
}

function uniqueOperationAlias(operationId: string, existingAliases: readonly string[]): string {
  const base = operationAlias(operationId).slice(0, 128);
  if (!existingAliases.includes(base)) return base;
  for (let suffix = 2; suffix <= existingAliases.length + 2; suffix += 1) {
    const marker = `-${suffix}`;
    const candidate = `${base.slice(0, 128 - marker.length)}${marker}`;
    if (!existingAliases.includes(candidate)) return candidate;
  }
  return `operation-${existingAliases.length + 1}`;
}

function isValueReference(value: unknown): value is Readonly<{ readonly $ref: string }> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as Readonly<Record<string, JsonValue>>).$ref === "string"
  );
}

function valueKindLabel(kind: AuthoringPrimitiveValueKind): string {
  if (kind === "boolean") return "True / false";
  if (kind === "integer") return "Whole number";
  if (kind === "number") return "Number";
  if (kind === "string") return "Text";
  return "Structured data";
}

function actionType(action: AuthoringActionModel["action"]): ActionType {
  return action.type;
}

function actionSummary(action: AuthoringActionModel["action"]): string {
  if (action.type === "state.set" || action.type === "state.toggle") return action.path;
  if (action.type === "navigate") return action.surface;
  if (action.type === "operation.invoke") return `${action.operation} · as ${action.as}`;
  if (action.type === "resource.refresh") return action.resource;
  if (action.type === "component.command") return `${action.target} · ${action.command}`;
  return action.name;
}

function ReferenceGroup({
  label,
  options,
}: Readonly<{
  readonly label: string;
  readonly options: readonly Readonly<{ readonly label: string; readonly value: string }>[];
}>) {
  if (options.length === 0) return null;
  return (
    <div className={styles.actionReferenceGroup}>
      <dt>{label}</dt>
      <dd>
        {options.map((option) => (
          <span className={styles.actionReferenceChip} key={`${option.value}:${option.label}`}>
            <span>{option.label}</span>
            <code>{option.value}</code>
          </span>
        ))}
      </dd>
    </div>
  );
}

function ReferenceGuide({
  references,
}: Readonly<{ readonly references: AuthoringEventActionReferenceOptions }>) {
  const count =
    references.states.length +
    references.surfaces.length +
    references.operations.length +
    references.resources.length +
    references.componentCommands.length;
  if (count === 0) return null;
  return (
    <details className={styles.actionReferenceGuide}>
      <summary>Available Source references</summary>
      <dl>
        <ReferenceGroup label="State" options={references.states} />
        <ReferenceGroup label="Surface" options={references.surfaces} />
        <ReferenceGroup label="Operation" options={references.operations} />
        <ReferenceGroup label="Resource" options={references.resources} />
        {references.componentCommands.length === 0 ? null : (
          <div className={styles.actionReferenceGroup}>
            <dt>Component command</dt>
            <dd>
              {references.componentCommands.map((option) => (
                <span
                  className={styles.actionReferenceChip}
                  key={`${option.targetId}:${option.command}`}
                >
                  <span>{option.label}</span>
                  <code>
                    {option.targetId} · {option.command}
                  </code>
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </details>
  );
}

interface ActionJsonEditorProps {
  readonly actionLabel: string;
  readonly current: AuthoringAction;
  readonly onApply: (action: AuthoringAction) => AuthoringEventActionEditResult;
  readonly onCancel: () => void;
  readonly onNotice: (message: string) => void;
  readonly payloadFields: readonly AuthoringSchemaFieldReferenceOption[];
  readonly references: AuthoringEventActionReferenceOptions;
}

function ActionEditor({
  actionLabel,
  current,
  onApply,
  onCancel,
  onNotice,
  payloadFields,
  references,
}: Readonly<ActionJsonEditorProps>) {
  const errorId = useId();
  const helpId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const currentJson = useMemo(
    () => formatStructuredJson(current as unknown as JsonValue),
    [current],
  );
  const [visualAction, setVisualAction] = useState(current);
  const [draft, setDraft] = useState(currentJson);
  const [advancedDirty, setAdvancedDirty] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setVisualAction(current);
    setDraft(currentJson);
    setAdvancedDirty(false);
    setError("");
  }, [current, currentJson]);

  function apply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!advancedDirty) {
      const visualError = visualActionError(
        visualAction,
        references,
        payloadFields,
        current.type === "operation.invoke" ? current.as : undefined,
      );
      if (visualError !== null) {
        setError(visualError);
        onNotice("");
        return;
      }
    }
    const parsed = parseActionDraft(draft);
    if (!parsed.ok) {
      setError(parsed.message);
      onNotice("");
      textareaRef.current?.focus();
      return;
    }
    const result = onApply(parsed.action);
    if (!result.ok) {
      const message = editFailureMessage(result);
      setError(message);
      onNotice("");
      textareaRef.current?.focus();
      return;
    }
    setError("");
    onNotice(`Updated ${actionLabel}.`);
  }

  return (
    <form className={styles.actionJsonEditor} onSubmit={apply}>
      <p className={styles.actionJsonHelp} id={helpId}>
        Edit this action through current Source and Catalog choices. Apply still replaces the whole
        closed action atomically.
      </p>
      <VisualActionFields
        action={visualAction}
        onChange={(nextAction) => {
          setVisualAction(nextAction);
          setDraft(formatStructuredJson(nextAction as unknown as JsonValue));
          setAdvancedDirty(false);
          setError("");
          onNotice("");
        }}
        payloadFields={payloadFields}
        references={references}
      />
      <details className={styles.actionAdvancedEditor}>
        <summary>Advanced JSON</summary>
        <p className={styles.actionJsonHelp}>
          Power users can replace the complete action. Visual fields reset this advanced draft.
        </p>
        <textarea
          aria-describedby={[helpId, error.length > 0 ? errorId : null]
            .filter((id): id is string => id !== null)
            .join(" ")}
          aria-invalid={error.length > 0}
          aria-label={`${actionLabel} JSON`}
          className={styles.actionJsonTextarea}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setAdvancedDirty(true);
            setError("");
            onNotice("");
          }}
          ref={textareaRef}
          spellCheck={false}
          value={draft}
        />
      </details>
      <div className={styles.actionJsonControls}>
        <button disabled={draft === currentJson} type="submit">
          Apply action
        </button>
        <button
          disabled={draft === currentJson}
          onClick={() => {
            setVisualAction(current);
            setDraft(currentJson);
            setAdvancedDirty(false);
            setError("");
            onNotice("");
          }}
          type="button"
        >
          Reset
        </button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
      {error.length === 0 ? null : (
        <p className={styles.actionJsonError} id={errorId} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

interface VisualActionFieldsProps {
  readonly action: AuthoringAction;
  readonly onChange: (action: AuthoringAction) => void;
  readonly payloadFields: readonly AuthoringSchemaFieldReferenceOption[];
  readonly references: AuthoringEventActionReferenceOptions;
}

function compatibleStates(
  references: AuthoringEventActionReferenceOptions,
  target: Readonly<{ readonly schemaKey: string; readonly valueKind: AuthoringPrimitiveValueKind }>,
) {
  return references.states.filter((state) => valueSchemasAreCompatible(target, state));
}

function valueSchemasAreCompatible(
  target: Readonly<{ readonly schemaKey: string; readonly valueKind: AuthoringPrimitiveValueKind }>,
  source: Readonly<{ readonly schemaKey: string; readonly valueKind: AuthoringPrimitiveValueKind }>,
): boolean {
  if (target.valueKind === "structured" || source.valueKind === "structured") {
    return (
      target.valueKind === "structured" &&
      source.valueKind === "structured" &&
      target.schemaKey === source.schemaKey
    );
  }
  return (
    target.valueKind === source.valueKind ||
    (target.valueKind === "number" && source.valueKind === "integer")
  );
}

function literalForState(
  references: AuthoringEventActionReferenceOptions,
  statePath: string,
): JsonValue {
  const state = references.states.find(({ value }) => value === statePath);
  if (state?.valueKind === "boolean") return false;
  if (state?.valueKind === "integer" || state?.valueKind === "number") return 0;
  if (state?.valueKind === "string") return "";
  return null;
}

function VisualActionFields({
  action,
  onChange,
  payloadFields,
  references,
}: Readonly<VisualActionFieldsProps>) {
  if (action.type === "state.set") {
    const reference = isValueReference(action.value) ? action.value.$ref : null;
    const source = reference?.startsWith("event.")
      ? "event"
      : reference?.startsWith("state.")
        ? "state"
        : "literal";
    const target = references.states.find(({ value }) => value === action.path);
    const eventFields =
      target === undefined
        ? []
        : payloadFields.filter((field) => valueSchemasAreCompatible(target, field));
    const stateSources = target === undefined ? [] : compatibleStates(references, target);
    return (
      <div className={styles.actionVisualFields}>
        <label>
          <span>State to update</span>
          <select
            onChange={(event) => {
              const path = event.currentTarget.value;
              const nextTarget = references.states.find(({ value }) => value === path);
              const nextEventField = payloadFields.find(
                (field) => nextTarget !== undefined && valueSchemasAreCompatible(nextTarget, field),
              );
              const nextState = references.states.find(
                (state) => nextTarget !== undefined && valueSchemasAreCompatible(nextTarget, state),
              );
              onChange({
                ...action,
                path,
                value:
                  source === "event" && nextEventField !== undefined
                    ? { $ref: `event.${nextEventField.value}` }
                    : source === "state" && nextState !== undefined
                      ? { $ref: `state.${nextState.value}` }
                      : literalForState(references, path),
              });
            }}
            value={action.path}
          >
            {references.states.length === 0 ? (
              <option value="stateName">No state yet</option>
            ) : null}
            {references.states.map((state) => (
              <option key={state.value} value={state.value}>
                {state.label} · {valueKindLabel(state.valueKind)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Value comes from</span>
          <select
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (next === "event") {
                const field = eventFields[0];
                if (field !== undefined) {
                  onChange({ ...action, value: { $ref: `event.${field.value}` } });
                }
                return;
              }
              if (next === "state") {
                const state = stateSources[0];
                if (state !== undefined) {
                  onChange({ ...action, value: { $ref: `state.${state.value}` } });
                }
                return;
              }
              onChange({ ...action, value: literalForState(references, action.path) });
            }}
            value={source}
          >
            <option disabled={eventFields.length === 0} value="event">
              Event value
            </option>
            <option disabled={stateSources.length === 0} value="state">
              Another state
            </option>
            <option disabled={target?.valueKind === "structured"} value="literal">
              Fixed value
            </option>
          </select>
        </label>
        {source === "event" ? (
          <label>
            <span>Event field</span>
            <select
              onChange={(event) =>
                onChange({ ...action, value: { $ref: `event.${event.currentTarget.value}` } })
              }
              value={reference?.slice("event.".length) ?? ""}
            >
              {eventFields.map((field) => (
                <option key={field.value} value={field.value}>
                  {field.label} · {valueKindLabel(field.valueKind)}
                </option>
              ))}
            </select>
          </label>
        ) : source === "state" ? (
          <label>
            <span>Source state</span>
            <select
              onChange={(event) =>
                onChange({ ...action, value: { $ref: `state.${event.currentTarget.value}` } })
              }
              value={reference?.slice("state.".length) ?? ""}
            >
              {stateSources.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
          </label>
        ) : target?.valueKind === "boolean" ? (
          <label>
            <span>Fixed value</span>
            <select
              onChange={(event) =>
                onChange({ ...action, value: event.currentTarget.value === "true" })
              }
              value={action.value === true ? "true" : "false"}
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </label>
        ) : target?.valueKind === "integer" || target?.valueKind === "number" ? (
          <label>
            <span>Fixed value</span>
            <input
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                onChange({ ...action, value: Number.isFinite(value) ? value : 0 });
              }}
              step={target.valueKind === "integer" ? 1 : "any"}
              type="number"
              value={typeof action.value === "number" ? action.value : 0}
            />
          </label>
        ) : target?.valueKind === "string" ? (
          <label>
            <span>Fixed value</span>
            <input
              onChange={(event) => onChange({ ...action, value: event.currentTarget.value })}
              type="text"
              value={typeof action.value === "string" ? action.value : ""}
            />
          </label>
        ) : (
          <p className={styles.actionFieldHint}>
            Structured fixed values are available in Advanced JSON.
          </p>
        )}
      </div>
    );
  }

  if (action.type === "state.toggle") {
    const booleanStates = references.states.filter(({ valueKind }) => valueKind === "boolean");
    return (
      <div className={styles.actionVisualFields}>
        <label>
          <span>Boolean state</span>
          <select
            onChange={(event) => onChange({ ...action, path: event.currentTarget.value })}
            value={action.path}
          >
            {(booleanStates.length > 0 ? booleanStates : references.states).map((state) => (
              <option key={state.value} value={state.value}>
                {state.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (action.type === "navigate") {
    return (
      <div className={styles.actionVisualFields}>
        <label>
          <span>Destination surface</span>
          <select
            onChange={(event) => onChange({ ...action, surface: event.currentTarget.value })}
            value={action.surface}
          >
            {action.surface.length === 0 ? (
              <option value="">Add another surface before navigating</option>
            ) : null}
            {references.surfaces.map((surface) => (
              <option key={surface.value} value={surface.value}>
                {surface.label}
                {surface.value === references.currentSurfaceId ? " (current surface)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (action.type === "operation.invoke") {
    const operation = references.operations.find(({ value }) => value === action.operation);
    return (
      <div className={styles.actionVisualFields}>
        <label>
          <span>Catalog operation</span>
          <select
            onChange={(event) => {
              const nextOperation = references.operations.find(
                ({ value }) => value === event.currentTarget.value,
              );
              if (nextOperation === undefined) return;
              const nextInput: Record<string, JsonValue> = {};
              for (const field of nextOperation.inputFields) {
                const state = compatibleStates(references, field).find(
                  ({ value }) => value === field.value,
                );
                if (state !== undefined) nextInput[field.value] = { $ref: `state.${state.value}` };
              }
              onChange({
                ...action,
                operation: nextOperation.value,
                as: uniqueOperationAlias(
                  nextOperation.value,
                  (references.operationAliases ?? []).filter((alias) => alias !== action.as),
                ),
                input: nextInput,
              });
            }}
            value={action.operation}
          >
            {references.operations.length === 0 ? (
              <option value="operationId">No Catalog operations</option>
            ) : null}
            {references.operations.map((candidate) => (
              <option key={candidate.value} value={candidate.value}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        {operation?.description === undefined ? null : (
          <p className={styles.actionFieldHint}>{operation.description}</p>
        )}
        <label>
          <span>Result name</span>
          <input
            onChange={(event) => onChange({ ...action, as: event.currentTarget.value })}
            type="text"
            value={action.as}
          />
        </label>
        <p className={styles.actionFieldHint}>
          Suggested from the Catalog operation ID and kept unique on this surface.
        </p>
        <label>
          <span>If pressed again</span>
          <select
            onChange={(event) =>
              onChange({
                ...action,
                concurrency: event.currentTarget.value as "queue" | "reject" | "replace",
              })
            }
            value={action.concurrency ?? "reject"}
          >
            <option value="reject">Ignore while running</option>
            <option value="replace">Replace current run</option>
            <option value="queue">Queue another run</option>
          </select>
        </label>
        {operation?.inputFields.map((field) => {
          const current = action.input[field.value];
          const currentReference = isValueReference(current) ? current.$ref : "";
          const states = compatibleStates(references, field);
          return (
            <label key={field.value}>
              <span>
                {field.label} {field.required ? <small>Required</small> : <small>Optional</small>}
              </span>
              <select
                onChange={(event) => {
                  const nextInput = Object.fromEntries(
                    Object.entries(action.input).filter(([name]) => name !== field.value),
                  ) as Record<string, JsonValue>;
                  if (event.currentTarget.value.length > 0) {
                    nextInput[field.value] = { $ref: `state.${event.currentTarget.value}` };
                  }
                  onChange({ ...action, input: nextInput });
                }}
                value={currentReference.startsWith("state.") ? currentReference.slice(6) : ""}
              >
                <option value="">Choose state…</option>
                {states.map((state) => (
                  <option key={state.value} value={state.value}>
                    {state.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    );
  }

  if (action.type === "resource.refresh") {
    return (
      <div className={styles.actionVisualFields}>
        <label>
          <span>Resource</span>
          <select
            onChange={(event) => onChange({ ...action, resource: event.currentTarget.value })}
            value={action.resource}
          >
            {references.resources.map((resource) => (
              <option key={resource.value} value={resource.value}>
                {resource.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (action.type === "component.command") {
    const currentIndex = references.componentCommands.findIndex(
      ({ targetId, command }) => targetId === action.target && command === action.command,
    );
    return (
      <div className={styles.actionVisualFields}>
        <label>
          <span>Component command</span>
          <select
            onChange={(event) => {
              const selected = references.componentCommands[Number(event.currentTarget.value)];
              if (selected !== undefined) {
                onChange({ ...action, target: selected.targetId, command: selected.command });
              }
            }}
            value={currentIndex < 0 ? "" : String(currentIndex)}
          >
            {references.componentCommands.length === 0 ? (
              <option value="">No commands</option>
            ) : null}
            {references.componentCommands.map((command, index) => (
              <option key={`${command.targetId}:${command.command}`} value={String(index)}>
                {command.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className={styles.actionVisualFields}>
      <label>
        <span>Event name</span>
        <input
          onChange={(event) => onChange({ ...action, name: event.currentTarget.value })}
          placeholder="checkout.completed"
          type="text"
          value={action.name}
        />
      </label>
    </div>
  );
}

function visualActionError(
  action: AuthoringAction,
  references: AuthoringEventActionReferenceOptions,
  payloadFields: readonly AuthoringSchemaFieldReferenceOption[],
  currentOperationAlias?: string,
): string | null {
  if (action.type === "state.set" || action.type === "state.toggle") {
    if (action.type === "state.toggle") {
      return references.states.some(
        ({ value, valueKind }) => value === action.path && valueKind === "boolean",
      )
        ? null
        : "Choose a boolean state to toggle.";
    }
    const target = references.states.find(({ value }) => value === action.path);
    if (target === undefined) return "Create a surface state before adding this action.";
    if (isValueReference(action.value)) {
      const reference = action.value.$ref;
      if (reference.startsWith("event.")) {
        const field = payloadFields.find(({ value }) => value === reference.slice("event.".length));
        return field !== undefined && valueSchemasAreCompatible(target, field)
          ? null
          : "Choose a compatible field from this event.";
      }
      if (reference.startsWith("state.")) {
        const state = references.states.find(
          ({ value }) => value === reference.slice("state.".length),
        );
        return state !== undefined && valueSchemasAreCompatible(target, state)
          ? null
          : "Choose a compatible source state.";
      }
      return "Choose an event field, local state, or fixed value.";
    }
    if (target.valueKind === "structured") {
      return "Use Advanced JSON to enter a structured fixed value.";
    }
    const literalCompatible =
      target.valueKind === "boolean"
        ? typeof action.value === "boolean"
        : target.valueKind === "integer"
          ? typeof action.value === "number" && Number.isInteger(action.value)
          : target.valueKind === "number"
            ? typeof action.value === "number" && Number.isFinite(action.value)
            : typeof action.value === "string";
    return literalCompatible ? null : `Enter a ${valueKindLabel(target.valueKind)} fixed value.`;
  }
  if (action.type === "navigate") {
    return references.surfaces.some(({ value }) => value === action.surface)
      ? null
      : "Choose a current Source surface.";
  }
  if (action.type === "operation.invoke") {
    const operation = references.operations.find(({ value }) => value === action.operation);
    if (operation === undefined) return "Choose a Catalog operation.";
    if (action.as.trim().length === 0) return "Give this operation result a name.";
    if (!/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/u.test(action.as)) {
      return "Use a result name that can be referenced by visibility and loading controls.";
    }
    if (
      action.as !== currentOperationAlias &&
      (references.operationAliases ?? []).includes(action.as)
    ) {
      return "Choose a result name that is unique on this surface.";
    }
    const missing = operation.inputFields.find(
      (field) => field.required && !Object.hasOwn(action.input, field.value),
    );
    if (missing !== undefined) return `Connect the required ${missing.label} input to state.`;
    for (const [name, value] of Object.entries(action.input)) {
      const field = operation.inputFields.find((candidate) => candidate.value === name);
      if (field === undefined || !isValueReference(value) || !value.$ref.startsWith("state.")) {
        return "Visual operation inputs must use declared fields connected to local state.";
      }
      const state = references.states.find(
        (candidate) => candidate.value === value.$ref.slice("state.".length),
      );
      if (state === undefined || !valueSchemasAreCompatible(field, state)) {
        return `Connect ${field.label} to a schema-compatible local state.`;
      }
    }
    return null;
  }
  if (action.type === "resource.refresh") {
    return references.resources.some(({ value }) => value === action.resource)
      ? null
      : "Choose a current Source resource.";
  }
  if (action.type === "component.command") {
    return references.componentCommands.some(
      ({ targetId, command }) => targetId === action.target && command === action.command,
    )
      ? null
      : "Choose a Catalog-declared component command.";
  }
  return action.name.trim().length > 0 ? null : "Enter an event name.";
}

interface NewActionFormProps {
  readonly list: AuthoringActionListModel;
  readonly listLabel: string;
  readonly onEdit: EventActionPanelProps["onEdit"];
  readonly onNotice: (message: string) => void;
  readonly references: AuthoringEventActionReferenceOptions;
  readonly payloadFields: readonly AuthoringSchemaFieldReferenceOption[];
  readonly toggleRef?: Ref<HTMLButtonElement>;
}

function NewActionForm({
  list,
  listLabel,
  onEdit,
  onNotice,
  payloadFields,
  references,
  toggleRef,
}: Readonly<NewActionFormProps>) {
  const errorId = useId();
  const helpId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typeSelectRef = useRef<HTMLSelectElement | null>(null);
  const internalToggleRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ActionType>(() => firstAvailableActionType(references));
  const [visualAction, setVisualAction] = useState(() =>
    starterAction(firstAvailableActionType(references), references, payloadFields),
  );
  const [draft, setDraft] = useState(() =>
    formatStructuredJson(
      starterAction(
        firstAvailableActionType(references),
        references,
        payloadFields,
      ) as unknown as JsonValue,
    ),
  );
  const [advancedDirty, setAdvancedDirty] = useState(false);
  const [error, setError] = useState("");
  const [restoreToggleFocus, setRestoreToggleFocus] = useState(false);

  useLayoutEffect(() => {
    if (open) typeSelectRef.current?.focus();
  }, [open]);

  useLayoutEffect(() => {
    if (restoreToggleFocus && !open) {
      internalToggleRef.current?.focus();
      setRestoreToggleFocus(false);
    }
  }, [open, restoreToggleFocus]);

  function setToggleNode(node: HTMLButtonElement | null): void {
    internalToggleRef.current = node;
    if (typeof toggleRef === "function") toggleRef(node);
    else if (toggleRef !== undefined && toggleRef !== null) toggleRef.current = node;
  }

  function close(): void {
    setOpen(false);
    setError("");
    setRestoreToggleFocus(true);
    onNotice("");
  }

  function add(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!advancedDirty) {
      const visualError = visualActionError(visualAction, references, payloadFields);
      if (visualError !== null) {
        setError(visualError);
        onNotice("");
        typeSelectRef.current?.focus();
        return;
      }
    }
    const parsed = parseActionDraft(draft);
    if (!parsed.ok) {
      setError(parsed.message);
      onNotice("");
      textareaRef.current?.focus();
      return;
    }
    const result = onEdit({
      kind: "insert-action",
      actionListPointer: list.pointer,
      index: list.actions.length,
      action: parsed.action,
    });
    if (!result.ok) {
      const message = editFailureMessage(result);
      setError(message);
      onNotice("");
      textareaRef.current?.focus();
      return;
    }
    const nextAction = starterAction(type, references, payloadFields);
    setVisualAction(nextAction);
    setDraft(formatStructuredJson(nextAction as unknown as JsonValue));
    setAdvancedDirty(false);
    setError("");
    setOpen(false);
    setRestoreToggleFocus(true);
    onNotice(`Added ${ACTION_TYPE_LABELS[actionType(parsed.action)]} to ${listLabel}.`);
  }

  if (!open) {
    return (
      <button
        aria-label={`Add action to ${listLabel}`}
        className={styles.actionAddToggle}
        onClick={() => {
          const nextType = firstAvailableActionType(references);
          const nextAction = starterAction(nextType, references, payloadFields);
          setType(nextType);
          setVisualAction(nextAction);
          setDraft(formatStructuredJson(nextAction as unknown as JsonValue));
          setAdvancedDirty(false);
          setOpen(true);
          setError("");
          onNotice("");
        }}
        ref={setToggleNode}
        type="button"
      >
        <span aria-hidden="true">+</span> Add action
      </button>
    );
  }

  return (
    <form className={styles.actionNewForm} onSubmit={add}>
      <div className={styles.actionNewHeader}>
        <strong>Add action</strong>
        <small>Position {list.actions.length + 1}</small>
      </div>
      <label className={styles.actionTypeField}>
        <span>Action type</span>
        <select
          aria-describedby={helpId}
          aria-label={`New action type for ${listLabel}`}
          onChange={(event) => {
            const nextType = event.currentTarget.value as ActionType;
            const nextAction = starterAction(nextType, references, payloadFields);
            setType(nextType);
            setVisualAction(nextAction);
            setDraft(formatStructuredJson(nextAction as unknown as JsonValue));
            setAdvancedDirty(false);
            setError("");
            onNotice("");
          }}
          ref={typeSelectRef}
          value={type}
        >
          {ACTION_TYPES.map((actionKind) => (
            <option
              disabled={!actionTypeIsAvailable(actionKind, references)}
              key={actionKind}
              value={actionKind}
            >
              {ACTION_TYPE_LABELS[actionKind]}
            </option>
          ))}
        </select>
      </label>
      <p className={styles.actionJsonHelp} id={helpId}>
        Choose from current Source and Catalog references. No code or JSON is required.
      </p>
      <VisualActionFields
        action={visualAction}
        onChange={(nextAction) => {
          setVisualAction(nextAction);
          setDraft(formatStructuredJson(nextAction as unknown as JsonValue));
          setAdvancedDirty(false);
          setError("");
          onNotice("");
        }}
        payloadFields={payloadFields}
        references={references}
      />
      <details className={styles.actionAdvancedEditor}>
        <summary>Advanced JSON</summary>
        <p className={styles.actionJsonHelp}>
          Power users can replace the complete action. Visual fields reset this advanced draft.
        </p>
        <textarea
          aria-describedby={[helpId, error.length > 0 ? errorId : null]
            .filter((id): id is string => id !== null)
            .join(" ")}
          aria-invalid={error.length > 0}
          aria-label={`New action JSON for ${listLabel}`}
          className={styles.actionJsonTextarea}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setAdvancedDirty(true);
            setError("");
            onNotice("");
          }}
          ref={textareaRef}
          spellCheck={false}
          value={draft}
        />
      </details>
      <div className={styles.actionJsonControls}>
        <button type="submit">Add action</button>
        <button onClick={close} type="button">
          Cancel
        </button>
      </div>
      {error.length === 0 ? null : (
        <p className={styles.actionJsonError} id={errorId} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

interface ActionCardProps {
  readonly action: AuthoringActionModel;
  readonly actionLabel: string;
  readonly canMoveDown: boolean;
  readonly canMoveUp: boolean;
  readonly onDelete: () => void;
  readonly onEdit: EventActionPanelProps["onEdit"];
  readonly onNotice: (message: string) => void;
  readonly onReorder: (index: number) => void;
  readonly payloadFields: readonly AuthoringSchemaFieldReferenceOption[];
  readonly references: AuthoringEventActionReferenceOptions;
  readonly editButtonRef?: Ref<HTMLButtonElement>;
}

function ActionCard({
  action,
  actionLabel,
  canMoveDown,
  canMoveUp,
  onDelete,
  onEdit,
  onNotice,
  onReorder,
  payloadFields,
  references,
  editButtonRef,
}: Readonly<ActionCardProps>) {
  const internalEditRef = useRef<HTMLButtonElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [restoreEditFocus, setRestoreEditFocus] = useState(false);

  useLayoutEffect(() => {
    if (restoreEditFocus && !editing) {
      internalEditRef.current?.focus();
      setRestoreEditFocus(false);
    }
  }, [editing, restoreEditFocus]);

  function setEditNode(node: HTMLButtonElement | null): void {
    internalEditRef.current = node;
    if (typeof editButtonRef === "function") editButtonRef(node);
    else if (editButtonRef !== undefined && editButtonRef !== null) editButtonRef.current = node;
  }

  const type = actionType(action.action);
  return (
    <article aria-label={actionLabel} className={styles.actionCard}>
      <div className={styles.actionCardHeader}>
        <span className={styles.actionOrder} aria-hidden="true">
          {action.index + 1}
        </span>
        <div className={styles.actionIdentity}>
          <strong>{ACTION_TYPE_LABELS[type]}</strong>
          <code>{actionSummary(action.action)}</code>
        </div>
        <span className={styles.actionTypeBadge}>{type}</span>
      </div>

      <div className={styles.actionCardControls}>
        <button
          aria-label={`Move ${actionLabel} up`}
          disabled={!canMoveUp}
          onClick={() => onReorder(action.index - 1)}
          type="button"
        >
          ↑
        </button>
        <button
          aria-label={`Move ${actionLabel} down`}
          disabled={!canMoveDown}
          onClick={() => onReorder(action.index + 1)}
          type="button"
        >
          ↓
        </button>
        <button
          aria-expanded={editing}
          aria-label={`Edit ${actionLabel}`}
          onClick={() => {
            setEditing((current) => !current);
            onNotice("");
          }}
          ref={setEditNode}
          type="button"
        >
          {editing ? "Close" : "Edit"}
        </button>
        <button aria-label={`Delete ${actionLabel}`} onClick={onDelete} type="button">
          Delete
        </button>
      </div>

      {editing ? (
        <ActionEditor
          actionLabel={actionLabel}
          current={action.action as AuthoringAction}
          onApply={(replacement) => {
            const result = onEdit({
              kind: "replace-action",
              actionPointer: action.pointer,
              action: replacement,
            });
            if (result.ok) {
              setEditing(false);
              setRestoreEditFocus(true);
            }
            return result;
          }}
          onCancel={() => {
            setEditing(false);
            setRestoreEditFocus(true);
            onNotice("");
          }}
          onNotice={onNotice}
          payloadFields={payloadFields}
          references={references}
        />
      ) : null}

      {action.onSuccess === null || action.onFailure === null ? null : (
        <div className={styles.actionSettlementLists}>
          <ActionListView
            label={`${actionLabel} success`}
            list={action.onSuccess}
            onEdit={onEdit}
            onNotice={onNotice}
            references={references}
            payloadFields={[]}
            tone="success"
          />
          <ActionListView
            label={`${actionLabel} failure`}
            list={action.onFailure}
            onEdit={onEdit}
            onNotice={onNotice}
            references={references}
            payloadFields={[]}
            tone="failure"
          />
        </div>
      )}
    </article>
  );
}

interface ActionListViewProps {
  readonly label: string;
  readonly list: AuthoringActionListModel;
  readonly onEdit: EventActionPanelProps["onEdit"];
  readonly onNotice: (message: string) => void;
  readonly references: AuthoringEventActionReferenceOptions;
  readonly payloadFields: readonly AuthoringSchemaFieldReferenceOption[];
  readonly tone?: "failure" | "root" | "success";
  readonly addButtonRef?: Ref<HTMLButtonElement>;
}

function ActionListView({
  label,
  list,
  onEdit,
  onNotice,
  payloadFields,
  references,
  tone = "root",
  addButtonRef,
}: Readonly<ActionListViewProps>) {
  const titleId = useId();
  const editButtons = useRef(new Map<number, HTMLButtonElement>());
  const internalAddButton = useRef<HTMLButtonElement | null>(null);
  const focusIndex = useRef<number | "add" | null>(null);

  useLayoutEffect(() => {
    const requested = focusIndex.current;
    if (requested === null) return;
    if (requested === "add") internalAddButton.current?.focus();
    else editButtons.current.get(requested)?.focus();
    focusIndex.current = null;
  }, [list.actions]);

  function setAddNode(node: HTMLButtonElement | null): void {
    internalAddButton.current = node;
    if (typeof addButtonRef === "function") addButtonRef(node);
    else if (addButtonRef !== undefined && addButtonRef !== null) addButtonRef.current = node;
  }

  function editButtonRef(index: number): (node: HTMLButtonElement | null) => void {
    return (node) => {
      if (node === null) editButtons.current.delete(index);
      else editButtons.current.set(index, node);
    };
  }

  function deleteAction(action: AuthoringActionModel): void {
    focusIndex.current =
      list.actions.length === 1 ? "add" : Math.min(action.index, list.actions.length - 2);
    const result = onEdit({ kind: "delete-action", actionPointer: action.pointer });
    if (!result.ok) {
      focusIndex.current = null;
      onNotice(editFailureMessage(result));
      return;
    }
    onNotice(`Deleted action ${action.index + 1} from ${label}.`);
  }

  function reorderAction(action: AuthoringActionModel, index: number): void {
    focusIndex.current = index;
    const result = onEdit({ kind: "reorder-action", actionPointer: action.pointer, index });
    if (!result.ok) {
      focusIndex.current = null;
      onNotice(editFailureMessage(result));
      return;
    }
    onNotice(`Moved action ${action.index + 1} in ${label}.`);
  }

  return (
    <section
      aria-labelledby={titleId}
      className={styles.actionListSection}
      data-action-list-tone={tone}
    >
      <div className={styles.actionListHeader}>
        <h4 id={titleId}>
          {tone === "root" ? "Actions" : tone === "success" ? "Success" : "Failure"}
        </h4>
        <span>{list.actions.length}</span>
      </div>
      {!list.present && tone !== "root" ? (
        <p className={styles.actionListHint}>
          This settlement list is absent until its first action is added.
        </p>
      ) : null}
      {list.actions.length === 0 ? (
        <div className={styles.actionListEmpty}>
          <span>No actions yet</span>
          <small>Ordered Source list. This panel does not execute it.</small>
        </div>
      ) : (
        <ol aria-label={`${label} actions`} className={styles.actionList}>
          {list.actions.map((action) => {
            const actionLabel = `action ${action.index + 1} in ${label}`;
            return (
              <li key={action.pointer}>
                <ActionCard
                  action={action}
                  actionLabel={actionLabel}
                  canMoveDown={action.index < list.actions.length - 1}
                  canMoveUp={action.index > 0}
                  editButtonRef={editButtonRef(action.index)}
                  onDelete={() => deleteAction(action)}
                  onEdit={onEdit}
                  onNotice={onNotice}
                  onReorder={(index) => reorderAction(action, index)}
                  payloadFields={payloadFields}
                  references={references}
                />
              </li>
            );
          })}
        </ol>
      )}
      <NewActionForm
        list={list}
        listLabel={label}
        onEdit={onEdit}
        onNotice={onNotice}
        payloadFields={payloadFields}
        references={references}
        toggleRef={setAddNode}
      />
    </section>
  );
}

interface EventCardProps {
  readonly event: AuthoringEventHandlerModel;
  readonly onEdit: EventActionPanelProps["onEdit"];
  readonly onNotice: (message: string) => void;
  readonly references: AuthoringEventActionReferenceOptions;
}

function EventCard({ event, onEdit, onNotice, references }: Readonly<EventCardProps>) {
  const descriptionId = useId();
  const addHandlerRef = useRef<HTMLButtonElement | null>(null);
  const deleteHandlerRef = useRef<HTMLButtonElement | null>(null);
  const addActionRef = useRef<HTMLButtonElement | null>(null);
  const requestedFocus = useRef<"add-action" | "add-handler" | null>(null);

  useLayoutEffect(() => {
    if (requestedFocus.current === "add-action") addActionRef.current?.focus();
    if (requestedFocus.current === "add-handler") addHandlerRef.current?.focus();
    requestedFocus.current = null;
  }, [event.actionList.present]);

  function addHandler(): void {
    requestedFocus.current = "add-action";
    const result = onEdit({ kind: "insert-handler", event: event.event, actions: [] });
    if (!result.ok) {
      requestedFocus.current = null;
      onNotice(editFailureMessage(result));
      return;
    }
    onNotice(`Added the ${event.event} handler.`);
  }

  function deleteHandler(): void {
    requestedFocus.current = "add-handler";
    const result = onEdit({ kind: "delete-handler", event: event.event });
    if (!result.ok) {
      requestedFocus.current = null;
      onNotice(editFailureMessage(result));
      return;
    }
    onNotice(`Deleted the ${event.event} handler and its actions.`);
  }

  return (
    <li className={styles.eventCard}>
      <article aria-describedby={event.description === undefined ? undefined : descriptionId}>
        <div className={styles.eventCardHeader}>
          <div>
            <span className={styles.eventEyebrow}>Catalog event</span>
            <h3>{event.event}</h3>
          </div>
          <span className={styles.eventHandlerBadge} data-present={event.actionList.present}>
            {event.actionList.present ? "Handler added" : "No handler"}
          </span>
        </div>
        {event.description === undefined ? null : (
          <p className={styles.eventDescription} id={descriptionId}>
            {event.description}
          </p>
        )}
        <details className={styles.eventPayloadSchema}>
          <summary>Payload schema</summary>
          <pre>{formatStructuredJson(event.payloadSchema as unknown as JsonValue)}</pre>
        </details>

        {event.actionList.present ? (
          <div className={styles.eventHandlerBody}>
            <div className={styles.eventHandlerControls}>
              <span>Source handler</span>
              <button
                aria-label={`Delete ${event.event} event handler`}
                onClick={deleteHandler}
                ref={deleteHandlerRef}
                type="button"
              >
                Delete handler
              </button>
            </div>
            <ActionListView
              addButtonRef={addActionRef}
              label={event.event}
              list={event.actionList}
              onEdit={onEdit}
              onNotice={onNotice}
              payloadFields={event.payloadFields}
              references={references}
            />
          </div>
        ) : (
          <div className={styles.eventHandlerEmpty}>
            <p>Add a Source handler before defining its ordered actions.</p>
            <button
              aria-label={`Add ${event.event} event handler`}
              onClick={addHandler}
              ref={addHandlerRef}
              type="button"
            >
              <span aria-hidden="true">+</span> Add handler
            </button>
          </div>
        )}
      </article>
    </li>
  );
}

function RejectedPanel({
  model,
}: Readonly<{ readonly model: Extract<AuthoringEventActionModelResult, { status: "rejected" }> }>) {
  const message =
    model.reason === "route-invalid"
      ? "The current surface is no longer a valid Source route."
      : model.reason === "selection-invalid"
        ? "The selected component is no longer current."
        : "This component's events and actions are too large to project safely.";
  return (
    <div className={styles.eventActionRejected} role="alert">
      <strong>Events and actions unavailable</strong>
      <p>{message}</p>
    </div>
  );
}

/**
 * App-owned editor for one component's Catalog-declared events and complete DESEN closed actions.
 *
 * @remarks The panel renders only authoring chrome outside managed capability subtrees. Handler
 * edits are explicit, while action add/replace drafts remain local until the user applies one
 * complete JSON action. The panel never executes an action or represents a durable save.
 */
export function EventActionPanel({ model, onEdit, surfaceName }: Readonly<EventActionPanelProps>) {
  const titleId = useId();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setNotice("");
  }, [model.status, model.status === "ready" ? model.owner.ownerId : null]);

  return (
    <section aria-labelledby={titleId} className={styles.eventActionPanel}>
      <div className={styles.eventActionHeader}>
        <div>
          <h2 id={titleId}>Events &amp; Actions</h2>
          <small>Source interactions</small>
        </div>
        <span className={styles.eventActionCount}>
          {model.status === "ready" ? model.events.length : 0}
        </span>
      </div>
      <p className={styles.eventActionScope}>
        Catalog-declared events for {surfaceName}. This panel authors handlers but does not execute
        their actions.
      </p>

      {model.status === "idle" ? (
        <div className={styles.eventActionIdle}>
          <strong>Select a component</strong>
          <p>Select a component to inspect its Catalog-declared events.</p>
        </div>
      ) : model.status === "rejected" ? (
        <RejectedPanel model={model} />
      ) : (
        <div className={styles.eventActionBody}>
          <div aria-label="Selected event component" className={styles.eventOwnerContext}>
            <div className={styles.eventOwnerIcon} aria-hidden="true">
              C
            </div>
            <div>
              <strong>{model.owner.displayName}</strong>
              <code>{model.owner.ownerId}</code>
            </div>
            <span>Component</span>
            {model.owner.conditional ? <small>Conditional component</small> : null}
          </div>

          <ReferenceGuide references={model.referenceOptions} />

          {model.events.length === 0 ? (
            <div className={styles.eventActionEmpty}>
              <strong>No Catalog events</strong>
              <p>This selected component does not declare any editable events.</p>
            </div>
          ) : (
            <ul
              aria-label={`${model.owner.displayName} Catalog events`}
              className={styles.eventList}
            >
              {model.events.map((event) => (
                <EventCard
                  event={event}
                  key={`${model.owner.ownerId}:${event.event}`}
                  onEdit={onEdit}
                  onNotice={setNotice}
                  references={model.referenceOptions}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <p aria-atomic="true" aria-live="polite" className={styles.eventActionNotice} role="status">
        {notice || "Visual changes stay local until the complete action is added."}
      </p>
    </section>
  );
}
