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
): AuthoringAction {
  if (type === "state.set") {
    return {
      type,
      path: firstValue(references.states, "stateName"),
      value: null,
    } as AuthoringAction;
  }
  if (type === "state.toggle") {
    return { type, path: firstValue(references.states, "stateName") } as AuthoringAction;
  }
  if (type === "navigate") {
    return { type, surface: firstValue(references.surfaces, "surfaceId") } as AuthoringAction;
  }
  if (type === "operation.invoke") {
    return {
      type,
      operation: firstValue(references.operations, "operationId"),
      as: "result",
      input: {},
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
}

function ActionJsonEditor({
  actionLabel,
  current,
  onApply,
  onCancel,
  onNotice,
}: Readonly<ActionJsonEditorProps>) {
  const errorId = useId();
  const helpId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const currentJson = useMemo(
    () => formatStructuredJson(current as unknown as JsonValue),
    [current],
  );
  const [draft, setDraft] = useState(currentJson);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(currentJson);
    setError("");
  }, [currentJson]);

  function apply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
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
        Apply replaces the complete action. References such as{" "}
        <code>{'{"$ref":"state.name"}'}</code> remain inert Source data here.
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
          setError("");
          onNotice("");
        }}
        ref={textareaRef}
        spellCheck={false}
        value={draft}
      />
      <div className={styles.actionJsonControls}>
        <button disabled={draft === currentJson} type="submit">
          Apply action
        </button>
        <button
          disabled={draft === currentJson}
          onClick={() => {
            setDraft(currentJson);
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

interface NewActionFormProps {
  readonly list: AuthoringActionListModel;
  readonly listLabel: string;
  readonly onEdit: EventActionPanelProps["onEdit"];
  readonly onNotice: (message: string) => void;
  readonly references: AuthoringEventActionReferenceOptions;
  readonly toggleRef?: Ref<HTMLButtonElement>;
}

function NewActionForm({
  list,
  listLabel,
  onEdit,
  onNotice,
  references,
  toggleRef,
}: Readonly<NewActionFormProps>) {
  const errorId = useId();
  const helpId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const internalToggleRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ActionType>("state.set");
  const [draft, setDraft] = useState(() =>
    formatStructuredJson(starterAction("state.set", references) as unknown as JsonValue),
  );
  const [error, setError] = useState("");
  const [restoreToggleFocus, setRestoreToggleFocus] = useState(false);

  useLayoutEffect(() => {
    if (open) textareaRef.current?.focus();
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
    setDraft(formatStructuredJson(starterAction(type, references) as unknown as JsonValue));
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
        <span>Starter type</span>
        <select
          aria-describedby={helpId}
          aria-label={`New action type for ${listLabel}`}
          onChange={(event) => {
            const nextType = event.currentTarget.value as ActionType;
            setType(nextType);
            setDraft(
              formatStructuredJson(starterAction(nextType, references) as unknown as JsonValue),
            );
            setError("");
            onNotice("");
          }}
          value={type}
        >
          {ACTION_TYPES.map((actionKind) => (
            <option key={actionKind} value={actionKind}>
              {ACTION_TYPE_LABELS[actionKind]}
            </option>
          ))}
        </select>
      </label>
      <p className={styles.actionJsonHelp} id={helpId}>
        The starter only seeds the draft. The complete JSON object is committed unchanged.
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
          setError("");
          onNotice("");
        }}
        ref={textareaRef}
        spellCheck={false}
        value={draft}
      />
      <div className={styles.actionJsonControls}>
        <button type="submit">Add complete action</button>
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
        <ActionJsonEditor
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
            tone="success"
          />
          <ActionListView
            label={`${actionLabel} failure`}
            list={action.onFailure}
            onEdit={onEdit}
            onNotice={onNotice}
            references={references}
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
  readonly tone?: "failure" | "root" | "success";
  readonly addButtonRef?: Ref<HTMLButtonElement>;
}

function ActionListView({
  label,
  list,
  onEdit,
  onNotice,
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
        {notice || "Action JSON drafts stay local until a complete action is applied."}
      </p>
    </section>
  );
}
